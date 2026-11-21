"""A deployment-level service fee override; historical trip snapshots remain authoritative."""
import math
import os


STANDARD_SERVICE_FEE = 0.12


def subscription_trip_terms():
    """Subscription invoices are independent of the per-trip fare."""
    return {"commission_rate": 0.0, "commission_source": "subscription_v1", "business_model": "subscription"}


def new_trip_terms(environment, payments):
    """Snapshot the chosen model on each new booking, independently of later fleet changes."""
    if (environment == "qa" and os.getenv("QA_PER_RIDE_FEE_TEST_ENABLED") == "true"
            and payments["enabled"] and payments["test_mode"]):
        return {"commission_rate": STANDARD_SERVICE_FEE, "commission_source": "qa_per_ride_v1",
                "business_model": "per_ride"}
    return subscription_trip_terms()


def saved_trip_rate(trip, fallback):
    """Zero is an authoritative snapshot, never a request to use an old fleet fee."""
    value = trip.get("commission_rate")
    return float(fallback if value is None else value)


def configured_service_fee(stored_rate=STANDARD_SERVICE_FEE):
    raw = os.getenv('SNAR_SERVICE_FEE_RATE', '').strip()
    rate = float(raw) if raw else float(stored_rate)
    if not math.isfinite(rate) or not 0 <= rate <= 0.5:
        raise ValueError('SNAR_SERVICE_FEE_RATE must be a fraction between 0 and 0.5')
    return rate


def commission_source():
    return 'service_fee_policy' if os.getenv('SNAR_SERVICE_FEE_RATE', '').strip() else 'platform_default'
