"""Quotes, new ride terms and historical settlements use the applicable fee policy."""
import asyncio
import io
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

from bson import ObjectId
import pytest
from test_mobile_commerce import Database
from test_phase2c_dispatch_identity_projection import server, AsyncCursor
from openpyxl import load_workbook
from admin_control_center import stripe_destination_for_trip
from test_ride_reservations import fixture as reservation_fixture


class BookingCollection:
    def __init__(self, raw): self.raw = raw
    async def find_one(self, *args, **kwargs): return self.raw.find_one(*args, **kwargs)
    async def update_one(self, *args, **kwargs): return self.raw.update_one(*args, **kwargs)
    async def count_documents(self, *args, **kwargs): return self.raw.count_documents(*args, **kwargs)
    async def insert_one(self, *args, **kwargs): return self.raw.insert_one(*args, **kwargs)
    def find(self, *args, **kwargs): return AsyncCursor(self.raw.find(*args, **kwargs))


@pytest.mark.parametrize(("environment", "fee_test_enabled", "expected_rate"), [
    ("qa", False, 0.0), ("qa", True, .12), ("production", True, 0.0),
])
def test_quote_and_booking_snapshot_match(monkeypatch, environment, fee_test_enabled, expected_rate):
    monkeypatch.setattr(server, "APP_ENV", environment)
    monkeypatch.setenv("QA_PER_RIDE_FEE_TEST_ENABLED", str(fee_test_enabled).lower())
    monkeypatch.setenv("NATIVE_PAYMENTS_ENABLED", "true")
    monkeypatch.setenv("STRIPE_PUBLISHABLE_KEY", "pk_test_fixture")
    db, uid = Database(), ObjectId()
    db.raw.users.insert_one({"_id": uid})
    db.raw.platform_settings.insert_one({"_id": "singleton", "default_commission": .12})
    db.raw.payment_methods.insert_one({"user_id": str(uid), "verified": True,
        "setup_status": "succeeded", "stripe_payment_method_id": "pm_fixture", "stripe_livemode": False})
    monkeypatch.setattr(server, "db", SimpleNamespace(**{name: BookingCollection(db.raw[name]) for name in (
        'users', 'platform_settings', 'payment_methods', 'trips')}))
    monkeypatch.setattr(server.stripe, "api_key", "sk_test_fixture")
    monkeypatch.setattr(server, "_require_launch_pickup", lambda *_: None)
    monkeypatch.setattr(server, "osrm_route_points", AsyncMock(return_value={"distance_km": 2, "duration_min": 6, "geometry": None}))
    monkeypatch.setattr(server, "active_pricing", AsyncMock(return_value=server.DEFAULT_PRICING))
    monkeypatch.setattr(server, "ride_reservations", SimpleNamespace(authorize=AsyncMock()))
    body = server.TripRequest(pickup_address="Oslo", pickup_lat=59.91, pickup_lng=10.75,
        dropoff_address="Majorstuen", dropoff_lat=59.93, dropoff_lng=10.71, vehicle_type="ai-first")
    quote = asyncio.run(server.trip_estimate(server.EstimateRequest(**body.model_dump())))
    result = asyncio.run(server.request_trip(body, {"id": str(uid), "legal_accepted": True}))
    assert result["commission_rate"] == quote["commission_rate"] == expected_rate
    assert result["commission_source"] == ("qa_per_ride_v1" if expected_rate else "subscription_v1")
    assert result["business_model"] == ("per_ride" if expected_rate else "subscription")
    assert result["payment_flow"] == "reservation"
    assert db.raw.platform_settings.find_one()["default_commission"] == .12


@pytest.mark.parametrize("trip_rate", [0.0, .12])
def test_actual_settlement_resolver_uses_trip_snapshot_over_changed_fleet_rate(trip_rate):
    db, fid, did = Database(), ObjectId(), ObjectId()
    db.raw.users.insert_one({"_id": did, "role": "driver", "fleet_id": str(fid)})
    db.raw.fleets.insert_one({"_id": fid, "stripe_account_id": "acct_fixture", "commission_rate": .2})
    stripe = SimpleNamespace(api_key="sk_test_fixture", Account=SimpleNamespace(retrieve=Mock(return_value={
        "id": "acct_fixture", "details_submitted": True, "payouts_enabled": True})))
    destination = asyncio.run(stripe_destination_for_trip(db, stripe, {"driver_id": str(did), "commission_rate": trip_rate}))
    assert destination["commission_rate"] == trip_rate
    assert db.raw.fleets.find_one()["commission_rate"] == .2


def test_card_capture_uses_twelve_percent_for_the_platform_and_retries_the_same_transfer():
    async def check():
        service, trip, raw, intents, _, _ = reservation_fixture()
        trip.update(price=123, fleet_id="test-fleet", commission_rate=.12)
        raw.trips.update_one({"trip_id": trip["trip_id"]}, {"$set": {
            "price": 123, "fleet_id": trip["fleet_id"], "commission_rate": .12,
        }})
        transfers = Mock()
        transfers.create.return_value = {"id": "tr_fixture"}
        service.client = lambda: SimpleNamespace(v1=SimpleNamespace(payment_intents=intents, transfers=transfers))
        service.destination = AsyncMock(return_value={
            "fleet_id": trip["fleet_id"], "stripe_account_id": "acct_fixture", "commission_rate": .12,
        })
        await service.authorize(trip)
        raw.trips.update_one({"trip_id": trip["trip_id"]}, {"$set": {"status": "arrived"}})
        assert (await service.capture(trip))["paid"]
        assert (await service.capture(trip))["paid"]
        assert intents.captures == 1
        assert transfers.create.call_count >= 1
        for call in transfers.create.call_args_list:
            params, options = call.args
            assert params["amount"] == 10824 and params["currency"] == "nok"
            assert params["destination"] == "acct_fixture" and params["source_transaction"] == "ch_test"
            assert options["idempotency_key"] == f"snar-fleet-transfer-{trip['trip_id']}"
        transaction = await service.record(trip)
        assert transaction["platform_fee"] == 14.76 and transaction["fleet_net"] == 108.24

    asyncio.run(check())


def test_monthly_export_keeps_zero_commission_alongside_historical_fee(monkeypatch):
    db, fid, did = Database(), ObjectId(), ObjectId()
    db.raw.fleets.insert_one({"_id": fid, "name": "Fixture", "commission_rate": .2})
    db.raw.users.insert_one({"_id": did, "role": "driver", "fleet_id": str(fid)})
    for price, rate in [(100, 0.0), (200, .12)]:
        db.raw.trips.insert_one({"fleet_id": str(fid), "driver_id": str(did), "status": "completed",
            "payment_status": "paid", "created_at": "2026-10-01T12:00:00+00:00", "price": price, "commission_rate": rate})
    monkeypatch.setattr(server, "db", SimpleNamespace(**{name: BookingCollection(db.raw[name]) for name in ('fleets', 'users', 'trips')}))
    monkeypatch.setattr(server, "get_fleet_id_for", AsyncMock(return_value=str(fid)))
    response = asyncio.run(server.fleet_export_monthly(2026, 10, {"id": "fixture"}))
    workbook = load_workbook(io.BytesIO(response.body), data_only=True)
    assert workbook['Sammendrag']['B5'].value == 300
    assert workbook['Sammendrag']['B6'].value == 24
    assert workbook['Sammendrag']['B7'].value == 276
    assert workbook['Sjåfører']['G2'].value == 24
    assert workbook['Sjåfører']['H2'].value == 276
