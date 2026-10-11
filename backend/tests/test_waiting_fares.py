import ast
import asyncio
import copy
import html
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

import mongomock
import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from waiting_fares import waiting_policy, waiting_charge, waiting_start_fields
from test_ride_reservations import fixture, Collection


@pytest.mark.parametrize("category", ["ai-first", "enkelt", "trygg", "premium"])
def test_categories_inherit_global_rate_and_allow_independent_override(category):
    cfg = {"waiting_per_minute": 4, "vehicle_rates": {category: {"waiting_per_minute": 7}}}
    policy = waiting_policy(cfg, category)
    assert policy["per_minute"] == 7
    assert waiting_charge(policy, 300)["waiting_fee_total"] == 21
    assert waiting_policy({"waiting_per_minute": 4}, category)["per_minute"] == 4


@pytest.mark.parametrize("seconds,fee", [(0,0), (119,0), (120,0), (135,1), (180,4), (300,12), (3600,60)])
def test_two_free_minutes_prorated_waiting_and_disclosed_cap(seconds, fee):
    assert waiting_charge(waiting_policy({}, "ai-first"), seconds)["waiting_fee_total"] == fee


def test_policy_token_changes_when_terms_change_and_zero_rates_are_valid():
    a = waiting_policy({}, "premium")
    b = waiting_policy({"waiting_per_minute": 0}, "premium")
    assert a["token"] != b["token"]
    assert waiting_charge(b, 900)["waiting_fee_total"] == 0
    with pytest.raises(ValueError): waiting_policy({"waiting_per_minute": float("nan")}, "premium")


def opted_trip(trip):
    now = datetime.now(timezone.utc)
    policy = waiting_policy({}, "ai-first")
    return {**trip, "quoted_ride_price": trip["price"], "waiting_policy": policy,
            "waiting_policy_accepted_at": now.isoformat(),
            "reservation_limit_ore": (trip["price"] + policy["max_fee"]) * 100,
            "at_pickup_at": (now - timedelta(minutes=5)).isoformat()}


def test_legacy_rides_do_not_gain_an_undisclosed_waiting_fee():
    assert waiting_start_fields({"price": 173}, datetime.now(timezone.utc)) == {}
    trip = {"price": 173, "waiting_policy": waiting_policy({}, "ai-first")}
    assert waiting_start_fields(trip, datetime.now(timezone.utc)) == {}


def test_waiting_uses_snapshotted_category_not_a_later_admin_change():
    now = datetime.now(timezone.utc)
    policy = waiting_policy({"vehicle_rates": {"premium": {"waiting_per_minute": 8}}}, "premium")
    trip = {"price": 200, "quoted_ride_price": 200, "waiting_policy": policy,
            "waiting_policy_accepted_at": now.isoformat(), "authorized_amount_ore": 32000,
            "at_pickup_at": (now - timedelta(minutes=5)).isoformat()}
    assert waiting_start_fields(trip, now)["price"] == 224
    trip["authorized_amount_ore"] = 20000
    with pytest.raises(ValueError): waiting_start_fields(trip, now)


def test_waiting_hold_captures_only_actual_total_once_and_releases_unused_amount():
    async def check():
        service, trip, raw, intents, events, receipts = fixture()
        trip = opted_trip(trip)
        raw.trips.replace_one({"trip_id": "t"}, copy.deepcopy(trip))
        await service.authorize(trip)
        saved = raw.trips.find_one({"trip_id": "t"})
        assert saved["authorized_amount_ore"] == 23300
        now = datetime.fromisoformat(trip["at_pickup_at"]) + timedelta(minutes=5)
        fields = waiting_start_fields(saved, now)
        assert fields["waiting_fee_total"] == 12 and fields["price"] == 185
        raw.trips.update_one({"trip_id": "t"}, {"$set": {**fields, "status": "arrived"}})
        assert (await service.capture(trip))["paid"]
        assert (await service.capture(trip))["paid"]
        assert intents.captures == 1
        pi = next(iter(intents.objects.values()))
        assert pi["amount"] == 23300 and pi["amount_received"] == 18500 and pi["amount_capturable"] == 0
        assert receipts and raw.trips.find_one({"trip_id":"t"})["payment_status"] == "paid"
    asyncio.run(check())


def test_buffer_cannot_be_reserved_without_customer_acceptance():
    async def check():
        service, trip, raw, intents, _, _ = fixture()
        trip["reservation_limit_ore"] = 30000
        with pytest.raises(HTTPException): await service.authorize(trip)
        assert intents.creates == 0
    asyncio.run(check())


def extracted(name, globals):
    """Execute the real route function with isolated dependencies and no live DB/email."""
    tree = ast.parse((Path(__file__).resolve().parents[1] / "server.py").read_text())
    node = next(n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name == name)
    node.decorator_list = []
    for i in range(len(node.args.defaults)): node.args.defaults[i] = ast.Constant(None)
    exec(compile(ast.fix_missing_locations(ast.Module(body=[node], type_ignores=[])), "route", "exec"), globals)
    return globals[name]


def test_driver_start_freezes_waiting_atomically_and_retries_do_not_add_it_twice():
    async def check():
        service, trip, raw, _, _, _ = fixture()
        trip = opted_trip(trip)
        trip.update(status="payment_authorizing", pickup_lat=59.91, pickup_lng=10.75)
        raw.trips.replace_one({"trip_id":"t"}, copy.deepcopy(trip))
        await service.authorize(trip)
        raw.trips.update_one({"trip_id":"t"}, {"$set":{"status":"at_pickup"}})
        async def push(*args): pass
        env = {"db": service.db, "_real_trip_filter": lambda query: query,
               "_fresh_driver_location": lambda timestamp: True, "haversine_km": lambda *args: 0,
               "PICKUP_ARRIVAL_RADIUS_M": 200, "ride_reservations": service,
               "datetime": datetime, "timezone": timezone, "waiting_start_fields": waiting_start_fields,
               "HTTPException": HTTPException, "send_push_to_user": push}
        start = extracted("driver_start", env)
        current = {"id":trip["driver_id"], "last_lat":59.91,"last_lng":10.75}
        await start("t", current)
        first = raw.trips.find_one({"trip_id":"t"})
        assert first["price"] == 185 and first["waiting_fee_total"] == 12
        assert (await start("t", current))["already_applied"]
        assert raw.trips.find_one({"trip_id":"t"})["price"] == 185
        with pytest.raises(HTTPException): await start("t", {**current, "id":"another-driver"})
    asyncio.run(check())


def test_application_documents_must_belong_to_the_application():
    async def check():
        raw = mongomock.MongoClient().db
        db = SimpleNamespace(uploaded_files=Collection(raw.uploaded_files))
        validate = extracted("_validate_fleet_application_uploads", {"db":db,"HTTPException":HTTPException})
        docs = {}
        for kind in ("firmaattest","loyvebevis","vognkort","forsikring","bank"):
            docs[kind] = {"path":kind}
            raw.uploaded_files.insert_one({"storage_path":kind,"application_token":"own", "scope":"fleet-applications"})
        await validate("own", docs)
        with pytest.raises(HTTPException): await validate("other", docs)
        raw.uploaded_files.update_one({"storage_path":"bank"}, {"$set":{"is_deleted":True}})
        with pytest.raises(HTTPException): await validate("own", docs)
    asyncio.run(check())


def test_approval_email_contains_authenticated_fleet_entry_and_escapes_input():
    template = extracted("_fleet_application_decision_html", {"Optional":__import__("typing").Optional, "html_escape":html})
    message = template("<script>bad</script>", True, "<img src=x>", "temporary")
    assert 'href="https://fleet.snarapp.no/login"' in message and "Stripe" in message
    assert "<script>" not in message and "<img src=x>" not in message
