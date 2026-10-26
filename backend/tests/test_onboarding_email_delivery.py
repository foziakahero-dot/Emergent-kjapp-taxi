import ast
import asyncio
import hashlib
import html
import os
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, Mock

import httpx
import mongomock
import pytest
from bson import ObjectId

from email_delivery import email_configured, send_transactional_email
from onboarding_emails import deliver_one, queue_confirmation
from qa_safety import is_safe_qa_web_origin
from test_fleet_invitation_delivery import Collection
from test_marketing_waitlist_unit import make_client, valid_payload


@pytest.fixture(autouse=True)
def isolated_email_environment(monkeypatch):
    for name in ("EMAIL_PROVIDER", "RESEND_API_KEY", "RESEND_FROM_EMAIL", "SENDGRID_API_KEY",
                 "SENDER_EMAIL", "QA_RESEND_API_KEY", "QA_RESEND_FROM_EMAIL", "QA_RESEND_ENABLED",
                 "FLEET_PUBLIC_URL"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("APP_ENV", "production")


def configure(monkeypatch, qa=False):
    prefix = "QA_" if qa else ""
    monkeypatch.setenv(prefix + "RESEND_API_KEY", "re_placeholder_for_unit_test")
    monkeypatch.setenv(prefix + "RESEND_FROM_EMAIL", "noreply@example.com")
    if qa:
        monkeypatch.setenv("APP_ENV", "qa")
        monkeypatch.setenv("QA_RESEND_ENABLED", "true")


def provider(monkeypatch, status=200, body=None):
    client = MagicMock()
    client.__enter__.return_value = client
    client.post.return_value = httpx.Response(status, json=body if body is not None else {"id": "message-id"})
    monkeypatch.setattr(httpx, "Client", Mock(return_value=client))
    return client


def database():
    raw = mongomock.MongoClient(tz_aware=True).db
    db = SimpleNamespace(**{name: Collection(raw[name]) for name in
        ("users", "onboarding_email_outbox", "password_reset_tokens")})
    return db, raw


def prepare(db, app_env="production"):
    source = ast.parse((Path(__file__).parents[1] / "server.py").read_text())
    node = next(n for n in source.body if isinstance(n, ast.AsyncFunctionDef) and n.name == "_prepare_onboarding_email")
    namespace = dict(db=db, html_escape=html, secrets=secrets, datetime=datetime, timezone=timezone,
                     timedelta=timedelta, os=os, APP_ENV=app_env, is_safe_qa_web_origin=is_safe_qa_web_origin,
                     _password_reset_token_hash=lambda token: hashlib.sha256(token.encode()).hexdigest())
    exec(compile(ast.Module(body=[node], type_ignores=[]), "server.py", "exec"), namespace)
    return namespace["_prepare_onboarding_email"]


@pytest.mark.parametrize("role", ["passenger", "driver", "fleet_owner"])
def test_landing_requires_email_for_every_registration_role(role):
    client, db = make_client()
    for email in ("", "not-an-email"):
        assert client.post("/api/marketing/waitlist", json=valid_payload(role=role, email=email)).status_code in (400, 422)
    assert db.beta_waitlist.docs == {}


def test_real_transport_acknowledgement_and_idempotency(monkeypatch):
    configure(monkeypatch)
    client = provider(monkeypatch)
    assert send_transactional_email("person@example.com", "SNAR", "<p>Hei</p>")
    assert send_transactional_email("person@example.com", "SNAR", "<p>Hei</p>")
    first, second = client.post.call_args_list
    assert first.args == ("https://api.resend.com/emails",)
    assert first.kwargs["headers"]["Idempotency-Key"] == second.kwargs["headers"]["Idempotency-Key"]
    assert first.kwargs["json"]["to"] == ["person@example.com"]


@pytest.mark.parametrize("status,body", [(403, {"message": "Unverified domain"}), (429, {}), (500, {}), (200, {})])
def test_rejected_email_never_reports_success(monkeypatch, status, body):
    configure(monkeypatch)
    provider(monkeypatch, status, body)
    assert not send_transactional_email("person@example.com", "SNAR", "body")


def test_qa_cannot_inherit_production_credentials(monkeypatch):
    configure(monkeypatch)
    client = provider(monkeypatch)
    monkeypatch.setenv("APP_ENV", "qa")
    assert not email_configured()
    assert not send_transactional_email("person@example.com", "SNAR", "body")
    client.post.assert_not_called()
    configure(monkeypatch, qa=True)
    assert email_configured()
    assert send_transactional_email("person@example.com", "SNAR", "body")
    monkeypatch.setenv("QA_RESEND_ENABLED", "false")
    assert not email_configured()


def test_existing_sendgrid_stays_selected(monkeypatch):
    configure(monkeypatch)
    monkeypatch.setenv("SENDGRID_API_KEY", "SG.placeholder")
    client = provider(monkeypatch, 202)
    assert send_transactional_email("person@example.com", "SNAR", "body")
    assert client.post.call_args.args == ("https://api.sendgrid.com/v3/mail/send",)


def test_beta_retry_delivers_once_without_granting_an_account(monkeypatch):
    configure(monkeypatch)
    db, raw = database()
    async def check():
        assert await queue_confirmation(db, "beta", "signup", "person@example.com", "<Ola>") == "queued"
        await queue_confirmation(db, "beta", "signup", "person@example.com", "<Ola>")
        assert raw.onboarding_email_outbox.count_documents({}) == 1
        assert raw.users.count_documents({}) == 0
        assert "&lt;Ola&gt;" in raw.onboarding_email_outbox.find_one()["html"]
        sender = Mock(return_value=False)
        assert await deliver_one(db, sender)
        job = raw.onboarding_email_outbox.find_one()
        assert job["status"] == "pending" and job["attempts"] == 1
        raw.onboarding_email_outbox.update_one({}, {"$set": {"next_attempt_at": datetime.now(timezone.utc)}})
        sender.return_value = True
        assert await deliver_one(db, sender)
        assert raw.onboarding_email_outbox.find_one()["status"] == "sent"
        assert not await deliver_one(db, sender)
        assert sender.call_count == 2
    asyncio.run(check())


def test_approved_fleet_receives_username_and_expiring_password_setup(monkeypatch):
    configure(monkeypatch)
    db, raw = database()
    uid = raw.users.insert_one({"email": "owner@example.com", "role": "fleet_owner", "approved": True,
                                "fleet_id": str(ObjectId()), "password_hash": "existing-hash"}).inserted_id
    async def check():
        await queue_confirmation(db, "fleet-approved", "application", "owner@example.com", "Firma")
        assert raw.password_reset_tokens.count_documents({}) == 0
        sender = Mock(return_value=True)
        assert await deliver_one(db, sender, prepare(db))
        body = sender.call_args.args[2]
        assert "Brukernavn: <strong>owner@example.com</strong>" in body
        assert "https://fleet.snarapp.no/reset-password/" in body
        assert "existing-hash" not in body
        stored = raw.password_reset_tokens.find_one()
        assert stored["expires_at"] - stored["created_at"] == timedelta(hours=1)
        assert "token" not in stored and stored["token_hash"] not in body
        assert "reset-password/" not in raw.onboarding_email_outbox.find_one()["html"]
        assert raw.users.find_one({"_id": uid})["password_hash"] == "existing-hash"
    asyncio.run(check())


def test_revoked_account_does_not_receive_access_email(monkeypatch):
    configure(monkeypatch)
    db, raw = database()
    raw.users.insert_one({"email": "owner@example.com", "role": "fleet_owner", "approved": False, "fleet_id": "fleet"})
    async def check():
        await queue_confirmation(db, "fleet-approved", "application", "owner@example.com", "Firma")
        sender = Mock()
        assert await deliver_one(db, sender, prepare(db))
        sender.assert_not_called()
        assert raw.password_reset_tokens.count_documents({}) == 0
        assert raw.onboarding_email_outbox.find_one()["status"] == "pending"
    asyncio.run(check())


def test_qa_setup_rejects_production_fleet_origin(monkeypatch):
    configure(monkeypatch, qa=True)
    db, raw = database()
    raw.users.insert_one({"email": "owner@example.com", "role": "fleet_owner", "approved": True, "fleet_id": "fleet"})
    async def check():
        await queue_confirmation(db, "fleet-approved", "application", "owner@example.com", "Firma")
        sender = Mock()
        await deliver_one(db, sender, prepare(db, "qa"))
        sender.assert_not_called()
        assert raw.password_reset_tokens.count_documents({}) == 0
        monkeypatch.setenv("FLEET_PUBLIC_URL", "https://fleet-qa.example.com")
        raw.onboarding_email_outbox.update_one({}, {"$set": {"next_attempt_at": datetime.now(timezone.utc)}})
        sender.return_value = True
        await deliver_one(db, sender, prepare(db, "qa"))
        assert "https://fleet-qa.example.com/reset-password/" in sender.call_args.args[2]
    asyncio.run(check())


def test_approved_driver_gets_username_and_existing_password_instructions(monkeypatch):
    configure(monkeypatch)
    db, raw = database()
    raw.users.insert_one({"email": "driver@example.com", "role": "driver", "approved": True, "password_hash": "private-hash"})
    async def check():
        await queue_confirmation(db, "driver-approved", "driver", "driver@example.com", "Sjåfør")
        sender = Mock(return_value=True)
        await deliver_one(db, sender, prepare(db))
        body = sender.call_args.args[2]
        assert "Brukernavn: <strong>driver@example.com</strong>" in body
        assert "Passord: Bruk passordet du valgte" in body and "private-hash" not in body
        assert raw.password_reset_tokens.count_documents({}) == 0
    asyncio.run(check())
