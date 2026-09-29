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

def test_checkout_origin_falls_back_to_kjapp(monkeypatch):
    monkeypatch.setenv("KJAPP_PUBLIC_WEB_ORIGIN", "https://kjappapp.no")
    monkeypatch.setenv("KJAPP_CHECKOUT_ALLOWED_ORIGINS", "https://kjappapp.no,https://staging.kjappapp.no")
    assert server._trusted_checkout_origin("https://staging.kjappapp.no") == "https://staging.kjappapp.no"
    assert server._trusted_checkout_origin("https://evil.example") == "https://kjappapp.no"


def test_driver_role_gate_rejects_admin_unapproved_and_missing_legal_consent():
    import asyncio
    from fastapi import HTTPException

    async def run():
        try:
            await server.require_driver({"id": "a1", "role": "admin", "approved": True, "legal_accepted": True})
            assert False, "admin must not enter live driver endpoints"
        except HTTPException as exc:
            assert exc.status_code == 403

        try:
            await server.require_driver({"id": "d1", "role": "driver", "approved": None, "legal_accepted": True})
            assert False, "missing approval must fail closed"
        except HTTPException as exc:
            assert exc.status_code == 403

        try:
            await server.require_driver({"id": "d2", "role": "driver", "approved": True, "legal_accepted": False})
            assert False, "approved legacy driver must accept current legal gate"
        except HTTPException as exc:
            assert exc.status_code == 403
            assert "vilkår" in exc.detail.lower()

    asyncio.run(run())


def test_oslo_service_area_helper_can_fail_closed(monkeypatch):
    original = server.OSLO_BETA_ENFORCE
    try:
        server.OSLO_BETA_ENFORCE = True
        assert server._pickup_inside_launch_area(server.OSLO_BETA_CENTER_LAT, server.OSLO_BETA_CENTER_LNG)
        assert not server._pickup_inside_launch_area(60.8, 11.8)
    finally:
        server.OSLO_BETA_ENFORCE = original

def test_demo_data_is_always_disabled_in_production():
    assert server.demo_data_enabled("production", "true") is False
    assert server.demo_data_enabled("production", None) is False
    assert server.demo_data_enabled("staging", "true") is False
    assert server.demo_data_enabled("beta", "true") is False
    assert server.demo_data_enabled("development", None) is False
    assert server.demo_data_enabled("development", "true") is True
    assert server.demo_data_enabled("development", "false") is False


def test_production_config_rejects_weak_admin_and_jwt():
    import pytest

    with pytest.raises(RuntimeError):
        server.validate_production_config({
            "JWT_SECRET": "secret",
            "ADMIN_EMAIL": "admin@kjappapp.no",
            "ADMIN_PASSWORD": "admin123",
        })

    server.validate_production_config({
        "JWT_SECRET": "a-secure-beta-secret-that-is-longer-than-thirty-two-characters",
        "ADMIN_EMAIL": "admin@kjappapp.no",
        "ADMIN_PASSWORD": "a-strong-admin-password-2026",
    })

def test_missing_email_provider_never_logs_message_body(monkeypatch, capsys):
    monkeypatch.delenv("SENDGRID_API_KEY", raising=False)
    secret_marker = "RESET-TOKEN-MUST-NOT-LEAK"
    assert server.send_email("user@example.no", "Reset", f"<p>{secret_marker}</p>") is False
    output = capsys.readouterr().out
    assert secret_marker not in output
    assert "body=redacted" in output


def test_platform_defaults_never_enable_demo_trips():
    assert server.DEFAULT_PLATFORM_SETTINGS["features"]["demo_trips"] is False

def test_client_error_redaction_removes_tokens_and_email():
    raw = "Authorization: Bearer abcdefghijklmnopqrstuvwxyz token=secret-value user@example.no"
    cleaned = server._redact_client_error_text(raw)
    assert "abcdefghijklmnopqrstuvwxyz" not in cleaned
    assert "secret-value" not in cleaned
    assert "user@example.no" not in cleaned
    assert "[REDACTED]" in cleaned
    assert "[REDACTED_EMAIL]" in cleaned


def test_trip_request_rejects_impossible_coordinates():
    import pytest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        server.TripRequest(
            pickup_address="Oslo",
            pickup_lat=120,
            pickup_lng=10.75,
            dropoff_address="Aker Brygge",
            dropoff_lat=59.91,
            dropoff_lng=10.72,
            vehicle_type="ai-first",
        )

def test_password_reset_tokens_are_hashed_at_rest_helper():
    token = "example-reset-token-with-enough-entropy-123456"
    hashed = server._password_reset_token_hash(token)
    assert hashed != token
    assert len(hashed) == 64
    assert hashed == server._password_reset_token_hash(token)
    assert hashed != server._password_reset_token_hash(token + "x")

def test_legal_consent_requires_current_server_version():
    current = server.CURRENT_LEGAL_VERSION
    user = {
        "_id": "507f1f77bcf86cd799439011",
        "email": "customer@example.no",
        "accepted_terms_at": datetime.now(timezone.utc).isoformat(),
        "legal_version": current,
    }
    public = server.user_public(user)
    assert public["legal_accepted"] is True
    assert server.user_public(public)["legal_accepted"] is True

    stale = dict(user)
    stale["legal_version"] = "older-version"
    assert server.user_public(stale)["legal_accepted"] is False

    missing = dict(user)
    missing.pop("legal_version")
    assert server.user_public(missing)["legal_accepted"] is False



def test_admin_control_surfaces_require_2fa():
    import pytest
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc:
        server._enforce_admin_2fa({"role": "admin", "totp_enabled": False})
    assert exc.value.status_code == 403
    assert "2FA" in exc.value.detail

    with pytest.raises(HTTPException) as exc:
        server._enforce_admin_2fa({"role": "superadmin"})
    assert exc.value.status_code == 403

    assert server._enforce_admin_2fa({"role": "admin", "totp_enabled": True})["role"] == "admin"
    assert server._enforce_admin_2fa({"role": "user", "totp_enabled": False})["role"] == "user"


def test_in_flight_driver_reservation_cannot_be_reclaimed():
    now = datetime(2026, 9, 29, 3, 0, tzinfo=timezone.utc)
    assert server._recent_driver_reservation((now - timedelta(seconds=1)).isoformat(), now)
    assert server._recent_driver_reservation((now - timedelta(seconds=119)).isoformat(), now)
    assert not server._recent_driver_reservation((now - timedelta(seconds=121)).isoformat(), now)
    assert not server._recent_driver_reservation(None, now)


def test_fleet_admin_entry_also_requires_2fa():
    import asyncio
    import pytest
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc:
        asyncio.run(server.require_fleet_owner({"role": "superadmin", "totp_enabled": False}))
    assert exc.value.status_code == 403


def test_health_returns_503_when_mongo_is_unavailable(monkeypatch):
    import asyncio

    class FailedDB:
        async def command(self, *_):
            raise TimeoutError("Mongo unavailable")

    monkeypatch.setattr(server, "db", FailedDB())
    response = asyncio.run(server.health())
    assert response.status_code == 503
    assert b'"db":false' in response.body


def test_request_logging_does_not_expose_password_reset_token(capsys):
    import asyncio
    from fastapi.responses import JSONResponse

    secret = "RESET-TOKEN-DO-NOT-LOG"
    request = Request({
        "type": "http", "method": "GET",
        "path": f"/api/auth/reset-password/{secret}", "headers": [],
    })

    async def respond(_):
        return JSONResponse({"ok": True})

    response = asyncio.run(server.request_id_middleware(request, respond))
    assert response.status_code == 200
    assert response.headers.get("X-Request-ID")
    assert secret not in capsys.readouterr().err
