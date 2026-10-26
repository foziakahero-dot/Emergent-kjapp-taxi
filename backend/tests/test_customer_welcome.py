"""Customer signup queues Resend once; provider failures retain a retryable job."""
import asyncio
import os
import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import mongomock
from bson import ObjectId
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault('MONGO_URL', 'mongodb://127.0.0.1:27017')
os.environ.setdefault('DB_NAME', 'snar_unit_test')
os.environ.setdefault('JWT_SECRET', 'unit-test-secret-that-is-long-enough-for-hs256')
os.environ.setdefault('APP_ENV', 'development')
import resend_email
from onboarding_emails import queue_customer_welcome, deliver_one
from test_fleet_invitation_delivery import Collection


def database():
    raw = mongomock.MongoClient(tz_aware=True).db
    raw.users.create_index('email', unique=True)
    return raw, SimpleNamespace(users=Collection(raw.users), onboarding_email_outbox=Collection(raw.onboarding_email_outbox))


def test_qa_resend_never_inherits_shared_keys(monkeypatch):
    monkeypatch.setenv('APP_ENV', 'qa')
    monkeypatch.setenv('RESEND_API_KEY', 'shared-placeholder')
    monkeypatch.setenv('RESEND_FROM_EMAIL', 'sender@example.invalid')
    assert not resend_email.resend_config()['enabled']
    monkeypatch.setenv('QA_RESEND_API_KEY', 'qa-placeholder')
    monkeypatch.setenv('QA_RESEND_FROM_EMAIL', 'qa@example.invalid')
    assert not resend_email.resend_config()['enabled']
    monkeypatch.setenv('QA_RESEND_ENABLED', 'true')
    assert resend_email.resend_config() == {'enabled': True, 'key':'qa-placeholder', 'sender':'qa@example.invalid'}


def test_resend_request_uses_stable_idempotency_key_and_requires_provider_id(monkeypatch):
    monkeypatch.setenv('APP_ENV', 'qa')
    monkeypatch.setenv('QA_RESEND_API_KEY', 'qa-placeholder')
    monkeypatch.setenv('QA_RESEND_FROM_EMAIL', 'QA <qa@example.invalid>')
    monkeypatch.setenv('QA_RESEND_ENABLED', 'true')
    requests = []
    code, body = 200, {'id':'email-synthetic'}
    def handle(request):
        requests.append(request)
        assert str(request.url) == 'https://api.resend.com/emails'
        assert request.headers['Authorization'] == 'Bearer qa-placeholder'
        assert request.headers['Idempotency-Key'] == 'welcome/synthetic'
        return httpx.Response(code, json=body)
    Client = httpx.Client
    monkeypatch.setattr(resend_email.httpx, 'Client', lambda **kwargs: Client(transport=httpx.MockTransport(handle), **kwargs))
    def send(): return resend_email.send_resend_email('delivered@resend.dev', 'Test', '<p>Test</p>', idempotency_key='welcome/synthetic')
    assert send() is True
    code, body = 429, {'message':'rate limited'}
    assert send() is False
    code, body = 200, {}
    assert send() is False
    assert len(requests) == 3


def test_welcome_is_durable_once_and_never_sent_by_sendgrid(monkeypatch):
    raw, db = database()
    user = {'_id':ObjectId(), 'email':'synthetic@example.invalid', 'fullName':'<Test>', 'role':'user', 'welcome_email_pending':True}
    raw.users.insert_one(user)
    calls=[]
    async def run():
        await queue_customer_welcome(db, user)
        await queue_customer_welcome(db, user)
        assert raw.onboarding_email_outbox.count_documents({}) == 1
        assert '&lt;Test&gt;' in raw.onboarding_email_outbox.find_one()['html']
        assert not raw.users.find_one().get('welcome_email_pending')
        assert await deliver_one(db, lambda *args: True) is False
        def send(*args, **kwargs): calls.append(kwargs['idempotency_key']); return False
        assert await deliver_one(db, send, provider='resend') is True
        job=raw.onboarding_email_outbox.find_one()
        assert job['status']=='pending' and job['attempts']==1
        raw.onboarding_email_outbox.update_one({'_id':job['_id']}, {'$set': {'next_attempt_at':datetime.now(timezone.utc)-timedelta(seconds=1)}})
        def success(*args, **kwargs): calls.append(kwargs['idempotency_key']); return True
        assert await deliver_one(db, success, provider='resend') is True
        assert await deliver_one(db, success, provider='resend') is False
        assert len(calls)==2 and calls[0]==calls[1]
    asyncio.run(run())


def test_password_registration_creates_customer_and_resend_outbox(monkeypatch):
    import server
    raw, db = database()
    monkeypatch.setattr(server, 'db', db)
    monkeypatch.setattr(server, '_enforce_rate_limit', AsyncMock())
    monkeypatch.setattr(server, 'hash_password', lambda _: 'synthetic-hash')
    client=TestClient(server.app)
    payload={'email':'new-customer@example.invalid', 'password':'synthetic-password', 'fullName':'Synthetic', 'accepted_terms':True}
    first=client.post('/api/auth/register',json=payload)
    assert first.status_code==200
    assert client.post('/api/auth/register',json=payload).status_code==400
    assert raw.users.count_documents({})==1 and raw.users.find_one()['role']=='user'
    assert raw.onboarding_email_outbox.count_documents({'kind':'customer','provider':'resend'})==1
