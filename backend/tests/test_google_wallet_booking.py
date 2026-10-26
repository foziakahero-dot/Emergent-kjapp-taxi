"""Wallet authorization uses the existing reservation and capture lifecycle."""
from test_ride_reservations import fixture, run
import pytest
from fastapi import HTTPException


def enable_wallet(monkeypatch):
    monkeypatch.setenv('STRIPE_PUBLISHABLE_KEY', 'pk_test_fixture')
    monkeypatch.setenv('NATIVE_PAYMENTS_ENABLED', 'true')
    monkeypatch.setenv('GOOGLE_PAY_ENABLED', 'true')


def test_google_pay_needs_no_saved_card_and_dispatches_only_after_confirm(monkeypatch):
    enable_wallet(monkeypatch)
    async def check():
        service, trip, raw, intents, events, _ = fixture()
        trip['payment_provider'] = 'google_pay'
        raw.trips.update_one({'trip_id': 't'}, {'$set': {'payment_provider': 'google_pay'}})
        raw.payment_methods.delete_many({})
        intents.status = 'requires_payment_method'
        for _ in range(2):
            with pytest.raises(HTTPException) as exc:
                await service.authorize(trip)
            detail = exc.value.detail
            assert detail['payment_provider'] == 'google_pay'
            assert detail['amount_ore'] == 17300 and detail['currency'] == 'nok'
        assert not events and intents.creates == 1 and intents.captures == 0
        pi = next(iter(intents.objects.values()))
        assert pi['capture_method'] == 'manual' and 'off_session' not in pi and 'confirm' not in pi
        with pytest.raises(HTTPException):
            await service.confirm('t', 'another-user')
        pi.update(status='requires_capture', amount_capturable=17300)
        await service.confirm('t', trip['user_id'])
        await service.confirm('t', trip['user_id'])
        assert events == [('dispatch', 't')]
        raw.trips.update_one({'trip_id': 't'}, {'$set': {'status': 'arrived'}})
        assert (await service.capture(trip))['paid']
        assert (await service.capture(trip))['paid'] and intents.captures == 1
    run(check())


def test_cancelled_google_pay_never_dispatches(monkeypatch):
    enable_wallet(monkeypatch)
    async def check():
        service, trip, raw, intents, events, _ = fixture()
        trip['payment_provider'] = 'google_pay'
        intents.status = 'requires_payment_method'
        with pytest.raises(HTTPException):
            await service.authorize(trip)
        raw.trips.update_one({'trip_id': 't'}, {'$set': {'status': 'cancelled'}})
        await service.release(trip)
        assert not events and intents.captures == 0
        assert next(iter(intents.objects.values()))['status'] == 'canceled'
    run(check())


def test_disabled_wallet_does_not_bypass_card_gate(monkeypatch):
    enable_wallet(monkeypatch)
    monkeypatch.setenv('GOOGLE_PAY_ENABLED', 'false')
    async def check():
        service, trip, raw, intents, events, _ = fixture()
        trip['payment_provider'] = 'google_pay'
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
