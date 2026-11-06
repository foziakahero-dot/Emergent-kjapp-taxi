"""Service fee policy with 12% platform default and fleet/vehicle overrides.

SNAR's standard business model: 12% service fee per ride (platform default).
Fleets can have custom commission rates. Individual vehicles can override fleet rate.
Super Admin manages commission rates via Admin Control Center.
Historical trip snapshots remain authoritative.
"""
import math
import os


# Platform default commission rate (12%)
PLATFORM_DEFAULT_COMMISSION = 0.12
MAX_COMMISSION_RATE = 0.50


def subscription_trip_terms():
    """New bookings carry the platform default commission snapshot (12%).

    Legacy subscription model (0% commission) is deprecated.
    This returns the platform default with source tracking for audit.
    """
    return {
        "commission_rate": PLATFORM_DEFAULT_COMMISSION,
        "commission_source": "platform_default_v2",
        "business_model": "service_fee_12_percent"
    }


def saved_trip_rate(trip, fallback):
    """Return the authoritative commission rate from trip snapshot.

    Zero is a valid snapshot value (could be 0% promo), never a request to use
    an old fleet fee. Returns fallback if not set.
    """
    value = trip.get("commission_rate")
    return float(fallback if value is None else value)


def configured_service_fee(stored_rate=PLATFORM_DEFAULT_COMMISSION):
    """Get configured platform service fee rate from env or stored default."""
    raw = os.getenv('SNAR_SERVICE_FEE_RATE', '').strip()
    rate = float(raw) if raw else float(stored_rate)
    if not math.isfinite(rate) or not 0 <= rate <= MAX_COMMISSION_RATE:
        raise ValueError(f'SNAR_SERVICE_FEE_RATE must be a fraction between 0 and {MAX_COMMISSION_RATE}')
    return rate


def commission_source():
    """Return the source identifier for the current commission configuration."""
    return 'service_fee_policy' if os.getenv('SNAR_SERVICE_FEE_RATE', '').strip() else 'platform_default'


async def resolve_commission_rate(db, trip: dict) -> tuple[float, str]:
    """
    Resolve the authoritative commission rate for a trip.

    Priority hierarchy (highest to lowest):
    1. Vehicle override (fleet_vehicles.commission_rate)
    2. Fleet override (fleets.commission_rate)
    3. Platform default (12% or SNAR_SERVICE_FEE_RATE env)

    Returns: (rate, source)
    """
    # 1. Check vehicle override
    vehicle_id = trip.get("vehicle_id")
    if vehicle_id:
        vehicle = await db.fleet_vehicles.find_one({"_id": vehicle_id})
        if vehicle and vehicle.get("commission_rate") is not None:
            rate = float(vehicle["commission_rate"])
            if 0 <= rate <= MAX_COMMISSION_RATE:
                return rate, "vehicle_override"

    # 2. Check fleet override
    fleet_id = trip.get("fleet_id")
    if fleet_id:
        fleet = await db.fleets.find_one({"_id": fleet_id})
        if fleet and fleet.get("commission_rate") is not None:
            rate = float(fleet["commission_rate"])
            if 0 <= rate <= MAX_COMMISSION_RATE:
                return rate, "fleet_override"

    # 3. Platform default
    return configured_service_fee(), "platform_default"


async def get_platform_commission_config(db) -> dict:
    """Get current platform commission configuration for Super Admin UI."""
    platform_rate = configured_service_fee()
    return {
        "platform_default_rate": platform_rate,
        "platform_default_rate_percent": round(platform_rate * 100, 2),
        "max_commission_rate": MAX_COMMISSION_RATE,
        "max_commission_rate_percent": round(MAX_COMMISSION_RATE * 100, 2),
        "source": commission_source(),
    }


async def set_platform_commission_rate(db, rate: float, admin_user: dict) -> dict:
    """Set the platform default commission rate (Super Admin only).

    Note: This updates the in-memory/env config. For persistence, use env var
    SNAR_SERVICE_FEE_RATE. This function validates and returns the new config.
    """
    if not math.isfinite(rate) or not 0 <= rate <= MAX_COMMISSION_RATE:
        raise ValueError(f'Commission rate must be between 0 and {MAX_COMMISSION_RATE}')

    # Get previous rate for audit
    previous_rate = configured_service_fee()

    # Update environment variable for current process
    os.environ['SNAR_SERVICE_FEE_RATE'] = str(rate)

    # Audit log
    # (audit function would be called by the endpoint)

    config = await get_platform_commission_config(db)
    config["previous_rate"] = previous_rate
    return config
