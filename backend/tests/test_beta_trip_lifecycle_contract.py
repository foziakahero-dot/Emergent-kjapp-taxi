from pathlib import Path
import ast

SERVER = Path(__file__).resolve().parents[1] / "server.py"
SOURCE = SERVER.read_text(encoding="utf-8")


def _block(name: str, next_name: str | None = None) -> str:
    start = SOURCE.index(f"async def {name}")
    if next_name:
        end = SOURCE.index(f"async def {next_name}", start + 1)
    else:
        end = SOURCE.find("\nasync def ", start + 1)
        if end < 0:
            end = len(SOURCE)
    return SOURCE[start:end]


def test_server_parses_after_beta_trip_hardening():
    ast.parse(SOURCE)


def test_driver_invite_preview_resolves_canonical_fleet_vehicle():
    block = _block("get_driver_invite", "accept_driver_invite")
    required = [
        'fleet_id = inv.get("fleet_id")',
        'db.fleet_vehicles.find_one',
        '"vehicle_id": str(vehicle["_id"])',
        '"car": str(vehicle.get("car") or "")',
        '"plate": str(vehicle.get("plate") or "").upper()',
        '"vehicle_type": vehicle.get("vehicle_type") or "ai-first"',
        'if vehicle.get("assigned_driver_id")',
    ]
    for marker in required:
        assert marker in block, marker
    assert '"vehicle_id": canonical_vehicle_id' not in block


def test_driver_signup_persists_canonical_vehicle_identity():
    block = _block("accept_driver_invite", "upload_driver_doc")
    required = [
        '"vehicle_id": canonical_vehicle_id',
        '"car": canonical_car',
        '"plate": canonical_plate',
        '"vehicle_type": canonical_vehicle_type',
        '"assigned_driver_id": uid',
    ]
    for marker in required:
        assert marker in block, marker


def test_real_trip_state_machine_has_no_synthetic_transition_path():
    for name in ("driver_at_pickup", "driver_start", "driver_arrive"):
        block = _block(name)
        assert "_real_trip_filter(" in block, name


def test_accept_is_atomic_for_trip_and_driver():
    block = _block("driver_accept", "driver_current")
    required = [
        '"active_trip_id": body.trip_id',
        '"driver_id": None',
        '"status": {"$in": ["searching", "booking"]}',
        'if result.modified_count == 0',
        '"$unset": {"active_trip_id": "", "active_trip_locked_at": ""}',
    ]
    for marker in required:
        assert marker in block, marker


def test_payment_success_is_only_canonical_close_path():
    block = _block("_mark_trip_paid_and_complete", "send_trip_receipts")
    required = [
        '"payment_status": "paid"',
        '"status": "arrived"',
        '"status": "completed"',
        '"completed_at": paid_at',
        '"bonus_evaluated_at"',
    ]
    for marker in required:
        assert marker in block, marker


def test_customer_cannot_complete_unpaid_arrived_trip():
    block = _block("complete_trip", "rate_trip")
    assert 'if status == "arrived" and trip.get("payment_status") != "paid"' in block
    assert 'detail="Betalingen må være bekreftet før turen kan fullføres"' in block


def test_new_booking_starts_explicitly_unpaid():
    block = _block("request_trip", "active_trip")
    assert '"status": "searching"' in block
    assert '"payment_status": "unpaid"' in block


def test_paid_receipt_is_persisted_idempotently():
    block = _block("ensure_receipt_snapshot", "_mark_trip_paid_and_complete")
    required = [
        'if not trip or trip.get("payment_status") != "paid"',
        '{"trip_id": trip_id}',
        '"$setOnInsert": snapshot',
        '"receipt_id": receipt_number',
    ]
    for marker in required:
        assert marker in block, marker


def test_driver_and_fleet_money_views_require_paid_trips():
    for name in ("driver_summary", "driver_payouts", "fleet_overview", "fleet_drivers", "fleet_export_monthly", "admin_finance"):
        block = _block(name)
        assert '"payment_status": "paid"' in block, name


def test_late_stripe_expiry_cannot_downgrade_paid_transaction():
    block = _block("stripe_webhook")
    expiry = block[block.index('elif t == "checkout.session.expired"'):]
    assert '"payment_status": {"$ne": "paid"}' in expiry
    assert "expired_update.modified_count" in expiry


def test_customer_destination_mutation_is_real_trip_only():
    block = _block("change_trip_destination", "complete_trip")
    assert "_real_trip_filter(" in block


def test_driver_offline_cannot_race_active_trip_assignment():
    block = _block("driver_online")
    assert '"active_trip_id": {"$exists": False}' in block
    assert '"active_trip_id": None' in block
    assert "result.matched_count != 1" in block
    assert "En tur ble tildelt samtidig" in block


def test_checkout_lock_binds_to_price_snapshot():
    block = _block("create_trip_checkout", "get_payment_status")
    assert '"price": amount_nok' in block
    assert '"payment_checkout_lock": checkout_lock' in block
    assert '"payment_status": {"$ne": "paid"}' in block


def test_admin_price_adjustment_cannot_race_payment():
    block = _block("admin_trip_intervene")
    assert 'status": {"$in": ["initiated", "awaiting_payment"]}' in block
    assert 'trip.get("payment_checkout_lock")' in block
    assert '"price": previous_price' in block
    assert "price_result.modified_count != 1" in block


def test_refund_is_paid_only_locked_and_stripe_idempotent():
    block = _block("admin_create_refund", "admin_transactions")
    required = [
        'trip.get("payment_status") != "paid"',
        '"refund_lock": refund_lock',
        "lock_result.matched_count != 1",
        'idempotency_key=f"kjapp-refund-{body.trip_id}-{already}-{amount}"',
        '"refund_lock": refund_lock, "payment_status": "paid"',
    ]
    for marker in required:
        assert marker in block, marker


def test_mark_seen_requires_trip_membership():
    block = _block("mark_messages_seen")
    assert "await _load_trip_or_403(trip_id, current)" in block
    assert "_real_trip_filter(" in block


def test_admin_overview_finance_is_paid_real_trip_only():
    block = _block("admin_overview", "admin_client_errors")
    assert "_real_trip_filter(" in block
    assert '"payment_status": "paid"' in block
    assert 'rate = await _commission_for_trip(t)' in block


def test_receipt_email_delivery_is_atomically_serialized_per_recipient():
    block = _block("send_trip_receipts", "_attempt_trip_auto_charge")
    assert "async def deliver_once" in block
    assert 'lock_field = f"{kind}_email_delivery_lock"' in block
    assert 'lock_at_field = f"{kind}_email_delivery_locked_at"' in block
    assert "claim.modified_count != 1" in block
    # Ignore formatting between the outer update document and its $set key.
    assert '"$set":{sent_field:now_iso}' in "".join(block.split())
    assert '"$unset": {lock_field: "", lock_at_field: ""}' in block
    assert 'await deliver_once(\n        "customer"' in block
    assert 'await deliver_once(\n        "driver"' in block
