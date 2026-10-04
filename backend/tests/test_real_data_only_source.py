"""KJAPP real-data-only source invariants.

These tests deliberately inspect source code rather than a seeded runtime database.
They protect the beta rule: no fabricated trips, routes, ETA, nearby supply, or pickup location
may be presented as operational data.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def test_backend_has_no_trip_simulator_or_route_fabrication():
    src = read("backend/server.py")
    assert "def fallback_route_points" not in src
    assert "async def progress_trip" not in src
    assert '"demo_trips": True' not in src
    assert '"synthetic": {"$ne": True}' in src
    assert "Synthetic test traffic is NEVER offered to live supply." in src
    assert 'routing_source": "osrm"' in src


def test_customer_has_no_fake_pickup_or_eta():
    home = read("frontend/app/(app)/home.tsx")
    booking = read("frontend/app/booking/[tripId].tsx")

    assert "useState<{ lat: number; lng: number }>(OSLO)" not in home
    assert "eta_min || 3" not in home
    assert "eta_min || 2" not in booking
    assert "vi bruker Oslo sentrum inntil videre" not in home
    assert "routeReady" in home
    assert "KJAPP trenger din faktiske GPS-posisjon" in home


def test_mobile_maps_never_draw_straight_line_as_route_fallback():
    for rel in (
        "frontend/src/components/InteractiveMap.tsx",
        "driver-app/src/components/InteractiveMap.tsx",
    ):
        src = read(rel)
        assert "[[pickup.lng, pickup.lat], [dropoff.lng, dropoff.lat]]" not in src
        assert "Never invent a straight-line" in src


def test_driver_gps_does_not_manufacture_zero_heading_or_speed():
    home = read("driver-app/app/(driver)/home.tsx")
    api = read("driver-app/src/lib/api.ts")

    assert "coords.heading || 0" not in home
    assert "coords.speed || 0" not in home
    assert "heading = 0, speed = 0" not in api


def test_synthetic_lifecycle_script_is_blocked_from_live_by_default():
    src = read("backend/scripts/e2e_driver_flow.py")
    assert "KJAPP_E2E_ISOLATED" in src
    assert "may not run against beta/live" in src
