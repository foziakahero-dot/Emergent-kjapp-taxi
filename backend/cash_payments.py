"""Driver-collected cash; never creates a Stripe charge, transfer or refund."""
import os
from datetime import datetime, timezone

from fastapi import HTTPException
from bson import ObjectId
from pymongo.errors import DuplicateKeyError


def cash_enabled():
    return os.getenv("CASH_PAYMENTS_ENABLED", "true").strip().lower() == "true"


def is_cash(trip):
    return trip.get("payment_provider") == "cash" and trip.get("payment_flow") == "cash"


async def activate_cash(db, trip, dispatch):
    if not cash_enabled():
        raise HTTPException(503, "Kontantbetaling er midlertidig deaktivert")
    if not is_cash(trip):
        raise HTTPException(409, "Turen er ikke en kontanttur")
    result = await db.trips.update_one(
        {"trip_id": trip["trip_id"], "user_id": trip["user_id"],
         "status": "payment_authorizing", "payment_flow": "cash", "payment_provider": "cash"},
        {"$set": {"status": "searching", "payment_status": "cash_due",
                  "settlement_model": "driver_collected_cash"}})
    if result.modified_count:
        await dispatch(await db.trips.find_one({"trip_id": trip["trip_id"]}))


async def confirm_cash(db, trip_id, driver_id, amount_ore, *, mark_paid, receipts):
    trip = await db.trips.find_one({"trip_id": trip_id, "driver_id": driver_id})
    if not trip:
        raise HTTPException(404, "Tur ikke funnet")
    if not is_cash(trip) or trip.get("status") not in ("arrived", "completed", "rated"):
        raise HTTPException(409, "Avslutt kontantturen før du bekrefter betaling")
    if trip.get("price_review_required"):
        raise HTTPException(409, "SNAR må kontrollere turprisen før kontantbetaling registreres")
    if amount_ore != int(trip["price"]) * 100:
        raise HTTPException(409, "Beløpet er endret. Oppdater turen før du bekrefter mottatt kontantbeløp")
    now = datetime.now(timezone.utc).isoformat()
    # Only the assigned driver can record receipt, and only once at the exact
    # server fare. Retries repair ledger/receipt delivery without adding money.
    result = await db.trips.update_one(
        {"trip_id": trip_id, "driver_id": driver_id, "status": "arrived",
         "payment_provider": "cash", "payment_flow": "cash", "payment_status": "cash_due",
         "price": trip["price"], "price_review_required": {"$ne": True}},
        {"$set": {"status": "completed", "payment_status": "paid", "payment_method": "cash",
                  "cash_received_at": now, "cash_received_by": driver_id,
                  "cash_received_amount_ore": amount_ore, "paid_at": now,
                  "completed_at": now, "updated_at": now, "settlement_model": "driver_collected_cash"}})
    saved = await db.trips.find_one({"trip_id": trip_id, "driver_id": driver_id})
    if not saved or saved.get("payment_status") != "paid" or not saved.get("cash_received_at"):
        raise HTTPException(409, "Kontantbetalingen kunne ikke bekreftes. Oppdater turen")
    try:
        await db.payment_transactions.update_one({"trip_id": trip_id, "kind": "cash"}, {"$setOnInsert": {
            "trip_id": trip_id, "session_id": f"cash:{trip_id}", "user_id": saved["user_id"], "driver_id": driver_id, "kind": "cash",
            "payment_provider": "cash", "payment_status": "paid", "status": "completed",
            "amount": amount_ore / 100, "currency": "nok", "paid_at": saved["paid_at"],
            "settlement_model": "driver_collected_cash", "created_at": now}}, upsert=True)
    except DuplicateKeyError:
        if not await db.payment_transactions.find_one({"trip_id": trip_id, "kind": "cash", "payment_status": "paid"}):
            raise
    await db.users.update_one({"_id": ObjectId(driver_id), "active_trip_id": trip_id},
        {"$unset": {"active_trip_id": "", "active_trip_locked_at": ""}})
    await mark_paid(trip_id, saved["user_id"], saved["paid_at"])
    await receipts(trip_id)
    return {"ok": True, "paid": True, "already_applied": result.modified_count == 0,
            "payment_provider": "cash", "amount_ore": amount_ore}
