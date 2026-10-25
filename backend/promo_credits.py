"""Customer promo credit: codes grant credit, and credit is spent per trip.

Invariant: the discount on a trip never exceeds SNAR's platform fee for that
trip, so the fleet/driver net is unchanged and SNAR never pays out of pocket.
"""
import math
import re

PROMO_CODE_PATTERN = re.compile(r"^[A-Z0-9-]{3,24}$")
MIN_CUSTOMER_CHARGE_KR = 1


def normalize_code(raw: str) -> str:
    return re.sub(r"\s+", "", str(raw or "")).upper()


def is_valid_code(code: str) -> bool:
    return bool(PROMO_CODE_PATTERN.match(code or ""))


def max_discount_for_trip(gross_price_kr: int, commission_rate: float) -> int:
    """Largest discount that fits inside SNAR's own fee for this trip."""
    gross = max(0, int(gross_price_kr or 0))
    rate = min(max(float(commission_rate or 0), 0.0), 1.0)
    fee_cap = math.floor(gross * rate)
    return max(0, min(fee_cap, gross - MIN_CUSTOMER_CHARGE_KR))


def discount_for_trip(gross_price_kr: int, commission_rate: float, balance_kr: int) -> int:
    return max(0, min(int(balance_kr or 0), max_discount_for_trip(gross_price_kr, commission_rate)))


def platform_fee_ore(charged_ore: int, discount_ore: int, commission_rate: float) -> int:
    """SNAR's share after the promo. The fleet keeps (gross - gross*rate) either way."""
    charged = max(0, int(charged_ore or 0))
    discount = max(0, int(discount_ore or 0))
    gross = charged + discount
    fee = int(round(gross * float(commission_rate or 0))) - discount
    return min(max(0, fee), charged)
