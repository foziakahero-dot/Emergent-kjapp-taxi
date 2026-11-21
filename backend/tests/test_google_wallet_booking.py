"""Wallet authorization uses the existing reservation and capture lifecycle."""
from test_ride_reservations import fixture, run
import pytest
from fastapi import HTTPException


def configure_qa_wallet(monkeypatch, wallet):
    monkeypatch.setenv("APP_ENV", "qa")
    monkeypatch.setenv("STRIPE_PUBLISHABLE_KEY", "pk_test_fixture")
    monkeypatch.setenv("NATIVE_PAYMENTS_ENABLED", "true")
    monkeypatch.setenv(f"QA_{wallet.upper()}_ENABLED", "true")
    if wallet == "apple_pay":
        monkeypatch.setenv("QA_APPLE_PAY_MERCHANT_ID", "merchant.test.fixture")


def saved_wallet_fixture(wallet):
    service, trip, raw, intents, events, receipts = fixture()
    trip["payment_provider"] = wallet
    raw.trips.update_one({"trip_id": trip["trip_id"]}, {"$set": {"payment_provider": wallet}})
    raw.payment_methods.update_one({"user_id": trip["user_id"]}, {"$set": {
        "wallet": wallet, "stripe_customer_id": "cus_test", "stripe_livemode": False,
    }})
    return service, trip, raw, intents, events, receipts


@pytest.mark.parametrize("wallet", ["google_pay", "apple_pay"])
def test_verified_wallet_requires_authentication_before_dispatch_and_captures_once(monkeypatch, wallet):
    configure_qa_wallet(monkeypatch, wallet)

    async def check():
        service, trip, raw, intents, events, receipts = saved_wallet_fixture(wallet)
        intents.status = "requires_action"
        for _ in range(2):
            with pytest.raises(HTTPException) as exc:
                await service.authorize(trip)
            assert exc.value.status_code == 402
            assert exc.value.detail["code"] == "reservation_requires_action"
            assert exc.value.detail["strict_payment_method"] is True
            assert exc.value.detail["payment_method_id"] == "pm_test"
        assert not events and intents.creates == 1 and intents.captures == 0
        intent = next(iter(intents.objects.values()))
        assert intent["capture_method"] == "manual" and intent["payment_method"] == "pm_test"
        assert intent["amount"] == 17300 and intent["currency"] == "nok"
        intent.update(status="requires_capture", amount_capturable=17300)
        await service.confirm(trip["trip_id"], trip["user_id"])
        await service.confirm(trip["trip_id"], trip["user_id"])
        assert events == [("dispatch", trip["trip_id"])]
        raw.trips.update_one({"trip_id": trip["trip_id"]}, {"$set": {"status": "arrived"}})
        assert (await service.capture(trip))["paid"]
        assert (await service.capture(trip))["paid"] and intents.captures == 1
        record = raw.payment_transactions.find_one({"trip_id": trip["trip_id"]})
        assert record["payment_provider"] == wallet and record["stripe_livemode"] is False
        assert receipts and set(receipts) == {trip["trip_id"]}
    run(check())


@pytest.mark.parametrize("wallet", ["google_pay", "apple_pay"])
def test_cancelled_wallet_releases_hold_without_dispatch(monkeypatch, wallet):
    configure_qa_wallet(monkeypatch, wallet)

    async def check():
        service, trip, raw, intents, events, _ = saved_wallet_fixture(wallet)
        intents.status = "requires_action"
        with pytest.raises(HTTPException) as exc:
            await service.authorize(trip)
        assert exc.value.detail["code"] == "reservation_requires_action"
        raw.trips.update_one({"trip_id": trip["trip_id"]}, {"$set": {"status": "cancelled"}})
        await service.release(trip)
        assert not events and intents.captures == 0
        assert next(iter(intents.objects.values()))["status"] == "canceled"
    run(check())


@pytest.mark.parametrize("wallet", ["google_pay", "apple_pay"])
def test_missing_verified_wallet_does_not_use_default_card(monkeypatch, wallet):
    configure_qa_wallet(monkeypatch, wallet)

    async def check():
        service, trip, _, intents, events, _ = fixture()
        trip["payment_provider"] = wallet
        with pytest.raises(HTTPException) as exc:
            await service.authorize(trip)
        assert exc.value.status_code == 402 and not events and intents.creates == 0
    run(check())


def test_qa_ignores_production_wallet_flag(monkeypatch):
    configure_qa_wallet(monkeypatch, "google_pay")
    monkeypatch.setenv("QA_GOOGLE_PAY_ENABLED", "false")
    monkeypatch.setenv("GOOGLE_PAY_ENABLED", "true")

    async def check():
        service, trip, _, intents, events, _ = saved_wallet_fixture("google_pay")
        with pytest.raises(HTTPException) as exc:
            await service.authorize(trip)
        assert exc.value.status_code == 503 and not events and intents.creates == 0
    run(check())


def test_mode_switch_cannot_capture_or_confirm_test_reservation():
    async def check():
        service, trip, raw, intents, events, _ = fixture()
        await service.authorize(trip)
        service.stripe.api_key = 'sk_live_fixture'
        raw.trips.update_one({'trip_id': 't'}, {'$set': {'status': 'arrived'}})
        with pytest.raises(HTTPException):
            await service.capture(trip)
        with pytest.raises(HTTPException):
            await service.confirm('t', trip['user_id'])
        assert intents.captures == 0
    run(check())
