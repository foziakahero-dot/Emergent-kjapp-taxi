"""A deployment-level service fee override; historical trip snapshots remain authoritative."""
import math
import os


def subscription_trip_terms():
    """New bookings carry an immutable zero-commission subscription snapshot.

    Subscription invoices are independent of fare authorization/capture. Legacy
    fee helpers below remain available only for existing agreements/history.
    """
    return {"commission_rate": 0.0, "commission_source": "subscription_v1", "business_model": "subscription"}


def saved_trip_rate(trip, fallback):
    """Zero is an authoritative snapshot, never a request to use an old fleet fee."""
    value = trip.get("commission_rate")
    return float(fallback if value is None else value)


def configured_service_fee(stored_rate=0.12):
    raw = os.getenv('SNAR_SERVICE_FEE_RATE', '').strip()
    rate = float(raw) if raw else float(stored_rate)
    if not math.isfinite(rate) or not 0 <= rate <= 0.5:
        raise ValueError('SNAR_SERVICE_FEE_RATE must be a fraction between 0 and 0.5')
    return rate


def commission_source():
    return 'service_fee_policy' if os.getenv('SNAR_SERVICE_FEE_RATE', '').strip() else 'platform_default'
