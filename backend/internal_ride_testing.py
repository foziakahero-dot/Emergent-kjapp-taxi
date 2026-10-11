"""Internal, allowlisted physical ride tests; never grants document approval."""
import os


def _env(env):
    return os.environ if env is None else env


def customer_ids(env=None):
    return frozenset(x.strip() for x in _env(env).get("KJAPP_INTERNAL_RIDE_TEST_CUSTOMER_IDS", "").split(",") if x.strip())


def driver_ids(env=None):
    return frozenset(x.strip() for x in _env(env).get("KJAPP_INTERNAL_RIDE_TEST_DRIVER_IDS", "").split(",") if x.strip())


def enabled(env=None):
    e = _env(env)
    return (
        e.get("KJAPP_INTERNAL_RIDE_TEST_ENABLED", "").strip().lower() == "true"
        and e.get("STRIPE_SECRET_KEY", "").startswith("sk_test_")
        and bool(customer_ids(e))
        and bool(driver_ids(e))
    )


def is_test_customer(user_id, env=None):
    return str(user_id or "") in customer_ids(env)


def driver_allowed(driver, fleet, vehicle, env=None):
    e = _env(env)
    did = str(driver.get("_id") or driver.get("id") or "")
    fid = str(driver.get("fleet_id") or "")
    vid = str(driver.get("vehicle_id") or "")
    return bool(
        enabled(e)
        and did in driver_ids(e)
        and driver.get("role") == "driver"
        and driver.get("internal_test_account") is True
        and driver.get("approved") is True
        and driver.get("disabled") is not True
        and driver.get("fleet_active") is not False
        and fleet.get("internal_test_fleet") is True
        and fleet.get("status") == "active"
        and str(fleet.get("_id") or "") == fid
        and vehicle.get("internal_test_vehicle") is True
        and vehicle.get("active") is not False
        and str(vehicle.get("_id") or "") == vid
        and str(vehicle.get("fleet_id") or "") == fid
        and str(vehicle.get("assigned_driver_id") or "") == did
    )


def trip_allowed(driver_is_internal, user_id, env=None):
    test_customer = is_test_customer(user_id, env)
    if driver_is_internal or test_customer:
        return bool(driver_is_internal and test_customer and enabled(env))
    return True


def driver_supply_filter(test_customer, env=None):
    # Even a disabled test session must never fall through to normal supply.
    if test_customer:
        if not enabled(env):
            return {"_id": {"$in": []}}
        return {"internal_test_account": True}
    return {"internal_test_account": {"$ne": True}}


def pending_customer_filter(driver_is_internal, env=None):
    ids = sorted(customer_ids(env))
    return {"user_id": {"$in" if driver_is_internal else "$nin": ids}}
