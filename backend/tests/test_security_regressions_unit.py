"""Focused regressions for the beta security fixes that do not require a live MongoDB."""

import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
import pytest
from fastapi.testclient import TestClient
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


def test_parallel_dispatch_notifies_only_one_driver(monkeypatch):
    import asyncio
    from types import SimpleNamespace

    class Trips:
        def __init__(self):
            self.offer_seq = None
            self.lock = asyncio.Lock()

        async def update_one(self, query, update):
            async with self.lock:
                expected = query["$and"][1].get("offer_seq")
                if expected != self.offer_seq:
                    return SimpleNamespace(modified_count=0)
                self.offer_seq = update["$inc"]["offer_seq"]
                return SimpleNamespace(modified_count=1)

    async def candidates(*_args, **_kwargs):
        return [{"id": "driver-1", "km": 1.2}]

    ensure_started_reads = 0
    both_started = asyncio.Event()

    async def ensure_started(trip, now=None):
        nonlocal ensure_started_reads
        snapshot = {
            **trip,
            "status": "searching",
            "search_started_at": "2026-09-29T03:00:00+00:00",
            "offer_seq": None,
        }
        ensure_started_reads += 1
        if ensure_started_reads == 2:
            both_started.set()
        await both_started.wait()
        return snapshot

    async def commission(*_args):
        return 0.1

    notifications = []

    async def push(driver_id, *_args, **_kwargs):
        notifications.append(driver_id)

    trips = Trips()
    monkeypatch.setattr(server, "db", SimpleNamespace(trips=trips))
    monkeypatch.setattr(server, "_dispatch_candidates", candidates)
    monkeypatch.setattr(server, "_commission_for_trip", commission)
    monkeypatch.setattr(server, "send_push_to_user", push)
    monkeypatch.setattr(server.ride_search, "ensure_started", ensure_started)
    trip = {"trip_id": "real-trip-1", "pickup_lat": 59.9, "pickup_lng": 10.7,
            "pickup_address": "Oslo S", "dropoff_address": "Majorstuen", "price": 200}

    async def race():
        return await asyncio.gather(
            server.offer_trip_to_next_driver(trip),
            server.offer_trip_to_next_driver(trip),
        )

    assert asyncio.run(race()).count("driver-1") == 1
    assert notifications == ["driver-1"]


async def _race_driver_accepts(monkeypatch, trip_ids, driver_ids):
    import asyncio
    from types import SimpleNamespace
    from bson import ObjectId

    fleet_id = str(ObjectId())
    user_docs = {
        driver_id: {
            "_id": ObjectId(driver_id),
            "role": "driver",
            "approved": True,
            "online": True,
            "fleet_id": fleet_id,
        }
        for driver_id in set(driver_ids)
    }
    trip_docs = {
        trip_id: {
            "_id": ObjectId(),
            "trip_id": trip_id,
            "user_id": "507f1f77bcf86cd799439011",
            "status": "searching",
            "driver_id": None,
            "dispatch_mode": "broadcast",
            "pickup_lat": 59.9,
            "pickup_lng": 10.7,
            "pickup_address": "Oslo S",
            "dropoff_address": "Majorstuen",
            "price": 200,
            "vehicle_type": "ai-first",
            "special_needs": [],
        }
        for trip_id in set(trip_ids)
    }

    def extra(query):
        return query["$and"][-1] if "$and" in query else query

    class Trips:
        def __init__(self):
            self.lock = asyncio.Lock()
            self.pre_reads = 0
            self.ready = asyncio.Event()

        async def find_one(self, query, *_args, **_kwargs):
            filters = extra(query)
            trip_id = filters.get("trip_id")
            trip = trip_docs.get(trip_id)
            if (
                trip
                and filters.get("driver_id", "missing") is None
                and filters.get("status") == {"$in": ["searching", "booking"]}
            ):
                self.pre_reads += 1
                if self.pre_reads == len(trip_ids):
                    self.ready.set()
                await self.ready.wait()
                return dict(trip_docs[trip_id])
            if not trip:
                return None
            if filters.get("driver_id", trip.get("driver_id")) != trip.get("driver_id"):
                return None
            statuses = filters.get("status")
            if isinstance(statuses, dict) and trip.get("status") not in statuses.get("$in", []):
                return None
            return dict(trip)

        async def update_one(self, query, update, **_kwargs):
            filters = extra(query)
            trip = trip_docs.get(filters.get("trip_id"))
            if not trip:
                return SimpleNamespace(modified_count=0)
            if trip.get("driver_id") is not None or trip.get("status") not in ("searching", "booking"):
                return SimpleNamespace(modified_count=0)
            async with self.lock:
                if trip.get("driver_id") is not None or trip.get("status") not in ("searching", "booking"):
                    return SimpleNamespace(modified_count=0)
                trip.update(update.get("$set", {}))
                for key in update.get("$unset", {}):
                    trip.pop(key, None)
                return SimpleNamespace(modified_count=1)

    class Users:
        def __init__(self):
            self.lock = asyncio.Lock()

        async def find_one(self, query, *_args, **_kwargs):
            user = user_docs.get(str(query.get("_id")))
            return dict(user) if user else None

        async def update_one(self, query, update, **_kwargs):
            user = user_docs.get(str(query.get("_id")))
            if not user:
                return SimpleNamespace(modified_count=0)
            async with self.lock:
                if "$or" in query:
                    if user.get("active_trip_id") is not None:
                        return SimpleNamespace(modified_count=0)
                elif "active_trip_id" in query and user.get("active_trip_id") != query["active_trip_id"]:
                    return SimpleNamespace(modified_count=0)
                user.update(update.get("$set", {}))
                for key in update.get("$unset", {}):
                    user.pop(key, None)
                return SimpleNamespace(modified_count=1)

    class Fleets:
        async def find_one(self, *_args, **_kwargs):
            return {"_id": ObjectId(fleet_id), "name": "Test Fleet", "commission_rate": 0.1}

    trips = Trips()
    users = Users()
    monkeypatch.setattr(server, "db", SimpleNamespace(trips=trips, users=users, fleets=Fleets()))

    async def assigned_vehicle(*_args, **_kwargs):
        return {"_id": ObjectId(), "car": "Test car", "plate": "AB12345", "vehicle_type": "ai-first"}

    async def compliance(*_args, **_kwargs):
        return {"operational": True, "message": ""}

    async def internal_context(*_args, **_kwargs):
        return {}, None

    async def route(*_args, **_kwargs):
        return {"duration_min": 1}

    async def push(*_args, **_kwargs):
        return None

    monkeypatch.setattr(server, "_assigned_fleet_vehicle", assigned_vehicle)
    monkeypatch.setattr(server, "_driver_shift_compliance", compliance)
    monkeypatch.setattr(server, "_internal_driver_context", internal_context)
    monkeypatch.setattr(server.ride_testing, "trip_allowed", lambda *_args, **_kwargs: True)
    monkeypatch.setattr(server, "_driver_supports_special_needs", lambda *_args: True)
    monkeypatch.setattr(server, "_fresh_driver_location", lambda *_args: True)
    monkeypatch.setattr(server, "osrm_route", route)
    monkeypatch.setattr(server, "send_push_to_user", push)

    calls = [
        server.driver_accept(
            server.AcceptTripRequest(trip_id=trip_id),
            {
                "id": driver_id,
                "role": "driver",
                "online": True,
                "fleet_id": fleet_id,
                "fullName": "Test Driver",
                "last_lat": 59.9,
                "last_lng": 10.7,
                "last_location_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        for trip_id, driver_id in zip(trip_ids, driver_ids)
    ]
    return await asyncio.gather(*calls, return_exceptions=True), trip_docs, user_docs


def test_driver_accept_race_two_drivers_claim_one_trip(monkeypatch):
    import asyncio
    from bson import ObjectId
    from fastapi import HTTPException

    driver_ids = [str(ObjectId()), str(ObjectId())]
    outcomes, trips, users = asyncio.run(
        _race_driver_accepts(monkeypatch, ["shared-trip", "shared-trip"], driver_ids)
    )
    assert sum(isinstance(value, dict) for value in outcomes) == 1
    rejected = next(value for value in outcomes if isinstance(value, HTTPException))
    assert rejected.status_code == 409
    assert trips["shared-trip"]["driver_id"] in driver_ids
    assert sum(user.get("active_trip_id") == "shared-trip" for user in users.values()) == 1


def test_driver_accept_race_one_driver_cannot_claim_two_trips(monkeypatch):
    import asyncio
    from bson import ObjectId
    from fastapi import HTTPException

    driver_id = str(ObjectId())
    outcomes, trips, users = asyncio.run(
        _race_driver_accepts(monkeypatch, ["trip-a", "trip-b"], [driver_id, driver_id])
    )
    assert sum(isinstance(value, dict) for value in outcomes) == 1
    rejected = next(value for value in outcomes if isinstance(value, HTTPException))
    assert rejected.status_code == 409
    assert sum(trip["driver_id"] == driver_id for trip in trips.values()) == 1
    assert users[driver_id]["active_trip_id"] in ("trip-a", "trip-b")


def test_parallel_password_reset_claims_token_once_and_revokes_sessions(monkeypatch):
    import asyncio
    from types import SimpleNamespace
    from fastapi import HTTPException

    class ResetTokens:
        def __init__(self):
            self.used = False
            self.lock = asyncio.Lock()

        async def find_one_and_update(self, _query, update):
            async with self.lock:
                if self.used:
                    return None
                self.used = update["$set"]["used"]
                return {"user_id": "507f1f77bcf86cd799439011", "email": "user@example.no"}

    class Users:
        def __init__(self):
            self.writes = []

        async def update_one(self, query, update):
            self.writes.append((query, update))
            return SimpleNamespace(modified_count=1)

    class LoginAttempts:
        def __init__(self):
            self.deletes = []

        async def delete_many(self, query):
            self.deletes.append(query)
            return SimpleNamespace(deleted_count=1)

    tokens = ResetTokens()
    users = Users()
    attempts = LoginAttempts()
    monkeypatch.setattr(server, "db", SimpleNamespace(
        password_reset_tokens=tokens,
        users=users,
        login_attempts=attempts,
    ))

    async def no_rate_limit(*_args):
        return None

    monkeypatch.setattr(server, "_enforce_rate_limit", no_rate_limit)
    monkeypatch.setattr(server, "hash_password", lambda password: f"hashed:{password}")
    request = Request({"type": "http", "method": "POST", "path": "/auth/reset-password", "headers": []})
    body = server.ResetPasswordRequest(
        token="one-use-reset-token-with-enough-entropy",
        new_password="new-password-123",
    )

    async def race():
        return await asyncio.gather(
            server.reset_password(body, request),
            server.reset_password(body, request),
            return_exceptions=True,
        )

    outcomes = asyncio.run(race())
    assert outcomes.count({"ok": True}) == 1
    rejected = next(value for value in outcomes if isinstance(value, HTTPException))
    assert rejected.status_code == 400
    assert len(users.writes) == 1
    saved_query, saved_update = users.writes[0]
    assert saved_query == {"_id": server.ObjectId("507f1f77bcf86cd799439011")}
    assert saved_update["$set"]["password_hash"] == "hashed:new-password-123"
    assert "tokens_valid_after" in saved_update["$set"]
    assert len(attempts.deletes) == 1


@pytest.mark.parametrize("role", ["admin", "superadmin"])
@pytest.mark.parametrize("path", [
    "/api/trips/other-customer-trip/messages",
    "/api/files/private-driver-document",
])
def test_admin_sensitive_reads_fail_before_database_access(monkeypatch, role, path):
    class ForbiddenDatabase:
        def __getattr__(self, name):
            raise AssertionError("2FA denial must happen before reading sensitive data")

    current = {"id": "507f1f77bcf86cd799439011", "role": role, "totp_enabled": False}
    monkeypatch.setattr(server, "db", ForbiddenDatabase())
    monkeypatch.setitem(server.app.dependency_overrides, server.get_current_user, lambda: current)
    try:
        response = TestClient(server.app).get(path)
        assert response.status_code == 403
        assert "2FA" in response.json()["detail"]
    finally:
        server.app.dependency_overrides.pop(server.get_current_user, None)


@pytest.mark.parametrize("role", ["admin", "superadmin"])
def test_admin_2fa_status_remains_reachable_for_enrollment(monkeypatch, role):
    current = {"id": "507f1f77bcf86cd799439011", "role": role, "totp_enabled": False}
    monkeypatch.setitem(server.app.dependency_overrides, server.get_current_user, lambda: current)
    try:
        response = TestClient(server.app).get("/api/auth/2fa/status")
        assert response.status_code == 200
        assert response.json() == {"enabled": False, "required": True}
    finally:
        server.app.dependency_overrides.pop(server.get_current_user, None)
