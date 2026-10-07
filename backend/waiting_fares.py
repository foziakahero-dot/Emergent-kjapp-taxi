"""Pickup waiting policy, snapshotted at booking and bounded by the agreed hold."""
import hashlib
import json
import math
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP


def waiting_policy(pricing, vehicle_type):
    rates = (pricing.get("vehicle_rates") or {}).get(vehicle_type) or {}
    rate = float(rates.get("waiting_per_minute", pricing.get("waiting_per_minute", 4)) or 0)
    free = float(rates.get("waiting_free_minutes", pricing.get("waiting_free_minutes", 2)))
    maximum = float(rates.get("waiting_max_minutes", pricing.get("waiting_max_minutes", 15)))
    if not all(math.isfinite(n) for n in (rate, free, maximum)) or not (
        0 <= rate <= 200 and 0 <= free <= 60 and 0 <= maximum <= 60
    ):
        raise ValueError("Invalid waiting policy")
    policy = {"version": 1, "vehicle_type": vehicle_type, "per_minute": rate,
              "free_minutes": free, "max_billable_minutes": maximum,
              "max_fee": math.ceil(rate * maximum), "currency": "NOK"}
    policy["token"] = hashlib.sha256(json.dumps(policy, sort_keys=True).encode()).hexdigest()
    return policy


def waiting_charge(policy, seconds):
    """Pro-rate to the second after the free period; no surge or driving-time double bill."""
    seconds = float(seconds)
    if not math.isfinite(seconds):
        raise ValueError("Invalid waiting duration")
    billable = min(max(0, seconds - policy["free_minutes"] * 60),
                   policy["max_billable_minutes"] * 60)
    amount = Decimal(str(billable)) / Decimal(60) * Decimal(str(policy["per_minute"]))
    fee = min(int(amount.quantize(Decimal("1"), rounding=ROUND_HALF_UP)), policy["max_fee"])
    return {"waiting_seconds": max(0, int(seconds)), "waiting_billable_seconds": int(billable),
            "waiting_fee_total": fee}


def waiting_start_fields(trip, started_at):
    """Only opted-in bookings can add a fee. Server timestamps determine the interval."""
    policy = trip.get("waiting_policy")
    if not policy or not trip.get("waiting_policy_accepted_at"):
        return {}
    try:
        arrival = datetime.fromisoformat(str(trip["at_pickup_at"]).replace("Z", "+00:00"))
        if arrival.tzinfo is None:
            arrival = arrival.replace(tzinfo=timezone.utc)
        charge = waiting_charge(policy, (started_at - arrival).total_seconds())
    except (KeyError, TypeError, ValueError):
        raise ValueError("Missing or invalid pickup arrival timestamp") from None
    fare = int(trip.get("quoted_ride_price", trip["price"]))
    total = fare + charge["waiting_fee_total"]
    if total * 100 > int(trip.get("authorized_amount_ore", 0)):
        raise ValueError("Waiting charge exceeds authorized amount")
    return {**charge, "price": total, "waiting_finished_at": started_at.isoformat()}
