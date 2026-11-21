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

import httpx
import mongomock
import pytest
from bson import ObjectId
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from business_payment import business_card
from customer_trip_context import confirmed_driver_identity, pickup_call_due
from driver_document_identity import PROOF
from travel_context import AVINOR_URL, PublicTravel, parse_flights, transit_options
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


def test_identity_badge_accepts_only_live_document_proof_reviewed_for_the_current_verification():
    async def run():
        raw = mongomock.MongoClient().db
        db = SimpleNamespace(users=AsyncMock(wraps=raw.users),
                             driver_identity_verifications=AsyncMock(wraps=raw.driver_identity_verifications))
        now = datetime.now(timezone.utc)
        stamp = (now - timedelta(days=1)).isoformat()
        driver_id = raw.users.insert_one({
            "role": "driver", "approved": True, "identity_verification_status": "verified",
            "identity_verified_at": stamp, PROOF: {"status": "verified", "livemode": False},
        }).inserted_id
        assert not await confirmed_driver_identity(db, str(driver_id), now)
        raw.users.update_one({"_id": driver_id}, {"$set": {f"{PROOF}.livemode": True}})
        assert not await confirmed_driver_identity(db, str(driver_id), now)
        raw.users.update_one({"_id": driver_id}, {"$set": {f"{PROOF}.reviewed_at": stamp, f"{PROOF}.reviewed_by": "reviewer"}})
        assert await confirmed_driver_identity(db, str(driver_id), now)
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


def test_avinor_codeshares_use_oslo_calendar_date_and_a_single_cached_feed():
    queries = []
    xml = """<airport name="OSL"><flights>
    <flight><flight_id>AY911</flight_id><schedule_time>2026-11-21T23:15:00Z</schedule_time>
    <arr_dep>A</arr_dep><airport>HEL</airport><delayed>Y</delayed>
    <codeshareairlinedesignators>BA;QR;JL</codeshareairlinedesignators>
    <codeshareflightnumbers>6071;6145;9359</codeshareflightnumbers>
    <codeshareoperationalsuffixs>;A;</codeshareoperationalsuffixs></flight>
    <flight><flight_id>AY912</flight_id><schedule_time>2026-11-22T11:15:00Z</schedule_time>
    <arr_dep>D</arr_dep><airport>HEL</airport></flight>
    </flights></airport>"""

    def feed(request):
        queries.append(request)
        return httpx.Response(200, text=xml)

    async def run():
        travel = PublicTravel(client_factory=lambda **kwargs: httpx.AsyncClient(transport=httpx.MockTransport(feed), **kwargs))
        found = await travel.flight("QR6145A", "A", "2026-11-22")
        assert found["flight"]["number"] == "AY911"
        assert found["flight"]["requested_number"] == "QR6145A"
        assert found["flight"]["delayed"] is True
        assert (await travel.flight("BA6071", "A", "2026-11-21"))["flight"] is None
        departure = await travel.flight("AY912", "D", "2026-11-22")
        assert departure["flight"]["number"] == "AY912"
        assert departure["as_of"] == found["as_of"]

    asyncio.run(run())
    assert len(queries) == 1
    assert str(queries[0].url.copy_with(query=None)) == AVINOR_URL
    assert dict(queries[0].url.params) == {"airport": "OSL", "TimeFrom": "26", "TimeTo": "49", "codeshare": "Y"}


def test_avinor_failure_respects_refresh_window_without_false_missing_status():
    fetches = 0

    def feed(_request):
        nonlocal fetches
        fetches += 1
        return httpx.Response(503)

    async def run():
        travel = PublicTravel(client_factory=lambda **kwargs: httpx.AsyncClient(transport=httpx.MockTransport(feed), **kwargs))
        for error in (httpx.HTTPStatusError, ValueError):
            with pytest.raises(error):
                await travel.flight("SK123", "A", "2026-11-21")

    asyncio.run(run())
    assert fetches == 1


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
