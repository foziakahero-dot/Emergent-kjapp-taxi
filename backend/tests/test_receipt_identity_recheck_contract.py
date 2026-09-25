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
