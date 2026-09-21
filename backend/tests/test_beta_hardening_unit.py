"""Focused beta-hardening state and pricing regressions.

These tests avoid live MongoDB where possible and verify the pure guards/config
introduced for the KJAPP beta release.
"""
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("DB_NAME", "kjapp_test")
os.environ.setdefault("JWT_SECRET", "unit-test-secret-that-is-long-enough-for-hs256")
os.environ.setdefault("APP_ENV", "development")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import server  # noqa: E402


def test_trip_state_machine_blocks_early_completion():
    assert "completed" not in server.TRIP_ALLOWED_TRANSITIONS["searching"]
    assert "completed" not in server.TRIP_ALLOWED_TRANSITIONS["in_trip"]
    assert server.TRIP_ALLOWED_TRANSITIONS["arrived"] == {"completed"}


def test_privileged_roles_require_two_factor():
    assert server._twofa_required_role("admin")
    assert server._twofa_required_role("superadmin")
    assert server._twofa_required_role("fleet_owner")
    assert not server._twofa_required_role("driver")
    assert not server._twofa_required_role("user")


def test_password_minimum_is_ten_characters():
    with pytest.raises(Exception):
        server._validate_password("123456789")
    server._validate_password("1234567890")


def test_waiting_price_uses_only_billable_minutes():
    pricing = {
        **server.DEFAULT_PRICING,
        "base_fare": 100,
        "per_km": 0,
        "per_minute": 0,
        "waiting_per_minute": 4,
        "minimum_fare": 0,
        "surge": {"enabled": False, "manual_multiplier": 1.0, "max_multiplier": 2.0},
    }
    quote = server.calculate_price(
        0,
        "ai-first",
        0,
        pricing,
        waiting_minutes=3.5,
    )
    assert quote["waiting_minutes"] == 3.5
    assert quote["waiting_fee"] == 14
    assert quote["customer_total"] == 114


def test_server_waiting_minutes_deducts_free_window():
    pickup = datetime.now(timezone.utc) - timedelta(minutes=7)
    started = pickup + timedelta(minutes=5)
    trip = {
        "at_pickup_at": pickup.isoformat(),
        "trip_started_at": started.isoformat(),
        "pricing_snapshot": {"free_waiting_minutes": 2},
    }
    assert server._server_waiting_minutes(trip) == pytest.approx(3.0, abs=0.02)


def test_required_driver_documents_include_police_certificate():
    assert set(server.DRIVER_REQUIRED_DOC_TYPES) == {
        "drivers_license",
        "taxi_license",
        "police_certificate",
        "profile_photo",
    }


def test_vipps_is_disabled_in_source_until_full_flow_exists():
    source = Path(server.__file__).read_text(encoding="utf-8")
    assert 'return {"enabled": False, "provider": "Vipps", "reason": "not_implemented"}' in source
