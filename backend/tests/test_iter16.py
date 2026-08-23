"""KJAPP Iter 16 — Demo driver simulator + heading field in /api/cars/nearby.

Tests:
  1. 6 demo_drivers seeded in db.users with demo=true, role=driver, approved=true, online=true
  2. /api/cars/nearby returns at least 3 cars (Oslo center) with valid heading field (0..360, numeric)
  3. Demo drivers appear in /api/cars/nearby (their last_lat/last_lng within Oslo bbox)
  4. Cruise task updates positions (poll twice with 7s gap and confirm at least one car moved)
"""
import os
import time
import math
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

MONGO = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
DB = MONGO[os.environ.get("DB_NAME", "kjapp")]

OSLO = {"lat": 59.9139, "lng": 10.7522, "vehicle_type": "ai-first"}


def test_demo_drivers_seeded_in_db():
    """6 demo_drivers must exist in db.users with demo=true, role=driver, approved=true."""
    demos = list(DB.users.find({"demo": True, "role": "driver"}))
    assert len(demos) >= 6, f"expected >=6 demo drivers, found {len(demos)}"
    for d in demos:
        assert d.get("approved") is True, f"demo driver {d.get('email')} not approved"
        assert d.get("online") is True, f"demo driver {d.get('email')} not online"
        assert d.get("last_lat") is not None and d.get("last_lng") is not None, \
            f"demo driver {d.get('email')} missing GPS"


def test_cars_nearby_returns_min_3_with_heading():
    """POST /api/cars/nearby returns >=3 cars, each with numeric heading in [0,360]."""
    r = requests.post(f"{API}/cars/nearby", json=OSLO, timeout=15)
    assert r.status_code == 200, r.text
    cars = r.json().get("cars", [])
    assert len(cars) >= 3, f"expected >=3 cars near Oslo center, got {len(cars)}"
    for c in cars:
        assert "heading" in c, f"car {c.get('id')} missing heading"
        h = c["heading"]
        assert isinstance(h, (int, float)), f"heading not numeric: {h!r}"
        assert 0 <= h <= 360, f"heading out of range: {h}"
        assert "lat" in c and "lng" in c
        # Must be near Oslo (very loose bbox)
        assert 59.7 < c["lat"] < 60.1 and 10.5 < c["lng"] < 11.0, \
            f"car {c.get('id')} outside Oslo bbox: {c['lat']},{c['lng']}"


def test_demo_drivers_visible_in_cars_nearby():
    """At least some of the 6 demo drivers should be returned by /api/cars/nearby."""
    demo_ids = {str(d["_id"]) for d in DB.users.find({"demo": True, "role": "driver"}, {"_id": 1})}
    r = requests.post(f"{API}/cars/nearby", json=OSLO, timeout=15)
    cars = r.json().get("cars", [])
    car_ids = {c["id"] for c in cars}
    overlap = demo_ids & car_ids
    assert len(overlap) >= 3, f"expected >=3 demo drivers in nearby response, got {len(overlap)}"


def test_cruise_task_moves_drivers():
    """Positions should change between two polls 7s apart (cruise loop is 6s)."""
    r1 = requests.post(f"{API}/cars/nearby", json=OSLO, timeout=15).json().get("cars", [])
    positions_1 = {c["id"]: (c["lat"], c["lng"]) for c in r1}
    time.sleep(7)
    r2 = requests.post(f"{API}/cars/nearby", json=OSLO, timeout=15).json().get("cars", [])
    positions_2 = {c["id"]: (c["lat"], c["lng"]) for c in r2}
    moved = 0
    for cid, p1 in positions_1.items():
        p2 = positions_2.get(cid)
        if p2 and (abs(p1[0] - p2[0]) > 1e-6 or abs(p1[1] - p2[1]) > 1e-6):
            moved += 1
    assert moved >= 1, f"no demo drivers moved in 7s — cruise task may be stopped ({moved}/{len(positions_1)})"
