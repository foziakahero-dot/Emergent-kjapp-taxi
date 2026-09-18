"""Focused regressions for the beta security fixes that do not require a live MongoDB."""

import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
from starlette.requests import Request


os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("DB_NAME", "kjapp_test")
os.environ.setdefault("JWT_SECRET", "unit-test-secret-that-is-long-enough-for-hs256")
os.environ.setdefault("APP_ENV", "development")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import server  # noqa: E402


def test_public_user_never_exposes_authentication_material():
    public = server.user_public({
        "_id": "507f1f77bcf86cd799439011",
        "email": "admin@example.no",
        "role": "superadmin",
        "password_hash": "hash",
        "totp_secret": "secret",
        "totp_secret_pending": "pending",
        "totp_backup_codes": ["hash2"],
        "stripe_customer_id": "cus_123",
        "tokens_valid_after": 42,
    })
    assert public["email"] == "admin@example.no"
    assert public["role"] == "superadmin"
    for forbidden in ("password_hash", "totp_secret", "totp_secret_pending", "totp_backup_codes", "stripe_customer_id", "tokens_valid_after"):
        assert forbidden not in public


def test_access_tokens_are_individually_revocable():
    first = jwt.decode(server.create_access_token("u1", "u@example.no"), server.JWT_SECRET, algorithms=[server.JWT_ALGORITHM])
    second = jwt.decode(server.create_access_token("u1", "u@example.no"), server.JWT_SECRET, algorithms=[server.JWT_ALGORITHM])
    assert first["type"] == "access"
    assert first["jti"] != second["jti"]
    assert isinstance(first["iat"], (int, float))


def test_explicit_bearer_token_wins_over_stale_cookie():
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/auth/me",
        "headers": [(b"authorization", b"Bearer bearer-token")],
        "cookies": {"access_token": "stale-cookie-token"},
    }
    request = Request(scope)
    assert server._auth_token_from_request(request) == "bearer-token"


def test_invite_expiry_is_fail_closed():
    assert server._invite_expired({"expires_at": (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()})
    assert not server._invite_expired({"expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()})
    assert server._invite_expired({"expires_at": "not-a-date"})


def test_stripe_expandable_ids_are_normalized():
    class StripeObject:
        id = "cus_attr"

    assert server._stripe_id("cus_string") == "cus_string"
    assert server._stripe_id({"id": "cus_dict"}) == "cus_dict"
    assert server._stripe_id(StripeObject()) == "cus_attr"
    assert server._stripe_id(None) is None


def test_stale_driver_presence_does_not_count_as_live():
    now = datetime(2026, 9, 17, 20, 0, tzinfo=timezone.utc)
    assert server._fresh_driver_location((now - timedelta(seconds=30)).isoformat(), now)
    assert not server._fresh_driver_location((now - timedelta(days=7)).isoformat(), now)
    assert not server._fresh_driver_location(None, now)
    assert not server._fresh_driver_location("broken timestamp", now)
