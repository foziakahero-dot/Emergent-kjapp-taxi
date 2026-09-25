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
