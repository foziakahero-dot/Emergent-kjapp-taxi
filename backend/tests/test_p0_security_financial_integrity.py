"""P0 security + financial integrity regression tests.

These tests exercise the real server functions against a temporary MongoDB.
No pytest-asyncio dependency is required; each test owns one event loop.
"""
import asyncio
import os
import sys
import uuid
from types import SimpleNamespace

import pyotp
import pytest
from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from starlette.requests import Request
from starlette.responses import Response

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("DB_NAME", "kjapp_test")
os.environ.setdefault("JWT_SECRET", "p0-test-secret-that-is-long-enough-for-hs256")
os.environ.setdefault("APP_ENV", "development")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import server  # noqa: E402
from financial_integrity import build_commission_snapshot, resolve_commission_snapshot  # noqa: E402


MONGO_URL = os.environ["MONGO_URL"]


def _run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _request(token=None, path="/api/auth/login"):
    headers = []
    if token:
        headers.append((b"authorization", f"Bearer {token}".encode()))
    return Request({
        "type": "http",
        "http_version": "1.1",
        "method": "POST",
        "scheme": "https",
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "headers": headers,
        "client": ("127.0.0.1", 12345),
        "server": ("testserver", 443),
    })


class _WebhookRequest:
    headers = {"stripe-signature": "test-signature"}

    async def body(self):
        return b"{}"


async def _with_temp_db(test_body):
    client = AsyncIOMotorClient(MONGO_URL)
    name = f"kjapp_p0_integrity_{uuid.uuid4().hex[:10]}"
    tdb = client[name]
    original = server.db
    server.db = tdb
    try:
        await test_body(tdb)
    finally:
        server.db = original
        await client.drop_database(name)
        client.close()


async def _seed_admin(tdb, *, email="owner@example.no", password="Strong-Pass-123!", totp=False):
    doc = {
        "email": email,
        "password_hash": server.hash_password(password),
        "fullName": "P0 Admin",
        "role": "superadmin",
        "created_at": "2026-09-19T00:00:00+00:00",
    }
    if totp:
        secret = pyotp.random_base32()
        doc.update({
            "totp_enabled": True,
            "totp_secret": secret,
            "totp_backup_codes": [],
        })
    else:
        secret = None
    res = await tdb.users.insert_one(doc)
    return str(res.inserted_id), secret


# ---------------------------------------------------------------------------
# A. Mandatory admin 2FA
# ---------------------------------------------------------------------------

def test_admin_without_2fa_gets_enrollment_not_access_session():
    async def body(tdb):
        await _seed_admin(tdb)
        res = await server.login(
            server.LoginRequest(email="owner@example.no", password="Strong-Pass-123!"),
            _request(),
            Response(),
        )
        assert res["twofa_setup_required"] is True
        assert res.get("twofa_token")
        assert "token" not in res
    _run(_with_temp_db(body))


def test_admin_enrollment_then_totp_session_and_audit():
    async def body(tdb):
        await _seed_admin(tdb)
        login = await server.login(
            server.LoginRequest(email="owner@example.no", password="Strong-Pass-123!"),
            _request(),
            Response(),
        )
        setup = await server.twofa_enroll_setup(
            server.TwoFAEnrollSetupRequest(twofa_token=login["twofa_token"])
        )
        code = pyotp.TOTP(setup["secret"]).now()
        enabled = await server.twofa_enroll_enable(
            server.TwoFAEnrollEnableRequest(twofa_token=login["twofa_token"], code=code),
            _request(),
            Response(),
        )
        assert enabled.get("token")
        assert enabled["enabled"] is True
        assert len(enabled.get("backup_codes") or []) == 8

        me = await server.get_current_user(_request(enabled["token"], "/api/auth/me"))
        assert me["role"] == "superadmin"
        assert me["totp_enabled"] is True

        actions = [x["action"] async for x in tdb.audit_events.find({})]
        assert "auth.2fa_setup" in actions
        assert "auth.2fa_success" in actions
    _run(_with_temp_db(body))


def test_pre_enrollment_admin_token_stays_revoked_after_enrollment():
    async def body(tdb):
        uid, _ = await _seed_admin(tdb)
        legacy_token = server.create_access_token(uid, "owner@example.no")
        login = await server.login(
            server.LoginRequest(email="owner@example.no", password="Strong-Pass-123!"),
            _request(),
            Response(),
        )
        setup = await server.twofa_enroll_setup(
            server.TwoFAEnrollSetupRequest(twofa_token=login["twofa_token"])
        )
        enabled = await server.twofa_enroll_enable(
            server.TwoFAEnrollEnableRequest(
                twofa_token=login["twofa_token"],
                code=pyotp.TOTP(setup["secret"]).now(),
            ),
            _request(),
            Response(),
        )
        assert enabled.get("token")
        with pytest.raises(HTTPException) as exc:
            await server.get_current_user(_request(legacy_token, "/api/admin/overview"))
        assert exc.value.status_code == 401
        fresh = await server.get_current_user(_request(enabled["token"], "/api/admin/overview"))
        assert fresh["role"] == "superadmin"
    _run(_with_temp_db(body))


def test_admin_with_totp_wrong_code_fails_correct_code_succeeds():
    async def body(tdb):
        _, secret = await _seed_admin(tdb, totp=True)
        login = await server.login(
            server.LoginRequest(email="owner@example.no", password="Strong-Pass-123!"),
            _request(),
            Response(),
        )
        assert login["twofa_required"] is True

        actual = pyotp.TOTP(secret).now()
        wrong = "111111" if actual == "000000" else "000000"
        with pytest.raises(HTTPException) as exc:
            await server.twofa_verify_login(
                server.TwoFAVerifyLoginRequest(twofa_token=login["twofa_token"], code=wrong),
                _request(),
                Response(),
            )
        assert exc.value.status_code == 401

        fresh = await server.login(
            server.LoginRequest(email="owner@example.no", password="Strong-Pass-123!"),
            _request(),
            Response(),
        )
        ok = await server.twofa_verify_login(
            server.TwoFAVerifyLoginRequest(twofa_token=fresh["twofa_token"], code=actual),
            _request(),
            Response(),
        )
        assert ok.get("token")
        assert await tdb.audit_events.count_documents({"action": "auth.2fa_failed"}) == 1
        assert await tdb.audit_events.count_documents({"action": "auth.2fa_success"}) == 1
    _run(_with_temp_db(body))


def test_backup_code_is_single_use():
    async def body(tdb):
        _, secret = await _seed_admin(tdb, totp=True)
        backup = "abcd-1234"
        await tdb.users.update_one(
            {"email": "owner@example.no"},
            {"$set": {"totp_backup_codes": [server.hash_password(backup)]}},
        )

        login1 = await server.login(
            server.LoginRequest(email="owner@example.no", password="Strong-Pass-123!"),
            _request(),
            Response(),
        )
        first = await server.twofa_verify_login(
            server.TwoFAVerifyLoginRequest(twofa_token=login1["twofa_token"], code=backup),
            _request(),
            Response(),
        )
        assert first.get("token")

        login2 = await server.login(
            server.LoginRequest(email="owner@example.no", password="Strong-Pass-123!"),
            _request(),
            Response(),
        )
        with pytest.raises(HTTPException) as exc:
            await server.twofa_verify_login(
                server.TwoFAVerifyLoginRequest(twofa_token=login2["twofa_token"], code=backup),
                _request(),
                Response(),
            )
        assert exc.value.status_code == 401
        assert await tdb.audit_events.count_documents({"action": "auth.2fa_backup_used"}) == 1
    _run(_with_temp_db(body))


def test_legacy_admin_access_token_without_totp_is_rejected():
    async def body(tdb):
        uid, _ = await _seed_admin(tdb)
        token = server.create_access_token(uid, "owner@example.no")
        with pytest.raises(HTTPException) as exc:
            await server.get_current_user(_request(token, "/api/admin/overview"))
        assert exc.value.status_code == 401
    _run(_with_temp_db(body))


def test_pre_enrollment_admin_session_stays_revoked_after_2fa_enable():
    async def body(tdb):
        uid, _ = await _seed_admin(tdb)
        legacy = server.create_access_token(uid, "owner@example.no")

        login = await server.login(
            server.LoginRequest(email="owner@example.no", password="Strong-Pass-123!"),
            _request(),
            Response(),
        )
        setup = await server.twofa_enroll_setup(
            server.TwoFAEnrollSetupRequest(twofa_token=login["twofa_token"])
        )
        enabled = await server.twofa_enroll_enable(
            server.TwoFAEnrollEnableRequest(
                twofa_token=login["twofa_token"],
                code=pyotp.TOTP(setup["secret"]).now(),
            ),
            _request(),
            Response(),
        )
        assert enabled.get("token")

        # A token minted before mandatory enrollment must never become privileged
        # merely because the account now has TOTP enabled.
        with pytest.raises(HTTPException) as exc:
            await server.get_current_user(_request(legacy, "/api/admin/overview"))
        assert exc.value.status_code == 401

        fresh = await server.get_current_user(_request(enabled["token"], "/api/admin/overview"))
        assert fresh["role"] == "superadmin"

    _run(_with_temp_db(body))


def test_old_admin_token_is_rejected_even_when_account_already_has_totp():
    async def body(tdb):
        uid, secret = await _seed_admin(tdb, totp=True)

        # Simulates a privileged JWT minted before mandatory session-level MFA.
        old = server.create_access_token(uid, "owner@example.no")
        decoded_old = server.jwt.decode(old, server.JWT_SECRET, algorithms=[server.JWT_ALGORITHM])
        assert decoded_old.get("twofa_verified") is not True
        with pytest.raises(HTTPException) as exc:
            await server.get_current_user(_request(old, "/api/admin/overview"))
        assert exc.value.status_code == 401

        login = await server.login(
            server.LoginRequest(email="owner@example.no", password="Strong-Pass-123!"),
            _request(),
            Response(),
        )
        verified = await server.twofa_verify_login(
            server.TwoFAVerifyLoginRequest(
                twofa_token=login["twofa_token"],
                code=pyotp.TOTP(secret).now(),
            ),
            _request(),
            Response(),
        )
        decoded_new = server.jwt.decode(
            verified["token"], server.JWT_SECRET, algorithms=[server.JWT_ALGORITHM]
        )
        assert decoded_new["twofa_verified"] is True
        current = await server.get_current_user(
            _request(verified["token"], "/api/admin/overview")
        )
        assert current["role"] == "superadmin"

    _run(_with_temp_db(body))


def test_customer_login_remains_single_factor():
    async def body(tdb):
        await tdb.users.insert_one({
            "email": "customer@example.no",
            "password_hash": server.hash_password("Customer-Pass-123!"),
            "fullName": "Customer",
            "role": "user",
        })
        res = await server.login(
            server.LoginRequest(email="customer@example.no", password="Customer-Pass-123!"),
            _request(),
            Response(),
        )
        assert res.get("token")
        assert not res.get("twofa_required")
        assert not res.get("twofa_setup_required")
    _run(_with_temp_db(body))


# ---------------------------------------------------------------------------
# B. Refund idempotency + atomic reservation
# ---------------------------------------------------------------------------

async def _seed_refundable_trip(tdb, trip_id="trip-refund", price=100, *, fleet_id=None, snapshot=None):
    trip = {
        "trip_id": trip_id,
        "user_id": "customer-1",
        "driver_id": "driver-1",
        "status": "arrived",
        "price": price,
        "payment_status": "paid",
        "refunded_total": 0,
        "created_at": "2026-09-19T00:00:00+00:00",
    }
    if snapshot:
        trip["commission_snapshot"] = snapshot
    await tdb.trips.insert_one(trip)
    tx = {
        "session_id": f"cs_{trip_id}",
        "trip_id": trip_id,
        "user_id": "customer-1",
        "amount": price,
        "currency": "nok",
        "payment_status": "paid",
        "stripe_payment_intent_id": f"pi_{trip_id}",
        "updated_at": "2026-09-19T00:01:00+00:00",
    }
    if fleet_id:
        tx["fleet_id"] = fleet_id
        tx["settlement_model"] = "stripe_destination_charge"
    if snapshot:
        tx["commission_snapshot"] = snapshot
        tx["commission_rate"] = snapshot["commission_rate"]
    await tdb.payment_transactions.insert_one(tx)


def _fake_refund_success(calls):
    def create(**kwargs):
        calls.append(kwargs)
        return {"id": "re_test_1", "status": "succeeded"}
    return create


def test_refund_requires_idempotency_key(monkeypatch):
    async def body(tdb):
        await _seed_refundable_trip(tdb)
        monkeypatch.setattr(server.stripe, "api_key", "sk_test_p0")
        admin = {"id": "admin-1", "email": "admin@example.no", "role": "superadmin"}
        with pytest.raises(HTTPException) as exc:
            await server.admin_create_refund(
                server.RefundRequest(trip_id="trip-refund", amount=10, reason="Missing key"),
                admin,
                None,
            )
        assert exc.value.status_code == 400
        assert await tdb.refunds.count_documents({}) == 0
    _run(_with_temp_db(body))


def test_refund_same_key_is_exactly_once(monkeypatch):
    async def body(tdb):
        await _seed_refundable_trip(tdb)
        calls = []
        monkeypatch.setattr(server.stripe, "api_key", "sk_test_p0")
        monkeypatch.setattr(server.stripe.Refund, "create", staticmethod(_fake_refund_success(calls)))

        req = server.RefundRequest(trip_id="trip-refund", amount=40, reason="P0 test")
        admin = {"id": "admin-1", "email": "admin@example.no", "role": "superadmin"}
        first = await server.admin_create_refund(req, admin, "refund-key-1")
        second = await server.admin_create_refund(req, admin, "refund-key-1")

        assert first["status"] == "succeeded"
        assert second["id"] == first["id"]
        assert len(calls) == 1
        assert calls[0]["idempotency_key"] == "refund-key-1"
        trip = await tdb.trips.find_one({"trip_id": "trip-refund"})
        assert trip["refunded_total"] == 40
        assert int(trip.get("refund_pending_total") or 0) == 0
        assert await tdb.refunds.count_documents({"trip_id": "trip-refund"}) == 1
    _run(_with_temp_db(body))


def test_two_parallel_refunds_cannot_overrefund(monkeypatch):
    async def body(tdb):
        await _seed_refundable_trip(tdb, price=100)
        calls = []
        monkeypatch.setattr(server.stripe, "api_key", "sk_test_p0")
        monkeypatch.setattr(server.stripe.Refund, "create", staticmethod(_fake_refund_success(calls)))
        admin = {"id": "admin-1", "email": "admin@example.no", "role": "superadmin"}

        results = await asyncio.gather(
            server.admin_create_refund(
                server.RefundRequest(trip_id="trip-refund", amount=80, reason="A"),
                admin,
                "refund-A",
            ),
            server.admin_create_refund(
                server.RefundRequest(trip_id="trip-refund", amount=80, reason="B"),
                admin,
                "refund-B",
            ),
            return_exceptions=True,
        )
        successes = [r for r in results if isinstance(r, dict) and r.get("status") == "succeeded"]
        conflicts = [r for r in results if isinstance(r, HTTPException) and r.status_code == 409]
        assert len(successes) == 1
        assert len(conflicts) == 1
        assert len(calls) == 1

        trip = await tdb.trips.find_one({"trip_id": "trip-refund"})
        assert trip["refunded_total"] == 80
        assert int(trip.get("refund_pending_total") or 0) == 0
    _run(_with_temp_db(body))


def test_refund_timeout_can_retry_same_provider_operation(monkeypatch):
    class FakeConnectionError(Exception):
        pass

    async def body(tdb):
        await _seed_refundable_trip(tdb)
        provider_keys = []
        monkeypatch.setattr(server.stripe, "api_key", "sk_test_p0")
        monkeypatch.setattr(server.stripe.error, "APIConnectionError", FakeConnectionError)

        def timeout_create(**kwargs):
            provider_keys.append(kwargs["idempotency_key"])
            raise FakeConnectionError("timeout")

        monkeypatch.setattr(server.stripe.Refund, "create", staticmethod(timeout_create))
        admin = {"id": "admin-1", "email": "admin@example.no", "role": "superadmin"}
        req = server.RefundRequest(trip_id="trip-refund", amount=30, reason="Timeout test")

        with pytest.raises(HTTPException) as exc:
            await server.admin_create_refund(req, admin, "refund-timeout")
        assert exc.value.status_code == 503

        pending = await tdb.refunds.find_one({"idempotency_key": "refund-timeout"})
        trip = await tdb.trips.find_one({"trip_id": "trip-refund"})
        assert pending["status"] == "pending"
        assert trip["refund_pending_total"] == 30
        assert trip.get("refunded_total", 0) == 0

        def success_create(**kwargs):
            provider_keys.append(kwargs["idempotency_key"])
            return {"id": "re_timeout_same_operation", "status": "succeeded"}

        monkeypatch.setattr(server.stripe.Refund, "create", staticmethod(success_create))
        retried = await server.admin_create_refund(req, admin, "refund-timeout")
        assert retried["status"] == "succeeded"
        assert provider_keys == ["refund-timeout", "refund-timeout"]

        trip = await tdb.trips.find_one({"trip_id": "trip-refund"})
        assert trip["refunded_total"] == 30
        assert int(trip.get("refund_pending_total") or 0) == 0
    _run(_with_temp_db(body))


def test_repeated_refund_provider_event_does_not_double_count(monkeypatch):
    async def body(tdb):
        await _seed_refundable_trip(tdb)
        calls = []
        monkeypatch.setattr(server.stripe, "api_key", "sk_test_p0")
        monkeypatch.setattr(server.stripe.Refund, "create", staticmethod(_fake_refund_success(calls)))
        admin = {"id": "admin-1", "email": "admin@example.no", "role": "superadmin"}
        await server.admin_create_refund(
            server.RefundRequest(trip_id="trip-refund", amount=25, reason="Webhook test"),
            admin,
            "refund-webhook",
        )
        doc = await tdb.refunds.find_one({"idempotency_key": "refund-webhook"})
        await server._apply_refund_provider_state(doc, doc["provider_ref"], "succeeded")
        await server._apply_refund_provider_state(doc, doc["provider_ref"], "succeeded")
        trip = await tdb.trips.find_one({"trip_id": "trip-refund"})
        assert trip["refunded_total"] == 25
    _run(_with_temp_db(body))


def test_refund_cannot_exceed_remaining_balance(monkeypatch):
    async def body(tdb):
        await _seed_refundable_trip(tdb, price=100)
        await tdb.trips.update_one({"trip_id": "trip-refund"}, {"$set": {"refunded_total": 90}})
        monkeypatch.setattr(server.stripe, "api_key", "sk_test_p0")
        admin = {"id": "admin-1", "email": "admin@example.no", "role": "superadmin"}
        with pytest.raises(HTTPException) as exc:
            await server.admin_create_refund(
                server.RefundRequest(trip_id="trip-refund", amount=20, reason="Too much"),
                admin,
                "refund-too-much",
            )
        assert exc.value.status_code == 400
        assert await tdb.refunds.count_documents({"idempotency_key": "refund-too-much"}) == 0
    _run(_with_temp_db(body))


# ---------------------------------------------------------------------------
# C. Checkout idempotency
# ---------------------------------------------------------------------------

async def _seed_checkout_trip(tdb, trip_id="trip-checkout", price=100):
    await tdb.platform_settings.update_one(
        {"_id": "singleton"},
        {"$set": {"default_commission": 0.10}},
        upsert=True,
    )
    await tdb.trips.insert_one({
        "trip_id": trip_id,
        "user_id": "customer-1",
        "status": "arrived",
        "price": price,
        "payment_status": "pending",
        "created_at": "2026-09-19T00:00:00+00:00",
    })


def _fake_checkout_success(calls):
    def create(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(id="cs_test_once", url="https://checkout.stripe.test/cs_test_once")
    return create


def test_parallel_checkout_requests_create_one_provider_session(monkeypatch):
    async def body(tdb):
        await _seed_checkout_trip(tdb)
        calls = []
        monkeypatch.setattr(server.stripe, "api_key", "sk_test_p0")
        monkeypatch.setattr(server.stripe.checkout.Session, "create", staticmethod(_fake_checkout_success(calls)))
        req = server.TripCheckoutRequest(trip_id="trip-checkout", origin_url="https://kjappapp.no")
        current = {"id": "customer-1", "role": "user"}

        first, second = await asyncio.gather(
            server.create_trip_checkout(req, current, "client-key-A"),
            server.create_trip_checkout(req, current, "client-key-B"),
        )
        assert len(calls) == 1
        assert first["session_id"] == second["session_id"] == "cs_test_once"
        assert await tdb.payment_transactions.count_documents({"trip_id": "trip-checkout"}) == 1
        assert calls[0]["idempotency_key"].startswith("checkout:trip-checkout:")
    _run(_with_temp_db(body))


def test_checkout_timeout_retries_same_stripe_key(monkeypatch):
    class FakeConnectionError(Exception):
        pass

    async def body(tdb):
        await _seed_checkout_trip(tdb)
        keys = []
        monkeypatch.setattr(server.stripe, "api_key", "sk_test_p0")
        monkeypatch.setattr(server.stripe.error, "APIConnectionError", FakeConnectionError)

        def timeout_create(**kwargs):
            keys.append(kwargs["idempotency_key"])
            raise FakeConnectionError("timeout")
        monkeypatch.setattr(server.stripe.checkout.Session, "create", staticmethod(timeout_create))

        req = server.TripCheckoutRequest(trip_id="trip-checkout", origin_url="https://kjappapp.no")
        current = {"id": "customer-1", "role": "user"}
        with pytest.raises(HTTPException) as exc:
            await server.create_trip_checkout(req, current, "client-retry")
        assert exc.value.status_code == 503

        def success_create(**kwargs):
            keys.append(kwargs["idempotency_key"])
            return SimpleNamespace(id="cs_retry", url="https://checkout.stripe.test/cs_retry")
        monkeypatch.setattr(server.stripe.checkout.Session, "create", staticmethod(success_create))
        result = await server.create_trip_checkout(req, current, "different-client-key-is-ignored")
        assert result["session_id"] == "cs_retry"
        assert len(keys) == 2
        assert keys[0] == keys[1]
    _run(_with_temp_db(body))


def test_checkout_rejects_paid_cancelled_invalid_and_changed_price(monkeypatch):
    async def body(tdb):
        calls = []
        monkeypatch.setattr(server.stripe, "api_key", "sk_test_p0")
        monkeypatch.setattr(server.stripe.checkout.Session, "create", staticmethod(_fake_checkout_success(calls)))
        current = {"id": "customer-1", "role": "user"}

        await _seed_checkout_trip(tdb, "trip-paid", 100)
        await tdb.trips.update_one({"trip_id": "trip-paid"}, {"$set": {"payment_status": "paid"}})
        with pytest.raises(HTTPException) as exc:
            await server.create_trip_checkout(
                server.TripCheckoutRequest(trip_id="trip-paid", origin_url="https://kjappapp.no"),
                current,
                "paid",
            )
        assert exc.value.status_code == 400

        await _seed_checkout_trip(tdb, "trip-cancelled", 100)
        await tdb.trips.update_one({"trip_id": "trip-cancelled"}, {"$set": {"status": "cancelled"}})
        with pytest.raises(HTTPException) as exc:
            await server.create_trip_checkout(
                server.TripCheckoutRequest(trip_id="trip-cancelled", origin_url="https://kjappapp.no"),
                current,
                "cancelled",
            )
        assert exc.value.status_code == 400

        await _seed_checkout_trip(tdb, "trip-zero", 0)
        with pytest.raises(HTTPException) as exc:
            await server.create_trip_checkout(
                server.TripCheckoutRequest(trip_id="trip-zero", origin_url="https://kjappapp.no"),
                current,
                "zero",
            )
        assert exc.value.status_code == 400

        await _seed_checkout_trip(tdb, "trip-price", 100)
        first = await server.create_trip_checkout(
            server.TripCheckoutRequest(trip_id="trip-price", origin_url="https://kjappapp.no"),
            current,
            "price-1",
        )
        assert first["session_id"]
        await tdb.trips.update_one({"trip_id": "trip-price"}, {"$set": {"price": 120}})
        with pytest.raises(HTTPException) as exc:
            await server.create_trip_checkout(
                server.TripCheckoutRequest(trip_id="trip-price", origin_url="https://kjappapp.no"),
                current,
                "price-2",
            )
        assert exc.value.status_code == 409
    _run(_with_temp_db(body))


def test_checkout_webhook_is_retry_safe(monkeypatch):
    async def body(tdb):
        await _seed_checkout_trip(tdb)
        calls = []
        monkeypatch.setattr(server.stripe, "api_key", "sk_test_p0")
        monkeypatch.setattr(server.stripe.checkout.Session, "create", staticmethod(_fake_checkout_success(calls)))
        current = {"id": "customer-1", "role": "user"}
        checkout = await server.create_trip_checkout(
            server.TripCheckoutRequest(trip_id="trip-checkout", origin_url="https://kjappapp.no"),
            current,
            "webhook-key",
        )

        event = {
            "type": "checkout.session.completed",
            "data": {"object": {
                "id": checkout["session_id"],
                "payment_status": "paid",
                "amount_total": 10000,
                "currency": "nok",
                "payment_intent": "pi_paid_once",
                "metadata": {"trip_id": "trip-checkout", "user_id": "customer-1"},
            }},
        }
        monkeypatch.setattr(server.stripe.Webhook, "construct_event", staticmethod(lambda payload, sig, secret: event))
        await server.stripe_webhook(_WebhookRequest())
        await server.stripe_webhook(_WebhookRequest())

        tx = await tdb.payment_transactions.find_one({"session_id": checkout["session_id"]})
        trip = await tdb.trips.find_one({"trip_id": "trip-checkout"})
        assert tx["payment_status"] == "paid"
        assert tx["stripe_payment_intent_id"] == "pi_paid_once"
        assert trip["payment_status"] == "paid"
        assert trip["checkout_state"] == "paid"
    _run(_with_temp_db(body))


# ---------------------------------------------------------------------------
# D. Authoritative commission snapshot
# ---------------------------------------------------------------------------

def test_commission_snapshot_is_immutable_and_fleet_specific():
    async def body(tdb):
        fleet = await tdb.fleets.insert_one({"name": "Fleet 12", "commission_rate": 0.12})
        fid = str(fleet.inserted_id)
        driver = await tdb.users.insert_one({"email": "driver@example.no", "role": "driver", "fleet_id": fid})
        did = str(driver.inserted_id)
        await tdb.trips.insert_one({
            "trip_id": "trip-commission",
            "driver_id": did,
            "driver_user_id": did,
            "status": "arrived",
            "price": 100,
            "created_at": "2026-09-19T00:00:00+00:00",
        })
        trip = await tdb.trips.find_one({"trip_id": "trip-commission"})
        snap = await resolve_commission_snapshot(tdb, trip, 0.10, persist=True)
        assert snap["commission_rate"] == pytest.approx(0.12)
        assert snap["commission_amount"] == 12
        assert snap["driver_amount"] == 88
        assert snap["fleet_net_amount"] == 88
        assert snap["fleet_id"] == fid
        assert snap["calculation_version"] == "commission-v1"

        await tdb.fleets.update_one({"_id": fleet.inserted_id}, {"$set": {"commission_rate": 0.10}})
        trip2 = await tdb.trips.find_one({"trip_id": "trip-commission"})
        unchanged = await resolve_commission_snapshot(tdb, trip2, 0.10, persist=False)
        assert unchanged["commission_rate"] == pytest.approx(0.12)
        assert unchanged["commission_amount"] == 12
    _run(_with_temp_db(body))


def test_commission_fallback_and_historical_payment_basis():
    async def body(tdb):
        no_fleet = {
            "trip_id": "legacy-no-fleet",
            "price": 200,
            "created_at": "2026-01-01T00:00:00+00:00",
        }
        snap = await resolve_commission_snapshot(tdb, no_fleet, 0.10, persist=False)
        assert snap["commission_rate"] == pytest.approx(0.10)
        assert snap["commission_amount"] == 20

        await tdb.payment_transactions.insert_one({
            "session_id": "cs_hist",
            "trip_id": "legacy-paid",
            "amount": 100,
            "currency": "nok",
            "commission_rate": 0.12,
            "fleet_id": "legacy-fleet",
            "updated_at": "2026-02-01T00:00:00+00:00",
        })
        historical = await resolve_commission_snapshot(
            tdb,
            {"trip_id": "legacy-paid", "price": 100, "created_at": "2026-02-01T00:00:00+00:00"},
            0.10,
            persist=False,
        )
        assert historical["commission_rate"] == pytest.approx(0.12)
        assert historical["commission_amount"] == 12
        assert historical["driver_amount"] == 88
        assert historical["source"] == "payment_transaction"
    _run(_with_temp_db(body))


def test_stripe_uses_frozen_fleet_after_driver_moves(monkeypatch):
    async def body(tdb):
        old_fleet = await tdb.fleets.insert_one({
            "name": "Old Fleet",
            "commission_rate": 0.12,
            "stripe_account_id": "acct_old",
        })
        new_fleet = await tdb.fleets.insert_one({
            "name": "New Fleet",
            "commission_rate": 0.10,
            "stripe_account_id": "acct_new",
        })
        old_fid, new_fid = str(old_fleet.inserted_id), str(new_fleet.inserted_id)
        driver = await tdb.users.insert_one({
            "email": "moved@example.no",
            "role": "driver",
            "fleet_id": new_fid,
        })
        did = str(driver.inserted_id)
        snap = build_commission_snapshot(100, 0.12, fleet_id=old_fid, source="fleet")
        trip = {
            "trip_id": "trip-moved-driver",
            "driver_id": did,
            "driver_user_id": did,
            "price": 100,
            "commission_snapshot": snap,
        }
        monkeypatch.setattr(server.stripe, "api_key", "sk_test_p0")
        seen = []
        monkeypatch.setattr(
            server.stripe.Account,
            "retrieve",
            staticmethod(lambda account_id: (
                seen.append(account_id)
                or {
                    "id": account_id,
                    "details_submitted": True,
                    "charges_enabled": True,
                    "payouts_enabled": True,
                    "requirements": {},
                }
            )),
        )
        destination = await server.stripe_destination_for_trip(tdb, server.stripe, trip)
        assert destination["fleet_id"] == old_fid
        assert destination["stripe_account_id"] == "acct_old"
        assert destination["commission_rate"] == pytest.approx(0.12)
        assert seen == ["acct_old"]
    _run(_with_temp_db(body))


def test_driver_admin_and_stripe_use_same_commission(monkeypatch):
    async def body(tdb):
        await tdb.platform_settings.insert_one({"_id": "singleton", "default_commission": 0.10})
        fleet = await tdb.fleets.insert_one({
            "name": "Fleet 12",
            "commission_rate": 0.12,
            "stripe_account_id": "acct_test_12",
        })
        fid = str(fleet.inserted_id)
        driver = await tdb.users.insert_one({
            "email": "driver@example.no",
            "role": "driver",
            "fleet_id": fid,
            "approved": True,
        })
        did = str(driver.inserted_id)
        snapshot = build_commission_snapshot(100, 0.12, fleet_id=fid, source="fleet")
        await tdb.trips.insert_one({
            "trip_id": "trip-economic-consistency",
            "user_id": "customer-1",
            "driver_id": did,
            "driver_user_id": did,
            "status": "arrived",
            "price": 100,
            "payment_status": "pending",
            "commission_snapshot": snapshot,
            "created_at": "2026-09-19T00:00:00+00:00",
        })

        payout = await server.driver_payouts({
            "id": did,
            "role": "driver",
            "approved": True,
            "fleet_id": fid,
        })
        assert payout["pending_trip_net"] == 88

        finance = await server.admin_finance(30, {"id": "admin-1", "role": "superadmin"})
        assert finance["totals"]["gmv"] == 100
        assert finance["totals"]["kjapp_revenue"] == 12

        captured = []
        monkeypatch.setattr(server.stripe, "api_key", "sk_test_p0")
        monkeypatch.setattr(
            server.stripe.Account,
            "retrieve",
            staticmethod(lambda account_id: {
                "id": account_id,
                "details_submitted": True,
                "charges_enabled": True,
                "payouts_enabled": True,
                "requirements": {},
            }),
        )
        monkeypatch.setattr(server.stripe.checkout.Session, "create", staticmethod(_fake_checkout_success(captured)))
        checkout = await server.create_trip_checkout(
            server.TripCheckoutRequest(
                trip_id="trip-economic-consistency",
                origin_url="https://kjappapp.no",
            ),
            {"id": "customer-1", "role": "user"},
            "economic-consistency",
        )
        assert checkout["session_id"] == "cs_test_once"
        payment_intent_data = captured[0]["payment_intent_data"]
        assert payment_intent_data["application_fee_amount"] == 1200

        tx = await tdb.payment_transactions.find_one({"session_id": "cs_test_once"})
        assert tx["commission_snapshot"]["commission_amount"] == 12
        assert tx["fleet_net"] == 88
    _run(_with_temp_db(body))
