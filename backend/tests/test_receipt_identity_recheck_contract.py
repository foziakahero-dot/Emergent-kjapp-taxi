import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SERVER = ROOT / "backend" / "server.py"


def _source() -> str:
    return SERVER.read_text(encoding="utf-8")


def test_receipt_ledger_contract_and_python_syntax():
    source = _source()
    ast.parse(source)
    for marker in (
        "async def ensure_receipt_snapshot",
        'db.receipt_ledger.update_one',
        '@api.get("/admin/receipts")',
        '@api.get("/admin/receipts/{receipt_or_trip}")',
        '@api.post("/admin/receipts/backfill")',
        '"receipt_id": t.get("receipt_id")',
        '"refunds": {',
    ):
        assert marker in source


def test_receipt_snapshot_preserves_accounting_fields():
    source = _source()
    for marker in (
        '"receipt_number": receipt_number',
        '"gross_amount": price',
        '"commission_rate": commission',
        '"platform_fee": platform_fee',
        '"fleet_net": max(0, price - platform_fee)',
        '"stripe_payment_intent_id"',
        '"paid_at": paid_at',
        '"backfilled": bool(backfilled)',
        'db.receipt_ledger.create_index("trip_id", unique=True)',
        'db.receipt_ledger.create_index("receipt_number", unique=True)',
        'if trip.get("payment_status") == "paid" and not trip.get("receipt_id")',
        'await ensure_receipt_snapshot(trip_id)',
    ):
        assert marker in source


def test_driver_identity_recheck_is_risk_based_and_trip_safe():
    source = _source()
    for marker in (
        "KJAPP_IDENTITY_RECHECK_MIN_DAYS",
        "KJAPP_IDENTITY_RECHECK_MAX_DAYS",
        "KJAPP_IDENTITY_INACTIVITY_DAYS",
        "async def _apply_driver_identity_risk",
        'risk_trigger = "scheduled"',
        'risk_trigger = "long_inactivity"',
        'risk_trigger = "new_device"',
        'identity_recheck_pending_reason',
        'active_trip = bool(user.get("active_trip_id"))',
        '"identity_verification_status": "recheck_required"',
        '@api.post("/admin/drivers/{driver_id}/identity-recheck")',
    ):
        assert marker in source


def test_identity_verification_schedules_next_check_and_never_auto_onlines_driver():
    source = _source()
    assert "next_check_at = _schedule_identity_recheck_at()" in source
    assert '"identity_verified_at": now' in source
    assert 'user_set["online"] = False' in source
    assert 'recheck_gate = identity_status in ("recheck_required", "retry_required")' in source
    assert '"online": False if body.status != "verified" else True' not in source


def test_driver_login_supports_privacy_safe_installation_signal():
    source = _source()
    tree = ast.parse(source)
    login_model = next(
        node for node in ast.walk(tree)
        if isinstance(node, ast.ClassDef) and node.name == "LoginRequest"
    )
    annotated = {node.target.id for node in login_model.body if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name)}
    assert {"email", "password", "client", "device_id"}.issubset(annotated)


def test_paid_receipt_preserves_booked_zero_and_promo_commission():
    """Exercise commission resolution and immutable snapshots with paid in-memory trips."""
    import asyncio
    import datetime
    import re
    import typing
    import sys
    import uuid

    sys.path.insert(0, str(SERVER.parent))
    from promo_credits import platform_fee_ore

    source = _source()
    tree = ast.parse(source)
    functions = {
        node.name: node for node in tree.body
        if isinstance(node, ast.AsyncFunctionDef)
    }
    commission_function = functions["_commission_for_trip"]
    snapshot_function = functions["ensure_receipt_snapshot"]
    namespace = {
        "Optional": typing.Optional,
        "ObjectId": str,
        "_real_trip_filter": lambda query: query,
        "datetime": datetime.datetime,
        "timezone": datetime.timezone,
        "re": re,
        "uuid": uuid,
        "platform_fee_ore": platform_fee_ore,
    }

    async def platform_commission():
        return 0.10

    namespace["_platform_commission"] = platform_commission
    exec(
        compile(
            ast.Module(body=[commission_function, snapshot_function], type_ignores=[]),
            str(SERVER),
            "exec",
        ),
        namespace,
    )

    class Collection:
        def __init__(self, document=None):
            self.document = document

        async def find_one(self, *args, **kwargs):
            return dict(self.document) if self.document else None

        async def update_one(self, query, update, **kwargs):
            if "$setOnInsert" in update and not self.document:
                self.document = {"_id": "receipt-1", **update["$setOnInsert"]}
            if "$set" in update and self.document:
                self.document.update(update["$set"])

    class Database:
        pass

    async def check(booked_rate, expected_rate):
        db = Database()
        db.trips = Collection({
            "_id": "trip-1", "trip_id": "trip-1", "status": "completed",
            "payment_status": "paid", "price": 200, "fleet_id": "fleet-1",
            "commission_rate": booked_rate, "paid_at": "2026-09-26T18:00:00+00:00",
        })
        db.receipt_ledger = Collection()
        db.users = Collection()
        db.payment_transactions = Collection()
        db.fleets = Collection({"_id": "fleet-1", "commission_rate": 0.15})
        namespace["db"] = db

        first = await namespace["ensure_receipt_snapshot"]("trip-1")
        db.fleets.document["commission_rate"] = 0.35
        second = await namespace["ensure_receipt_snapshot"]("trip-1")
        expected_fee = int(round(200 * expected_rate))
        assert first["commission_rate"] == expected_rate
        assert first["platform_fee"] == expected_fee
        assert first["fleet_net"] == 200 - expected_fee
        assert second["receipt_number"] == first["receipt_number"]
        assert second["commission_rate"] == expected_rate
        assert second["platform_fee"] == expected_fee
        assert db.trips.document["receipt_id"] == first["receipt_number"]

    for booked_rate, expected_rate in ((0, 0), (0.05, 0.05), (None, 0.10)):
        asyncio.run(check(booked_rate, expected_rate))
