import math
from datetime import datetime, timezone

from bson import ObjectId

from travel_context import parsed_time


async def confirmed_driver_identity(db, driver_id, now=None):
    """Return only a verified badge backed by a current, reviewed record."""
    if not ObjectId.is_valid(driver_id):
        return False
    driver = await db.users.find_one(
        {"_id": ObjectId(driver_id), "role": "driver", "approved": True, "disabled": {"$ne": True}},
        {"identity_verification_status": 1, "identity_verified_at": 1,
         "next_identity_check_at": 1, "identity_recheck_pending_reason": 1},
    )
    if not driver or driver.get("identity_verification_status") != "verified" or driver.get("identity_recheck_pending_reason"):
        return False
    verified_at = driver.get("identity_verified_at")
    verified = parsed_time(verified_at)
    due = parsed_time(driver.get("next_identity_check_at"))
    now = now or datetime.now(timezone.utc)
    if not verified or verified > now or (due and due <= now):
        return False
    review = await db.driver_identity_verifications.find_one(
        {"driver_user_id": str(driver_id), "status": "verified", "reviewed_at": verified_at,
         "reviewed_by": {"$type": "string", "$ne": ""}},
        {"_id": 1},
    )
    return bool(review)


def pickup_call_due(trip, fresh_location):
    if (trip.get("status") != "driver_on_way" or trip.get("pickup_call_requested") is not True
            or not fresh_location or not (trip.get("customer") or {}).get("phone")):
        return False
    minutes = (trip.get("pickup_route") or {}).get("duration_min")
    return (isinstance(minutes, (int, float)) and not isinstance(minutes, bool)
            and math.isfinite(minutes) and 0 <= minutes <= 2)
