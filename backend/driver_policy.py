"""Pure driver quality policy evaluation used by admin and scheduled checks."""

from datetime import datetime, timezone


DEFAULT_DRIVER_POLICY = {
    "enabled": True,
    "auto_suspend": False,
    "minimum_rating": 3.7,
    "warning_rating": 4.2,
    "minimum_ratings": 10,
    "inactivity_days": 60,
    "acceptance_window_days": 30,
    "minimum_offers": 20,
    "minimum_acceptance_rate": 25,
}


def _utc(value):
    if not value:
        return None
    if isinstance(value, datetime):
        parsed = value
    else:
        try:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except (TypeError, ValueError):
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def normalize_driver_policy(value=None):
    policy = {**DEFAULT_DRIVER_POLICY, **(value or {})}
    policy["minimum_rating"] = min(5.0, max(1.0, float(policy["minimum_rating"])))
    policy["warning_rating"] = min(5.0, max(policy["minimum_rating"], float(policy["warning_rating"])))
    policy["minimum_ratings"] = max(1, int(policy["minimum_ratings"]))
    policy["inactivity_days"] = max(7, int(policy["inactivity_days"]))
    policy["acceptance_window_days"] = max(7, int(policy["acceptance_window_days"]))
    policy["minimum_offers"] = max(1, int(policy["minimum_offers"]))
    policy["minimum_acceptance_rate"] = min(100, max(0, int(policy["minimum_acceptance_rate"])))
    policy["enabled"] = bool(policy["enabled"])
    policy["auto_suspend"] = bool(policy["auto_suspend"])
    return policy


def evaluate_driver_policy(driver, stats, policy=None, now=None):
    """Return a deterministic assessment without mutating the driver.

    New drivers are protected by minimum sample sizes. Manual suspensions are never
    overwritten by the automatic evaluator.
    """
    policy = normalize_driver_policy(policy)
    now = _utc(now) or datetime.now(timezone.utc)
    rating_count = int(stats.get("rating_count") or 0)
    rating = stats.get("rating")
    completed = int(stats.get("completed_count") or 0)
    accepted = int(stats.get("accepted_in_window") or 0)
    declined = int(stats.get("declined_in_window") or 0)
    offers = accepted + declined
    acceptance_rate = round((accepted / offers) * 100) if offers else None
    last_activity = _utc(stats.get("last_completed_at")) or _utc(driver.get("created_at"))
    inactivity_days = (now - last_activity).days if last_activity else None

    warnings = []
    suspension_reasons = []
    if rating_count >= policy["minimum_ratings"] and isinstance(rating, (int, float)):
        if rating < policy["minimum_rating"]:
            suspension_reasons.append(f"Rating {rating:.1f} er under {policy['minimum_rating']:.1f} etter {rating_count} vurderinger")
        elif rating < policy["warning_rating"]:
            warnings.append(f"Rating {rating:.1f} er under varslingsgrensen {policy['warning_rating']:.1f}")

    if driver.get("approved") is True and inactivity_days is not None and inactivity_days >= policy["inactivity_days"]:
        suspension_reasons.append(f"Ingen fullført tur på {inactivity_days} dager")

    if offers >= policy["minimum_offers"] and acceptance_rate is not None:
        if acceptance_rate < policy["minimum_acceptance_rate"]:
            suspension_reasons.append(
                f"Akseptrate {acceptance_rate}% er under {policy['minimum_acceptance_rate']}% ({offers} tilbud)"
            )
        elif acceptance_rate < min(100, policy["minimum_acceptance_rate"] + 15):
            warnings.append(f"Lav akseptrate: {acceptance_rate}% ({offers} tilbud)")

    if driver.get("quality_exempt") is True:
        status = "exempt"
    elif driver.get("suspension_source") == "manual" and driver.get("approved") is False:
        status = "suspended"
    elif suspension_reasons:
        status = "suspend_recommended"
    elif warnings:
        status = "warning"
    else:
        status = "good"

    return {
        "status": status,
        "warnings": warnings,
        "suspension_reasons": suspension_reasons,
        "rating": rating,
        "rating_count": rating_count,
        "completed_count": completed,
        "last_completed_at": stats.get("last_completed_at"),
        "inactivity_days": inactivity_days,
        "accepted_in_window": accepted,
        "declined_in_window": declined,
        "offers_in_window": offers,
        "acceptance_rate": acceptance_rate,
    }
