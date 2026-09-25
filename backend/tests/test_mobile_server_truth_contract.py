from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CUSTOMER_HOME = (ROOT / "frontend" / "app" / "(app)" / "home.tsx").read_text(encoding="utf-8")
DRIVER_HOME = (ROOT / "driver-app" / "app" / "(driver)" / "home.tsx").read_text(encoding="utf-8")
BOOKING = (ROOT / "frontend" / "app" / "booking" / "[tripId].tsx").read_text(encoding="utf-8")
RECEIPT = (ROOT / "frontend" / "app" / "receipt" / "[tripId].tsx").read_text(encoding="utf-8")


def test_customer_reopens_canonical_active_trip_on_start():
    assert "tripsApi.active()" in CUSTOMER_HOME
    assert "router.replace(\`/booking/\${t.trip_id}\`)" not in CUSTOMER_HOME
    assert "router.replace(\`/booking/\${active.trip_id}\`)" not in CUSTOMER_HOME
    assert "router.replace(`/booking/${t.trip_id}`)" in CUSTOMER_HOME or "router.replace(`/booking/${active.trip_id}`)" in CUSTOMER_HOME


def test_uncertain_customer_booking_reconciles_with_server():
    assert "const active = await tripsApi.active();" in CUSTOMER_HOME
    assert "if (active?.trip_id)" in CUSTOMER_HOME
    assert "router.replace(`/booking/${active.trip_id}`)" in CUSTOMER_HOME


def test_uncertain_driver_accept_reconciles_with_server():
    assert "const confirmed = await driverApi.current();" in DRIVER_HOME
    assert "if (confirmed?.trip_id === tripId)" in DRIVER_HOME
    assert "setCurrent(confirmed)" in DRIVER_HOME


def test_booking_screen_uses_server_state_for_receipt_transition():
    assert "tripsApi.get(tripId" in BOOKING
    assert "['arrived', 'completed', 'rated'].includes(t.status)" in BOOKING
    assert "router.replace(`/receipt/${tripId}`)" in BOOKING


def test_receipt_never_rates_before_paid():
    assert "trip?.payment_status !== 'paid'" in RECEIPT
    assert "if (!tripId || trip?.payment_status !== 'paid') return;" in RECEIPT
