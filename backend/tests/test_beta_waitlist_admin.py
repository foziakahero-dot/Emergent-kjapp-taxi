import sys
from pathlib import Path
from types import SimpleNamespace

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import marketing_waitlist
from test_marketing_waitlist_unit import FakeRateLimits, FakeWaitlist, valid_payload


def matches(record, query):
    return all(record.get(key) in value['$in'] if isinstance(value, dict) else record.get(key) == value
               for key, value in query.items())


class Cursor:
    def __init__(self, records):
        self.records = list(records)
    def sort(self, key, direction):
        self.records.sort(key=lambda item: item[key], reverse=direction < 0)
        return self
    def skip(self, value):
        self.records = self.records[value:]
        return self
    def limit(self, value):
        self.records = self.records[:value]
        return self
    def __aiter__(self):
        self.iterator = iter(self.records)
        return self
    async def __anext__(self):
        try: return next(self.iterator)
        except StopIteration: raise StopAsyncIteration


class Collection(FakeWaitlist):
    def find(self, query, projection=None):
        return Cursor(dict(item) for item in self.docs.values() if matches(item, query))
    async def count_documents(self, query):
        return sum(matches(item, query) for item in self.docs.values())
    async def find_one(self, query, projection=None):
        return next((dict(item) for item in self.docs.values() if matches(item, query)), None)


def make_client():
    db = SimpleNamespace(beta_waitlist=Collection(), waitlist_rate_limits=FakeRateLimits(),
                         onboarding_email_outbox=Collection())
    events = []
    async def require_admin(authorization: str = Header(default='')):
        if authorization == 'Bearer admin': return {'id': 'admin-id', 'role': 'admin'}
        raise HTTPException(403 if authorization else 401, 'Kun for admin')
    async def audit(*args): events.append(args)
    async def confirmation(identity, email, name):
        db.onboarding_email_outbox.docs[identity] = {'_id': f'beta:{identity}', 'status': 'pending',
                                                   'html': 'private', 'recipient': email}
        return 'not_configured'
    api = APIRouter(prefix='/api')
    marketing_waitlist.install_marketing_waitlist(api, db, confirmation, require_admin, audit)
    app = FastAPI(); app.include_router(api)
    return TestClient(app), db, events


def test_registration_reaches_admin_list_with_delivery_status(monkeypatch):
    monkeypatch.delenv('SENDGRID_API_KEY', raising=False)
    client, db, events = make_client()
    assert client.post('/api/marketing/waitlist', json=valid_payload()).status_code == 201
    result = client.get('/api/admin/beta-waitlist', headers={'Authorization': 'Bearer admin'})
    assert result.status_code == 200
    data = result.json()
    assert data['total'] == 1 and data['email_configured'] is False
    assert data['items'][0]['name'] == 'Ola Nordmann'
    assert data['items'][0]['confirmation_email_status'] == 'pending'
    assert 'html' not in data['items'][0] and '_id' not in data['items'][0]


def test_interest_data_requires_admin_for_read_and_write():
    client, db, events = make_client()
    client.post('/api/marketing/waitlist', json=valid_payload())
    identity = next(iter(db.beta_waitlist.docs))
    for headers, status in [({}, 401), ({'Authorization': 'Bearer customer'}, 403)]:
        assert client.get('/api/admin/beta-waitlist', headers=headers).status_code == status
        assert client.patch(f'/api/admin/beta-waitlist/{identity}', json={'status': 'contacted'}, headers=headers).status_code == status


def test_filters_pagination_status_and_audit():
    client, db, events = make_client()
    client.post('/api/marketing/waitlist', json=valid_payload())
    client.post('/api/marketing/waitlist', json=valid_payload(role='driver'))
    headers = {'Authorization': 'Bearer admin'}
    data = client.get('/api/admin/beta-waitlist?role=driver&limit=1', headers=headers).json()
    assert data['total'] == 1 and data['items'][0]['role'] == 'driver'
    identity = data['items'][0]['id']
    assert client.patch(f'/api/admin/beta-waitlist/{identity}', json={'status': 'contacted'}, headers=headers).status_code == 200
    assert db.beta_waitlist.docs[identity]['reviewed_by'] == 'admin-id'
    assert events[0][1] == 'beta_interest.status'
    assert client.get('/api/admin/beta-waitlist?status=contacted', headers=headers).json()['total'] == 1
    assert client.patch(f'/api/admin/beta-waitlist/{identity}', json={'status': 'approved'}, headers=headers).status_code == 422
    assert client.patch('/api/admin/beta-waitlist/missing', json={'status': 'contacted'}, headers=headers).status_code == 404
