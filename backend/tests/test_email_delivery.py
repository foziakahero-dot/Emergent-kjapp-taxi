import asyncio
from types import SimpleNamespace
from unittest.mock import Mock

import httpx
import mongomock
import pytest

from email_delivery import email_configured, email_provider, send_transactional_email
from onboarding_emails import queue_confirmation, deliver_one, recover_customer_welcomes
from test_fleet_invitation_delivery import Collection


@pytest.fixture(autouse=True)
def clean_email_env(monkeypatch):
    for key in ('EMAIL_PROVIDER', 'RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'SENDGRID_API_KEY', 'SENDER_EMAIL'):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv('APP_ENV', 'production')


def configure(monkeypatch):
    monkeypatch.setenv('EMAIL_PROVIDER', 'resend')
    monkeypatch.setenv('RESEND_API_KEY', 're_test_placeholder')
    monkeypatch.setenv('RESEND_FROM_EMAIL', 'noreply@example.com')


def test_resend_sends_one_request_and_reuses_idempotency_on_retry(monkeypatch):
    configure(monkeypatch)
    post = Mock(return_value=httpx.Response(200, json={'id': 'message-id'}))
    monkeypatch.setattr(httpx, 'post', post)
    assert send_transactional_email('person@example.com', 'Velkommen', '<p>Hei</p>')
    assert send_transactional_email('person@example.com', 'Velkommen', '<p>Hei</p>')
    first, second = post.call_args_list
    assert first.kwargs['headers']['Idempotency-Key'] == second.kwargs['headers']['Idempotency-Key']
    assert first.args == ('https://api.resend.com/emails',)
    assert first.kwargs['json']['from'] == 'noreply@example.com'
    assert first.kwargs['timeout'] == 15


@pytest.mark.parametrize('status,body', [(403, {'message': 'Unverified domain'}), (429, {}), (500, {}), (200, {})])
def test_provider_rejection_does_not_claim_sent(monkeypatch, status, body):
    configure(monkeypatch)
    monkeypatch.setattr(httpx, 'post', Mock(return_value=httpx.Response(status, json=body)))
    assert not send_transactional_email('person@example.com', 'Welcome', '<p>Hello</p>')


def test_qa_and_missing_sender_never_contact_provider(monkeypatch):
    configure(monkeypatch)
    post = Mock()
    monkeypatch.setattr(httpx, 'post', post)
    monkeypatch.setenv('APP_ENV', 'qa')
    assert not email_configured()
    assert not send_transactional_email('person@example.com', 'Welcome', 'body')
    monkeypatch.setenv('APP_ENV', 'production')
    monkeypatch.delenv('RESEND_FROM_EMAIL')
    assert not send_transactional_email('person@example.com', 'Welcome', 'body')
    post.assert_not_called()


def test_preserves_sendgrid_until_provider_is_selected(monkeypatch):
    monkeypatch.setenv('SENDGRID_API_KEY', 'SG.placeholder')
    monkeypatch.setenv('RESEND_API_KEY', 're_placeholder')
    assert email_provider() == 'sendgrid'
    post = Mock(return_value=httpx.Response(202))
    monkeypatch.setattr(httpx, 'post', post)
    assert send_transactional_email('person@example.com', 'Welcome', 'body')
    assert post.call_args.args == ('https://api.sendgrid.com/v3/mail/send',)


def test_new_customer_intent_recovers_after_queue_failure_without_backfill(monkeypatch):
    raw = mongomock.MongoClient(tz_aware=True).db
    db = SimpleNamespace(users=Collection(raw.users), onboarding_email_outbox=Collection(raw.onboarding_email_outbox))
    raw.users.insert_many([
        {'role': 'user', 'email': 'new@example.com', 'fullName': '<Usman>', 'welcome_email_pending': True},
        {'role': 'user', 'email': 'existing@example.com'},
        {'role': 'driver', 'email': 'driver@example.com', 'welcome_email_pending': True},
    ])
    async def check():
        await recover_customer_welcomes(db)
        # Simulate restart between queue insert and clearing the user marker.
        raw.users.update_one({'email': 'new@example.com'}, {'$set': {'welcome_email_pending': True}})
        await recover_customer_welcomes(db)
        assert raw.onboarding_email_outbox.count_documents({}) == 1
        job = raw.onboarding_email_outbox.find_one()
        assert job['kind'] == 'customer' and job['recipient'] == 'new@example.com'
        assert '&lt;Usman&gt;' in job['html']
        assert 'Velkommen til SNAR' in job['subject']
        send = Mock(return_value=True)
        assert await deliver_one(db, send)
        assert not await deliver_one(db, send)
        send.assert_called_once()
    asyncio.run(check())


def test_duplicate_beta_submission_has_one_welcome_without_granting_access():
    raw = mongomock.MongoClient(tz_aware=True).db
    db = SimpleNamespace(onboarding_email_outbox=Collection(raw.onboarding_email_outbox))
    async def check():
        await queue_confirmation(db, 'beta', 'same-signup', 'beta@example.com', 'Ola')
        await queue_confirmation(db, 'beta', 'same-signup', 'beta@example.com', 'Ola')
        assert raw.onboarding_email_outbox.count_documents({}) == 1
        assert 'ikke en aktiv brukerkonto' in raw.onboarding_email_outbox.find_one()['html']
    asyncio.run(check())


def test_customer_registration_persists_welcome_intent(monkeypatch):
    from unittest.mock import AsyncMock
    from fastapi import Response
    monkeypatch.setenv('APP_ENV', 'development')
    monkeypatch.setenv('MONGO_URL', 'mongodb://127.0.0.1:27017')
    monkeypatch.setenv('DB_NAME', 'snar_email_test')
    monkeypatch.setenv('JWT_SECRET', 'test-only-secret-at-least-32-characters-long')
    import server
    raw = mongomock.MongoClient(tz_aware=True).db
    db = SimpleNamespace(users=Collection(raw.users), onboarding_email_outbox=Collection(raw.onboarding_email_outbox))
    monkeypatch.setattr(server, 'db', db)
    monkeypatch.setattr(server, '_enforce_rate_limit', AsyncMock())
    monkeypatch.setattr(server, 'create_access_token', lambda *args: 'test-session')
    monkeypatch.setattr(server, 'set_auth_cookie', Mock())
    monkeypatch.setattr(server, 'hash_password', lambda _: 'hashed')
    monkeypatch.setattr(server, 'user_public', lambda u: {'role': u['role']})
    body = SimpleNamespace(email='New@Example.com', password='test-password', accepted_terms=True, fullName='Usman', phone='')
    async def check():
        result = await server.register(body, SimpleNamespace(), Response())
        assert result['user']['role'] == 'user'
        assert raw.users.find_one()['welcome_email_pending'] is True
        await recover_customer_welcomes(db)
        assert raw.onboarding_email_outbox.find_one()['recipient'] == 'new@example.com'
    asyncio.run(check())
