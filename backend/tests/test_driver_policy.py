from datetime import datetime, timedelta, timezone

from driver_policy import DEFAULT_DRIVER_POLICY, evaluate_driver_policy


NOW = datetime(2026, 9, 20, tzinfo=timezone.utc)


def driver(**values):
    return {"approved": True, "created_at": (NOW - timedelta(days=10)).isoformat(), **values}


def stats(**values):
    return {
        "rating": 4.8,
        "rating_count": 15,
        "completed_count": 15,
        "last_completed_at": (NOW - timedelta(days=2)).isoformat(),
        "accepted_in_window": 16,
        "declined_in_window": 4,
        **values,
    }


def test_good_driver_stays_good():
    assert evaluate_driver_policy(driver(), stats(), now=NOW)["status"] == "good"


def test_low_rating_requires_minimum_sample():
    result = evaluate_driver_policy(driver(), stats(rating=2.0, rating_count=3), now=NOW)
    assert result["status"] == "good"


def test_low_rating_recommends_suspension_after_minimum_sample():
    result = evaluate_driver_policy(driver(), stats(rating=3.4, rating_count=12), now=NOW)
    assert result["status"] == "suspend_recommended"
    assert "Rating" in result["suspension_reasons"][0]


def test_inactivity_recommends_suspension():
    result = evaluate_driver_policy(
        driver(created_at=(NOW - timedelta(days=100)).isoformat()),
        stats(last_completed_at=(NOW - timedelta(days=61)).isoformat()),
        now=NOW,
    )
    assert result["status"] == "suspend_recommended"


def test_low_acceptance_requires_minimum_offers():
    result = evaluate_driver_policy(driver(), stats(accepted_in_window=1, declined_in_window=5), now=NOW)
    assert result["status"] == "good"


def test_manual_suspension_is_preserved():
    result = evaluate_driver_policy(
        driver(approved=False, suspension_source="manual"), stats(), now=NOW
    )
    assert result["status"] == "suspended"


def test_quality_exemption_wins_over_recommendation():
    result = evaluate_driver_policy(
        driver(quality_exempt=True), stats(rating=2.0, rating_count=20), DEFAULT_DRIVER_POLICY, NOW
    )
    assert result["status"] == "exempt"
