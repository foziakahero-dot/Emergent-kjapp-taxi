from pathlib import Path
import ast

SERVER = Path(__file__).resolve().parents[1] / "server.py"
SOURCE = SERVER.read_text(encoding="utf-8")


def test_server_syntax_after_real_trip_hardening():
    ast.parse(SOURCE)


def test_canonical_real_trip_filter_is_comprehensive():
    required = [
        'SYNTHETIC_TRIP_ID_RE',
        '"demo": {"$ne": True}',
        '"is_demo": {"$ne": True}',
        '"trip_id": {"$not": {"$regex": SYNTHETIC_TRIP_ID_RE}}',
        '"pickup_address": {"$not": {"$regex": SYNTHETIC_ADDRESS_RE}}',
        '"dropoff_address": {"$not": {"$regex": SYNTHETIC_ADDRESS_RE}}',
        'def _real_trip_filter(extra: Optional[dict] = None)',
    ]
    for marker in required:
        assert marker in SOURCE, marker


def test_operational_trip_surfaces_use_real_trip_filter():
    required = [
        'cursor = db.trips.find(_real_trip_filter({"user_id": current["id"]}))',
        'db.trips.find(_real_trip_filter({"driver_id": driver_id, "rating": {"$gt": 0}}))',
        'async for t in db.trips.find(_real_trip_filter({\n        "driver_id": driver_id,',
        'async for t in db.trips.find(_real_trip_filter({\n            "driver_id": {"$in": drivers_ids},',
        'async for t in db.trips.find(_real_trip_filter({\n            "driver_id": {"$in": driver_ids},',
        'async for t in db.trips.find(_real_trip_filter()).sort("created_at", -1).limit(limit)',
    ]
    for marker in required:
        assert marker in SOURCE, marker


def test_startup_purge_catches_flagged_and_prefixed_synthetic_trips():
    required = [
        '{"demo": True}',
        '{"is_demo": True}',
        '{"trip_id": {"$regex": SYNTHETIC_TRIP_ID_RE}}',
        '{"pickup_address": {"$regex": SYNTHETIC_ADDRESS_RE}}',
        '{"dropoff_address": {"$regex": SYNTHETIC_ADDRESS_RE}}',
    ]
    purge = SOURCE[SOURCE.index("async def purge_synthetic_data"):SOURCE.index("def create_access_token")]
    for marker in required:
        assert marker in purge, marker


def test_demo_data_is_opt_in_and_never_defaults_on():
    block = SOURCE[SOURCE.index("def demo_data_enabled"):SOURCE.index("def compute_cors_origins")]
    assert 'allowed_envs = {"development", "dev", "test", "local"}' in block
    assert "if env not in allowed_envs:" in block
    assert "if flag is None:\n        return False" in block
    assert 'return str(flag).strip().lower() in ("1", "true", "yes", "on")' in block


def test_shared_runtime_disables_legacy_demo_accounts_when_demo_mode_is_off():
    startup = SOURCE[SOURCE.index("# Shared beta/staging/prod"):SOURCE.index("# Nearest-driver-first dispatch")]
    assert "if not ENABLE_DEMO_DATA:" in startup
    assert "disable_legacy_demo_users(db, True, admin_email)" in startup


def test_public_seed_places_never_impersonate_user_home_or_work():
    startup = SOURCE[SOURCE.index("# seed places"):SOURCE.index("# seed admin")]
    assert '"label": "Hjem"' not in startup
    assert '"label": "Jobb"' not in startup
    assert '{"slug": "karl-johans", "label": "Hjem"}' in startup
    assert '{"slug": "aker-brygge", "label": "Jobb"}' in startup
    assert '"label": "Karl Johan"' in startup
    assert '"label": "Aker Brygge"' in startup


def test_dev_seed_accounts_are_explicitly_marked_demo():
    startup = SOURCE[SOURCE.index("# seed test user (demo only)"):SOURCE.index("# ---- Simulated")]
    assert startup.count('"demo": True') >= 2
    assert startup.count('"is_demo": True') >= 2
