"""A deployment-level service fee override; historical trip snapshots remain authoritative."""
import math
import os


def configured_service_fee(stored_rate=0.12):
    raw = os.getenv('SNAR_SERVICE_FEE_RATE', '').strip()
    rate = float(raw) if raw else float(stored_rate)
    if not math.isfinite(rate) or not 0 <= rate <= 0.5:
        raise ValueError('SNAR_SERVICE_FEE_RATE must be a fraction between 0 and 0.5')
    return rate


def commission_source():
    return 'service_fee_policy' if os.getenv('SNAR_SERVICE_FEE_RATE', '').strip() else 'platform_default'
