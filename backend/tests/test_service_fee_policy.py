import sys
from pathlib import Path
import pytest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from service_fee_policy import configured_service_fee, commission_source, new_trip_terms


@pytest.mark.parametrize("payments", [
    {"enabled": False, "test_mode": True},
    {"enabled": True, "test_mode": False},
])
def test_qa_fee_switch_cannot_activate_without_enabled_test_payments(monkeypatch, payments):
    monkeypatch.setenv("QA_PER_RIDE_FEE_TEST_ENABLED", "true")
    assert new_trip_terms("qa", payments)["commission_rate"] == 0.0


def test_twelve_percent_override_preserves_booking_snapshot_policy(monkeypatch):
    monkeypatch.setenv('SNAR_SERVICE_FEE_RATE', '0.12')
    assert configured_service_fee(0.10) == 0.12
    assert commission_source() == 'service_fee_policy'
    assert round(30000 * configured_service_fee(0.10)) == 3600


def test_no_override_keeps_configured_agreement(monkeypatch):
    monkeypatch.delenv('SNAR_SERVICE_FEE_RATE', raising=False)
    assert configured_service_fee() == 0.12
    assert configured_service_fee(0.15) == 0.15
    assert commission_source() == 'platform_default'


@pytest.mark.parametrize('value', ['nan', 'inf', '-0.1', '0.6', 'wrong'])
def test_bad_fee_configuration_fails_closed(monkeypatch, value):
    monkeypatch.setenv('SNAR_SERVICE_FEE_RATE', value)
    with pytest.raises(ValueError): configured_service_fee()
