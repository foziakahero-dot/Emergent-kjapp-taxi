import asyncio
import base64
import hashlib
import hmac
import sys
from datetime import datetime, timedelta, timezone
from email.utils import format_datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import mongomock
import pytest
from bson import ObjectId
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from business_payment import business_card
from customer_trip_context import confirmed_driver_identity, pickup_call_due
from travel_context import parse_flights, transit_options
from vipps_payment import SECRETS, VippsReservations, valid_webhook, vipps_configured


def test_pickup_call_requires_customer_choice_fresh_gps_and_road_eta():
    trip = {"status": "driver_on_way", "pickup_call_requested": True,
            "customer": {"phone": "fixture"}, "pickup_route": {"duration_min": 1.9}}
    assert pickup_call_due(trip, True)
    assert not pickup_call_due(trip, False)
    assert not pickup_call_due({**trip, "pickup_route": {"duration_min": 2.5}}, True)
    assert not pickup_call_due({**trip, "pickup_call_requested": False}, True)
    assert not pickup_call_due({**trip, "status": "at_pickup"}, True)


def test_identity_badge_needs_review_and_disappears_when_recheck_is_due():
    async def run():
        raw = mongomock.MongoClient().db
        db = SimpleNamespace(users=AsyncMock(wraps=raw.users),
                             driver_identity_verifications=AsyncMock(wraps=raw.driver_identity_verifications))
        now = datetime.now(timezone.utc)
        verified_at = (now - timedelta(days=1)).isoformat()
        driver_id = raw.users.insert_one({"role": "driver", "approved": True, "identity_verification_status": "verified",
            "identity_verified_at": verified_at, "next_identity_check_at": (now + timedelta(days=1)).isoformat()}).inserted_id
        assert not await confirmed_driver_identity(db, str(driver_id), now)
        raw.driver_identity_verifications.insert_one({"driver_user_id": str(driver_id), "reviewed_at": verified_at,
                                                     "status": "verified", "reviewed_by": "qa-reviewer"})
        assert await confirmed_driver_identity(db, str(driver_id), now)
        assert not await confirmed_driver_identity(db, str(driver_id), now + timedelta(days=1))
    asyncio.run(run())


def test_business_card_is_scoped_to_owner_mode_and_an_ordinary_card():
    async def run():
        raw = mongomock.MongoClient().db
        db = SimpleNamespace(payment_methods=AsyncMock(wraps=raw.payment_methods))
        stripe = SimpleNamespace(api_key="sk_test_fixture")
        fields = {"user_id": "owner", "verified": True, "setup_status": "succeeded", "stripe_payment_method_id": "pm_fixture"}
        own = raw.payment_methods.insert_one(fields.copy()).inserted_id
        wallet = raw.payment_methods.insert_one({**fields, "wallet": "google_pay"}).inserted_id
        live = raw.payment_methods.insert_one({**fields, "stripe_livemode": True}).inserted_id
        assert await business_card(db, stripe, "owner", str(own))
        assert not await business_card(db, stripe, "other", str(own))
        assert not await business_card(db, stripe, "owner", str(wallet))
        assert not await business_card(db, stripe, "owner", str(live))
    asyncio.run(run())


def test_public_travel_parses_avinor_actual_feed_fields_and_rejects_graphql_errors():
    sample = b"""<airport name="OSL"><flights><flight><flight_id>DY823</flight_id>
    <schedule_time>2026-11-18T20:30:00Z</schedule_time><arr_dep>A</arr_dep><airport>ARN</airport>
    <status code="A" time="2026-11-18T20:23:00Z"/></flight></flights></airport>"""
    flight = parse_flights(sample)[0]
    assert flight["number"] == "DY823"
    assert flight["estimated_at"] == "2026-11-18T20:23:00+00:00"
    with pytest.raises(ValueError):
        transit_options({"errors": [{"message": "provider error"}]}, datetime.now(timezone.utc))


@pytest.fixture
def vipps_qa(monkeypatch):
    monkeypatch.setenv("APP_ENV", "qa")
    monkeypatch.setenv("QA_VIPPS_ENABLED", "true")
    for key in SECRETS:
        monkeypatch.setenv(key, "fixture")
    monkeypatch.setenv("QA_VIPPS_MERCHANT_SERIAL_NUMBER", "123456")


def test_vipps_gate_needs_qa_and_all_provider_credentials(vipps_qa, monkeypatch):
    assert vipps_configured()
    monkeypatch.delenv("QA_VIPPS_WEBHOOK_SECRET")
    assert not vipps_configured()
    monkeypatch.setenv("QA_VIPPS_WEBHOOK_SECRET", "fixture")
    monkeypatch.setenv("APP_ENV", "production")
    assert not vipps_configured()


def test_vipps_webhook_covers_body_and_path_and_expires():
    body = b'{"name":"AUTHORIZED"}'
    now = datetime.now(timezone.utc)
    stamp = format_datetime(now, usegmt=True)
    host, path, secret = "api-qa.snarapp.no", "/api/payments/vipps/webhook", "fixture"
    body_hash = base64.b64encode(hashlib.sha256(body).digest()).decode()
    signature = base64.b64encode(hmac.new(secret.encode(), f"POST\n{path}\n{stamp};{host};{body_hash}".encode(), hashlib.sha256).digest()).decode()
    headers = {"host": host, "x-ms-date": stamp, "x-ms-content-sha256": body_hash,
               "authorization": "HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=" + signature}
    assert valid_webhook(headers, path, body, secret, now)
    assert not valid_webhook(headers, path, body + b" ", secret, now)
    assert not valid_webhook(headers, path + "?replay=true", body, secret, now)
    assert not valid_webhook(headers, path, body, secret, now + timedelta(minutes=6))


def test_vipps_only_dispatches_confirmed_holds_and_captures_once(vipps_qa):
    async def run():
        raw = mongomock.MongoClient().db
        db = SimpleNamespace(**{name: AsyncMock(wraps=raw[name]) for name in ("trips", "payment_transactions")})
        trip = {"trip_id": str(uuid4()), "user_id": "passenger", "status": "payment_authorizing",
                "price": 156, "reservation_limit_ore": 18000, "payment_provider": "vipps"}
        raw.trips.insert_one(trip.copy())
        reference = trip["trip_id"]
        remote = {"state": None, "authorized": 0, "captured": 0, "cancelled": 0, "refunded": 0}

        def money(value):
            return {"currency": "NOK", "value": value}

        async def provider(method, ref, path="", *, payload=None, operation=None, missing_ok=False):
            assert ref == reference
            if method == "GET":
                if remote["state"] is None:
                    assert missing_ok
                    return None
                return {"state": remote["state"], "reference": ref, "amount": money(18000), "aggregate": {
                    name + "Amount": money(remote[name]) for name in ("authorized", "captured", "cancelled", "refunded")}}
            if operation == f"create-{reference}":
                assert payload["amount"] == money(18000)
                remote["state"] = "CREATED"
                return {"reference": ref, "redirectUrl": "https://landing.vipps.no/qa-fixture"}
            if path == "/capture":
                assert remote["captured"] == 0
                remote["captured"] = payload["modificationAmount"]["value"]
            else:
                assert path == "/cancel"
                remote["cancelled"] = remote["authorized"] - remote["captured"]
            return {}

        request = AsyncMock(side_effect=provider)
        dispatch = AsyncMock()

        async def paid(ref, user):
            raw.trips.update_one({"trip_id": ref, "user_id": user}, {"$set": {"payment_status": "paid", "status": "completed"}})

        service = VippsReservations(db, dispatch=dispatch, mark_paid=paid, receipts=AsyncMock(), client=SimpleNamespace(request=request))
        with pytest.raises(HTTPException) as redirect:
            await service.authorize(trip)
        assert redirect.value.detail["code"] == "vipps_redirect_required"
        with pytest.raises(HTTPException):
            await service.confirm(trip)
        dispatch.assert_not_awaited()
        remote.update(state="AUTHORIZED", authorized=18000)
        assert (await service.confirm(trip))["status"] == "searching"
        dispatch.assert_awaited_once()
        with pytest.raises(HTTPException):
            await service.capture(trip)
        await service.require_reserved(trip)
        raw.trips.update_one({"trip_id": reference}, {"$set": {"status": "arrived"}})
        assert (await service.capture(trip))["paid"]
        assert remote["captured"] == 15600 and remote["cancelled"] == 2400
        assert (await service.capture(trip)) == {"attempted": False, "paid": True}
        assert raw.payment_transactions.find_one({"trip_id": reference})["test_mode"] is True
    asyncio.run(run())
