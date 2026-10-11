from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SERVER = (ROOT / "backend" / "server.py").read_text(encoding="utf-8")
FLEET_PAGES = (ROOT / "fleet-web" / "src" / "pages.tsx").read_text(encoding="utf-8")
DRIVER_EARNINGS = (ROOT / "driver-app" / "app" / "(driver)" / "earnings.tsx").read_text(encoding="utf-8")


def _block(name: str, next_name: str | None = None) -> str:
    start = SERVER.index(f"async def {name}")
    if next_name:
        end = SERVER.index(f"async def {next_name}", start + 1)
    else:
        end = SERVER.find("\nasync def ", start + 1)
        if end < 0:
            end = len(SERVER)
    return SERVER[start:end]


def test_fleet_payout_endpoint_is_read_only_stripe_truth():
    block = _block("fleet_payouts", "fleet_export_monthly")
    assert "stripe.Payout.list" in block
    assert "stripe_account=account_id" in block
    assert '"source": "stripe"' in block
    assert "db.fleet_payouts.insert" not in block
    assert "stripe.Payout.create" not in block


def test_connect_schedule_is_weekly_friday_not_invented_monday():
    block = _block("driver_payouts", "unread_message_count")
    assert '"weekly_friday"' in block
    assert "friday = 4" in block
    assert '"settlement_recipient": "fleet"' in block
    assert '"earned_net_7d": net' in block
    assert '"paid_trips_7d": trips_count' in block
    assert "next Monday" not in block


def test_driver_ui_does_not_claim_direct_driver_payout():
    assert "Oppgjør via flåte" in DRIVER_EARNINGS
    assert "Din netto · siste 7 dager" in DRIVER_EARNINGS
    assert "løyvehaverens Stripe Connect-konto" in DRIVER_EARNINGS
    assert "Til utbetaling" not in DRIVER_EARNINGS


def test_fleet_finance_labels_stripe_payouts():
    assert "STRIPE-UTBETALINGER" in FLEET_PAGES
    assert "Connected account · ukentlig fredag" in FLEET_PAGES
    assert "Ingen Stripe-utbetalinger registrert ennå." in FLEET_PAGES
