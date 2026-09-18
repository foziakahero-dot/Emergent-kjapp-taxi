from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId


COMMISSION_CALCULATION_VERSION = "commission-v1"


def _clamp_rate(value, default_rate: float) -> float:
    try:
        rate = float(value)
    except (TypeError, ValueError):
        rate = float(default_rate)
    return max(0.0, min(rate, 0.50))


def build_commission_snapshot(
    gross_amount: int,
    commission_rate: float,
    *,
    fleet_id: Optional[str],
    currency: str = "NOK",
    source: str = "unknown",
    calculated_at: Optional[str] = None,
) -> dict:
    gross = int(gross_amount or 0)
    rate = _clamp_rate(commission_rate, 0.10)
    commission_amount = int(round(gross * rate))
    net = gross - commission_amount
    return {
        "commission_rate": rate,
        "commission_amount": commission_amount,
        "gross_amount": gross,
        "driver_amount": net,
        "fleet_net_amount": net,
        "fleet_id": str(fleet_id) if fleet_id else None,
        "currency": (currency or "NOK").upper(),
        "calculated_at": calculated_at or datetime.now(timezone.utc).isoformat(),
        "calculation_version": COMMISSION_CALCULATION_VERSION,
        "source": source,
    }


async def _fleet_for_trip(db, trip: dict):
    fleet_id = trip.get("fleet_id")
    driver_id = trip.get("driver_user_id") or trip.get("driver_id")
    driver = None

    if not fleet_id and driver_id:
        try:
            driver = await db.users.find_one(
                {"_id": ObjectId(str(driver_id)), "role": "driver"},
                {"fleet_id": 1},
            )
        except Exception:
            driver = None
        fleet_id = (driver or {}).get("fleet_id")

    fleet = None
    if fleet_id:
        try:
            fleet = await db.fleets.find_one({"_id": ObjectId(str(fleet_id))})
        except Exception:
            fleet = None
    return (str(fleet_id) if fleet_id else None), fleet


async def resolve_commission_snapshot(
    db,
    trip: dict,
    default_rate: float,
    *,
    persist: bool = False,
) -> dict:
    """Return the authoritative commission basis for a trip.

    Existing snapshots are immutable. Historical trips without a snapshot are
    resolved from the strongest available historical source without being
    silently rewritten unless persist=True is explicitly requested.
    """
    existing = trip.get("commission_snapshot")
    if isinstance(existing, dict) and existing.get("commission_rate") is not None:
        return existing

    gross = int(trip.get("price") or 0)
    trip_id = trip.get("trip_id")
    currency = "NOK"
    fleet_id = None
    rate = None
    source = "platform_default"

    payment_tx = None
    if trip_id:
        payment_tx = await db.payment_transactions.find_one(
            {"trip_id": trip_id},
            sort=[("updated_at", -1)],
        )
    if payment_tx:
        tx_snapshot = payment_tx.get("commission_snapshot")
        if isinstance(tx_snapshot, dict) and tx_snapshot.get("commission_rate") is not None:
            return tx_snapshot
        if payment_tx.get("commission_rate") is not None:
            rate = payment_tx.get("commission_rate")
            fleet_id = payment_tx.get("fleet_id")
            currency = str(payment_tx.get("currency") or "nok").upper()
            source = "payment_transaction"

    fleet = None
    if rate is None:
        fleet_id, fleet = await _fleet_for_trip(db, trip)
        reference_at = (
            trip.get("arrived_at")
            or trip.get("completed_at")
            or trip.get("updated_at")
            or trip.get("created_at")
            or datetime.now(timezone.utc).isoformat()
        )
        if fleet_id:
            rule = await db.commission_rules.find_one(
                {"fleet_id": fleet_id, "effective_from": {"$lte": reference_at}},
                sort=[("effective_from", -1)],
            )
            if rule and rule.get("commission_rate") is not None:
                rate = rule.get("commission_rate")
                source = "commission_rule"
            elif fleet and fleet.get("commission_rate") is not None:
                rate = fleet.get("commission_rate")
                source = "fleet"

    if rate is None:
        rate = default_rate

    snapshot = build_commission_snapshot(
        gross,
        _clamp_rate(rate, default_rate),
        fleet_id=fleet_id,
        currency=currency,
        source=source,
    )

    if not persist or not trip_id:
        return snapshot

    # First writer wins. A later commission change must never mutate this trip.
    await db.trips.update_one(
        {
            "trip_id": trip_id,
            "$or": [
                {"commission_snapshot": {"$exists": False}},
                {"commission_snapshot": None},
            ],
        },
        {"$set": {"commission_snapshot": snapshot}},
    )
    stored = await db.trips.find_one({"trip_id": trip_id}, {"commission_snapshot": 1})
    return (stored or {}).get("commission_snapshot") or snapshot


async def commission_rate_for_driver(db, driver_id: str, default_rate: float) -> float:
    """Preview rate for an unassigned offer shown to one driver."""
    try:
        driver = await db.users.find_one(
            {"_id": ObjectId(str(driver_id)), "role": "driver"},
            {"fleet_id": 1},
        )
    except Exception:
        driver = None
    fleet_id = (driver or {}).get("fleet_id")
    if fleet_id:
        try:
            fleet = await db.fleets.find_one(
                {"_id": ObjectId(str(fleet_id))},
                {"commission_rate": 1},
            )
        except Exception:
            fleet = None
        if fleet and fleet.get("commission_rate") is not None:
            return _clamp_rate(fleet.get("commission_rate"), default_rate)
    return _clamp_rate(default_rate, 0.10)
