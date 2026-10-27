"""Exercise real OTP routes with isolated database/provider boundaries; never send SMS."""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient
from test_mobile_commerce import Database
import customer_otp as otp


@pytest.fixture
def env(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("CUSTOMER_OTP_ENABLED", "true")
    for key in ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_VERIFY_SERVICE_SID"):
        monkeypatch.setenv(key, "fixture")
    db, uid = Database(), ObjectId()
    db.raw.users.insert_one({"_id": uid, "role": "user", "phone": "+47 912 34 567", "email": "customer@example.test"})
    provider = AsyncMock(return_value={"sid": "VE_fixture", "status": "pending"})
    monkeypatch.setattr(otp, "provider_call", provider)
    app, mint, cookie = FastAPI(), Mock(return_value="verified-session"), Mock()
    otp.install_customer_otp(app, db, rate_limit=AsyncMock(), secret="isolated-fixture",
        create_access_token=mint, create_twofa_token=lambda uid: "second-factor",
        set_auth_cookie=cookie, user_public=lambda u: {"id": str(u["_id"]), "role": u["role"]})
    return SimpleNamespace(client=TestClient(app), db=db, uid=uid, provider=provider, mint=mint, cookie=cookie)


def start(e, phone="91234567"):
    result = e.client.post("/auth/customer/otp/start", json={"phone": phone})
    assert result.status_code == 200
    return result.json()["challenge_id"]


def verify(e, challenge, phone="91234567"):
    return e.client.post("/auth/customer/otp/verify", json={"phone": phone, "challenge_id": challenge, "code": "123456"})


def test_provider_approval_mints_one_session_and_replay_fails(env):
    challenge = start(env)
    env.provider.return_value = {"sid": "VE_fixture", "status": "approved"}
    assert verify(env, challenge).json()["token"] == "verified-session"
    assert verify(env, challenge).status_code == 401
    env.mint.assert_called_once_with(str(env.uid), "customer@example.test")
    env.cookie.assert_called_once()


@pytest.mark.parametrize("change", [{"disabled": True}, {"role": "driver"}, {"phone": "92234567"}])
def test_account_must_still_match_at_verification(env, change):
    challenge = start(env)
    env.db.raw.users.update_one({"_id": env.uid}, {"$set": change})
    env.provider.return_value = {"sid": "VE_fixture", "status": "approved"}
    assert verify(env, challenge).status_code == 401
    env.mint.assert_not_called()


def test_no_automatic_link_for_ambiguous_or_unknown_phone(env):
    env.db.raw.users.insert_one({"role": "user", "phone": "91234567"})
    challenge = start(env)
    env.provider.assert_not_awaited()
    assert verify(env, challenge).status_code == 401
    env.mint.assert_not_called()
    assert env.db.raw.users.count_documents({}) == 2


def test_wrong_phone_expiry_and_attempt_cap_do_not_mint(env):
    challenge = start(env)
    assert verify(env, challenge, "92234567").status_code == 401
    env.provider.return_value = {"sid": "VE_fixture", "status": "pending"}
    for _ in range(6):
        assert verify(env, challenge).status_code == 401
    assert env.db.raw.customer_otp_challenges.find_one({"_id": challenge})["attempts"] == 5
    env.mint.assert_not_called()
    challenge = start(env)
    env.db.raw.customer_otp_challenges.update_one({"_id": challenge}, {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(seconds=1)}})
    assert verify(env, challenge).status_code == 401


def test_second_factor_is_preserved(env):
    challenge = start(env)
    env.db.raw.users.update_one({"_id": env.uid}, {"$set": {"totp_enabled": True}})
    env.provider.return_value = {"sid": "VE_fixture", "status": "approved"}
    assert verify(env, challenge).json()["twofa_required"] is True
    env.mint.assert_not_called()
    env.cookie.assert_not_called()


def test_qa_cannot_inherit_production_sms_credentials(env, monkeypatch):
    monkeypatch.setenv("APP_ENV", "qa")
    assert env.client.get("/auth/customer/otp/config").json()["enabled"] is False
    assert env.client.post("/auth/customer/otp/start", json={"phone": "91234567"}).status_code == 503
    env.provider.assert_not_awaited()


def test_provider_unavailable_never_creates_challenge(env):
    from fastapi import HTTPException
    env.provider.side_effect = HTTPException(502, "SMS unavailable")
    assert env.client.post("/auth/customer/otp/start", json={"phone": "91234567"}).status_code == 502
    assert env.db.raw.customer_otp_challenges.count_documents({}) == 0
    env.mint.assert_not_called()


@pytest.mark.parametrize("value,expected", [("004791234567", "+4791234567"), ("+47 912 34 567", "+4791234567"),
    ("+46 70 123 45 67", None), ("phone91234567", None), ("01234567", None)])
def test_norwegian_phone(value, expected):
    assert otp.norwegian_phone(value) == expected
