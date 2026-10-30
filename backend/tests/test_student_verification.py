import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
"""HTTP tests against isolated Mongo fixtures; no real students or documents."""
import asyncio
import io
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock
import mongomock
import pytest
from bson import ObjectId
from fastapi import FastAPI, HTTPException, Request
from fastapi.testclient import TestClient
from PIL import Image
from student_verification import install_student_verification, student_public, export_student_verification


class Cursor:
    def __init__(self, raw): self.raw = raw
    def sort(self, *args): self.raw = self.raw.sort(*args); return self
    def limit(self, *args): self.raw = self.raw.limit(*args); return self
    async def to_list(self, length): return list(self.raw)[:length]


class Collection:
    def __init__(self, raw): self.raw = raw
    async def find_one(self, *args, **kwargs): return self.raw.find_one(*args, **kwargs)
    async def insert_one(self, *args, **kwargs): return self.raw.insert_one(*args, **kwargs)
    async def update_one(self, *args, **kwargs): return self.raw.update_one(*args, **kwargs)
    async def delete_one(self, *args, **kwargs): return self.raw.delete_one(*args, **kwargs)
    async def delete_many(self, *args, **kwargs): return self.raw.delete_many(*args, **kwargs)
    def find(self, *args, **kwargs): return Cursor(self.raw.find(*args, **kwargs))


class Database:
    def __init__(self): self.raw = mongomock.MongoClient().student
    def __getattr__(self, name): return Collection(self.raw[name])


def picture():
    out = io.BytesIO(); image = Image.new('RGB', (50, 50), 'blue')
    exif = image.getexif(); exif[270] = 'private GPS metadata'
    image.save(out, format='JPEG', exif=exif); return out.getvalue()


@pytest.fixture
def env():
    db = Database(); app = FastAPI(); audit = AsyncMock(); limit = AsyncMock()
    uid = str(ObjectId()); other = str(ObjectId())
    db.raw.users.insert_one({'_id': ObjectId(uid), 'fullName': 'Fixture Student'})
    async def customer(request: Request):
        if not request.headers.get('x-user'): raise HTTPException(401)
        if request.headers.get('x-role', 'user') != 'user': raise HTTPException(403)
        return {'id': request.headers['x-user'], 'role': 'user'}
    async def admin(request: Request):
        if request.headers.get('x-role') != 'admin' or request.headers.get('x-2fa') != 'yes': raise HTTPException(403)
        return {'id': 'fixture-admin', 'role': 'admin'}
    install_student_verification(app, db, require_customer=customer, require_admin=admin, rate_limit=limit, audit=audit)
    return TestClient(app), db, uid, other, audit


def submit(env, **fields):
    client, _, uid, _, _ = env
    data = {'institution': 'Fixture University', 'valid_until': (datetime.now(timezone.utc).date() + timedelta(days=90)).isoformat(), 'consent': 'true'} | fields
    return client.post('/me/student-verification', headers={'x-user': uid}, data=data,
        files={'file': ('proof.jpg', picture(), 'image/jpeg')})


ADMIN = {'x-role': 'admin', 'x-2fa': 'yes'}


def test_submit_scoped_private_and_not_eligible_until_review(env):
    c, db, uid, other, _ = env
    assert c.get('/me/student-verification').status_code == 401
    assert c.get('/me/student-verification', headers={'x-user': uid, 'x-role': 'driver'}).status_code == 403
    row = submit(env).json()
    assert row['status'] == 'pending' and row['eligible'] is False and row['benefit_configured'] is False
    assert 'data' not in row and 'user_id' not in row
    assert not Image.open(io.BytesIO(db.raw.student_proofs.find_one()['data'])).getexif()
    assert c.get('/me/student-verification', headers={'x-user': other}).json()['status'] == 'not_submitted'
    url = f'/admin/student-verifications/{uid}/proof?revision={row["revision"]}'
    assert c.get(url, headers={'x-user': uid}).status_code == 403
    assert c.get(url, headers={'x-role': 'admin'}).status_code == 403
    response = c.get(url, headers=ADMIN)
    assert response.status_code == 200 and response.headers['cache-control'] == 'private, no-store'
    assert c.get('/admin/student-verifications', headers=ADMIN).json()['applications'][0]['customer_name'] == 'Fixture Student'


def test_review_requires_current_revision_proof_and_is_idempotent(env):
    c, db, uid, _, audit = env
    old = submit(env).json(); new = submit(env).json()
    url = f'/admin/student-verifications/{uid}/review'
    body = {'revision': old['revision'], 'decision': 'verified', 'reason': 'Fixture checked'}
    assert c.post(url, json=body, headers=ADMIN).status_code == 409
    body['revision'] = new['revision']
    result = c.post(url, json=body, headers=ADMIN)
    assert result.status_code == 200 and result.json()['eligible'] is True
    assert result.json()['benefit_configured'] is False
    assert db.raw.student_proofs.find_one({'_id': new['revision']}) is None
    assert c.post(url, json=body, headers=ADMIN).status_code == 409
    audit.assert_awaited_once()
    body['decision'] = 'revoked'
    assert c.post(url, json=body, headers=ADMIN).json()['eligible'] is False


@pytest.mark.parametrize('fields', [{'consent': 'false'}, {'institution': ' '},
    {'valid_until': '2000-01-01'}, {'valid_until': '2040-01-01'}, {'valid_until': 'bad'}])
def test_invalid_application_not_persisted(env, fields):
    assert submit(env, **fields).status_code == 422
    assert env[1].raw.student_proofs.count_documents({}) == 0


def test_expiry_proof_retention_and_erasure(env):
    c, db, uid, _, _ = env
    row = submit(env).json()
    assert asyncio.run(export_student_verification(db, uid))['proof_jpeg_base64']
    db.raw.student_proofs.update_one({'_id': row['revision']}, {'$set': {'expires_at': datetime.now(timezone.utc) - timedelta(seconds=1)}})
    assert c.get(f'/admin/student-verifications/{uid}/proof?revision={row["revision"]}', headers=ADMIN).status_code == 404
    assert c.post(f'/admin/student-verifications/{uid}/review', headers=ADMIN,
        json={'revision': row['revision'], 'decision': 'verified', 'reason': 'Not actually present'}).status_code == 409
    assert c.delete('/me/student-verification', headers={'x-user': uid}).status_code == 200
    assert db.raw.student_proofs.count_documents({}) == 0 and db.raw.student_verifications.count_documents({}) == 0
    assert student_public({'status': 'verified', 'valid_until': '2000-01-01'})['eligible'] is False
    assert student_public({'status': 'pending', 'valid_until': '2040-01-01', 'proof_expires_at': '2000-01-01'})['status'] == 'needs_resubmission'


def test_rejection_never_grants_eligibility_and_no_public_proof(env):
    c, db, uid, _, _ = env; row = submit(env).json()
    result = c.post(f'/admin/student-verifications/{uid}/review', headers=ADMIN,
        json={'revision': row['revision'], 'decision': 'rejected', 'reason': 'Fixture unreadable'})
    assert result.json()['status'] == 'rejected' and not result.json()['eligible']
    assert db.raw.student_proofs.count_documents({}) == 0
    assert c.get(f'/admin/student-verifications/{uid}/proof?revision={row["revision"]}', headers=ADMIN).status_code == 404
