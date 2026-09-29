import pytest
from fastapi import HTTPException

from admin_operations_os import (
    _fallback_plan,
    validate_ai_feature_patch,
    validate_feature_patch,
    validate_ops_feature_patch,
    validate_runtime_patch,
)

DEFAULT_FEATURES = {
    "surge": True,
    "ai_chat": True,
    "demo_trips": False,
    "vipps": False,
    "booking_enabled": True,
}


def test_runtime_patch_allowlist():
    out = validate_runtime_patch({
        "customer": {"home_prompt": "Hvor går turen?", "maintenance_mode": False},
        "shared": {"support_email": "support@kjappapp.no"},
    })
    assert out["customer"]["home_prompt"] == "Hvor går turen?"
    assert out["shared"]["support_email"] == "support@kjappapp.no"


def test_runtime_patch_rejects_unknown_fields():
    with pytest.raises(HTTPException):
        validate_runtime_patch({"customer": {"arbitrary_code": "nope"}})


def test_demo_trips_cannot_be_enabled():
    with pytest.raises(HTTPException):
        validate_feature_patch({"demo_trips": True}, DEFAULT_FEATURES)


def test_rules_planner_handles_safe_booking_toggle():
    plan = _fallback_plan("Slå av booking midlertidig")
    assert plan["change_type"] == "config"
    assert plan["feature_patch"]["booking_enabled"] is False
    assert plan["requires_build"] is False


def test_rules_planner_routes_native_change_out_of_admin_apply():
    plan = _fallback_plan("Legg til en ny native permission i kundeappen")
    assert plan["change_type"] == "native"
    assert plan["requires_build"] is True
    assert plan["runtime_patch"] == {}


def test_quick_publish_rejects_pricing_and_payment_flags():
    with pytest.raises(HTTPException):
        validate_ops_feature_patch({"surge": False}, DEFAULT_FEATURES)
    with pytest.raises(HTTPException):
        validate_ops_feature_patch({"vipps": True}, DEFAULT_FEATURES)


def test_ai_rejects_pricing_and_payment_flags():
    with pytest.raises(HTTPException):
        validate_ai_feature_patch({"surge": False}, DEFAULT_FEATURES)
    with pytest.raises(HTTPException):
        validate_ai_feature_patch({"vipps": True}, DEFAULT_FEATURES)


def test_ai_allows_only_safe_operational_flags():
    assert validate_ai_feature_patch(
        {"booking_enabled": False, "ai_chat": False},
        DEFAULT_FEATURES,
    ) == {"booking_enabled": False, "ai_chat": False}
