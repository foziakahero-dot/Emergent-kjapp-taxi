"""Cash bookings use real handlers, isolated Mongo data and no Stripe operations."""
import asyncio
from datetime import datetime, timezone, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import mongomock
import pytest
from bson import ObjectId
from fastapi import HTTPException
from test_phase2c_dispatch_identity_projection import server, AsyncCursor
from cash_payments import activate_cash, confirm_cash
from ride_reservations import RideReservations
from payment_modes import payment_config
from waiting_fares import waiting_policy, waiting_start_fields


class Cursor(AsyncCursor):
    def sort(self, *args): return self
    def limit(self, *args): return self


class Collection:
    def __init__(self, raw): self.raw = raw
    async def find_one(self, *a, **k): return self.raw.find_one(*a, **k)
    async def update_one(self, *a, **k): return self.raw.update_one(*a, **k)
    async def insert_one(self, *a, **k): return self.raw.insert_one(*a, **k)
    async def count_documents(self, *a, **k): return self.raw.count_documents(*a, **k)
    def find(self, *a, **k): return Cursor(self.raw.find(*a, **k))


@pytest.fixture
def context(monkeypatch):
    raw = mongomock.MongoClient().cash
    raw.payment_transactions.create_index('session_id', unique=True)
    db = SimpleNamespace(**{n: Collection(raw[n]) for n in ['trips', 'users', 'platform_settings',
        'payment_methods', 'payment_transactions', 'receipt_ledger', 'bonus_payouts', 'driver_payouts', 'fleets']})
    uid, did = str(ObjectId()), str(ObjectId())
    raw.users.insert_one({'_id': ObjectId(uid)})
    raw.users.insert_one({'_id': ObjectId(did), 'role': 'driver', 'active_trip_id': 'cash-trip'})
    monkeypatch.setattr(server, 'db', db)
    monkeypatch.setattr(server, '_real_trip_filter', lambda q: q)
    monkeypatch.setenv('CASH_PAYMENTS_ENABLED', 'true')
    return raw, db, uid, did


def cash_trip(uid, did, **extra):
    return {'trip_id': 'cash-trip', 'user_id': uid, 'driver_id': did, 'payment_provider': 'cash',
        'payment_flow': 'cash', 'payment_method': 'cash', 'payment_status': 'cash_due', 'status': 'arrived',
        'price': 173, 'commission_rate': 0.0, 'commission_source': 'subscription_v1',
        'created_at': datetime.now(timezone.utc).isoformat(), **extra}


def booking_setup(monkeypatch):
    monkeypatch.setattr(server, '_require_launch_pickup', lambda *_: None)
    monkeypatch.setattr(server, 'osrm_route_points', AsyncMock(return_value={'distance_km': 2, 'duration_min': 6, 'geometry': None}))
    monkeypatch.setattr(server, 'active_pricing', AsyncMock(return_value=server.DEFAULT_PRICING))
    dispatch = AsyncMock()
    monkeypatch.setattr(server, 'offer_trip_to_next_driver', dispatch)
    reserve = SimpleNamespace(authorize=AsyncMock(side_effect=AssertionError('Stripe must not be used')), release=AsyncMock())
    monkeypatch.setattr(server, 'ride_reservations', reserve)
    return dispatch, reserve


def body(provider):
    return server.TripRequest(pickup_address='Oslo', pickup_lat=59.91, pickup_lng=10.75,
        dropoff_address='Majorstuen', dropoff_lat=59.93, dropoff_lng=10.71, payment_provider=provider)


def test_actual_cash_booking_needs_no_card_and_dispatches_unpaid(context, monkeypatch):
    raw, db, uid, did = context
    dispatch, reserve = booking_setup(monkeypatch)
    result = asyncio.run(server.request_trip(body('cash'), {'id': uid, 'legal_accepted': True}))
    assert result['status'] == 'searching' and result['payment_status'] == 'cash_due'
    assert result['payment_method'] == 'cash' and result['commission_rate'] == 0
    assert result['settlement_model'] == 'driver_collected_cash'
    dispatch.assert_awaited_once()
    reserve.authorize.assert_not_awaited()
    assert raw.payment_transactions.count_documents({}) == 0
    with pytest.raises(HTTPException) as err:
        asyncio.run(server.request_trip(body('cash'), {'id': uid, 'legal_accepted': True}))
    assert err.value.status_code == 409 and dispatch.await_count == 1


def test_disabled_cash_and_card_without_verified_card_fail_closed(context, monkeypatch):
    raw, db, uid, did = context
    booking_setup(monkeypatch)
    monkeypatch.setenv('CASH_PAYMENTS_ENABLED', 'false')
    for provider, status in [('cash', 503), ('card', 402)]:
        with pytest.raises(HTTPException) as err:
            asyncio.run(server.request_trip(body(provider), {'id': uid, 'legal_accepted': True}))
        assert err.value.status_code == status
    assert raw.trips.count_documents({}) == 0
    assert payment_config(SimpleNamespace(api_key=''))['cash_enabled'] is False


def test_disabled_stripe_does_not_disable_cash_config(monkeypatch):
    monkeypatch.setenv('CASH_PAYMENTS_ENABLED', 'true')
    cfg = payment_config(SimpleNamespace(api_key=''))
    assert cfg['cash_enabled'] is True and cfg['enabled'] is False


def test_driver_confirmation_idempotent_audited_and_receipt_cash(context, monkeypatch):
    raw, db, uid, did = context
    raw.trips.insert_one(cash_trip(uid, did))
    monkeypatch.setattr(server, '_commission_for_trip', AsyncMock(return_value=0.0))
    receipts = server.ensure_receipt_snapshot
    paid = AsyncMock()
    async def check():
        for _ in range(2):
            result = await confirm_cash(db, 'cash-trip', did, 17300, mark_paid=paid, receipts=receipts)
            assert result['paid'] is True
    asyncio.run(check())
    saved = raw.trips.find_one()
    assert saved['payment_status'] == 'paid' and saved['status'] == 'completed'
    assert saved['cash_received_by'] == did and saved['cash_received_amount_ore'] == 17300
    assert saved['cash_collection_required'] is False
    assert raw.payment_transactions.count_documents({}) == 1
    assert raw.payment_transactions.find_one()['settlement_model'] == 'driver_collected_cash'
    receipt = raw.receipt_ledger.find_one()
    assert receipt['payment_method'] == 'cash' and receipt['stripe_payment_intent_id'] is None
    assert not raw.users.find_one({'_id': ObjectId(did)}).get('active_trip_id')


@pytest.mark.parametrize('patch,driver,amount,status', [({}, 'other', 17300, 404),
    ({}, None, 17200, 409), ({'status': 'in_trip'}, None, 17300, 409),
    ({'price_review_required': True}, None, 17300, 409),
    ({'payment_flow': 'reservation', 'payment_provider': 'card'}, None, 17300, 409)])
def test_confirmation_rejects_wrong_driver_amount_state_and_card(context, patch, driver, amount, status):
    raw, db, uid, did = context
    raw.trips.insert_one(cash_trip(uid, did, **patch))
    paid, receipts = AsyncMock(), AsyncMock()
    with pytest.raises(HTTPException) as err:
        asyncio.run(confirm_cash(db, 'cash-trip', driver or did, amount, mark_paid=paid, receipts=receipts))
    assert err.value.status_code == status
    assert raw.trips.find_one()['payment_status'] == 'cash_due'
    paid.assert_not_awaited(); receipts.assert_not_awaited()
    assert raw.payment_transactions.count_documents({}) == 0


def test_cash_never_enters_stripe_reservation_or_capture(context):
    raw, db, uid, did = context
    trip = cash_trip(uid, did)
    s = RideReservations(db, SimpleNamespace(api_key=''), mark_paid=AsyncMock(), receipts=AsyncMock(),
        push=AsyncMock(), dispatch=AsyncMock(), destination=AsyncMock())
    s.client = Mock(side_effect=AssertionError('Stripe must not be used'))
    async def check():
        await s.require_reserved(trip)
        for call in [s.authorize(trip), s.capture(trip)]:
            with pytest.raises(HTTPException): await call
    asyncio.run(check())
    s.client.assert_not_called()


def test_cash_waiting_fee_uses_accepted_policy_without_a_card_hold():
    now = datetime.now(timezone.utc)
    policy = waiting_policy({'waiting_per_minute': 4, 'waiting_free_minutes': 2}, 'ai-first')
    fields = waiting_start_fields({'payment_flow': 'cash', 'payment_provider': 'cash', 'price': 173,
        'quoted_ride_price': 173, 'waiting_policy': policy, 'waiting_policy_accepted_at': now.isoformat(),
        'at_pickup_at': (now - timedelta(minutes=3)).isoformat()}, now)
    assert fields['waiting_fee_total'] == 4 and fields['price'] == 177


@pytest.mark.parametrize('location', ['destination', 'early', 'missing'])
def test_actual_arrival_keeps_cash_due_and_blocks_stripe(context, monkeypatch, location):
    raw, db, uid, did = context
    trip = cash_trip(uid, did, status='in_trip', dropoff_lat=59.91, dropoff_lng=10.75)
    raw.trips.insert_one(trip)
    monkeypatch.setattr(server, 'send_push_to_user', AsyncMock())
    monkeypatch.setattr(server, '_attempt_trip_auto_charge', AsyncMock(side_effect=AssertionError('no Stripe')))
    monkeypatch.setattr(server, 'ride_reservations', SimpleNamespace(capture=AsyncMock(side_effect=AssertionError('no Stripe'))))
    current = {'id': did, 'last_lat': None if location == 'missing' else 59.95 if location == 'early' else 59.91,
               'last_lng': 10.75, 'last_location_at': datetime.now(timezone.utc).isoformat()}
    result = asyncio.run(server.driver_arrive('cash-trip', current))
    assert result['payment']['reason'] == 'cash_due'
    assert raw.trips.find_one()['status'] == 'arrived'
    assert raw.trips.find_one()['payment_status'] == 'cash_due'
    assert raw.trips.find_one()['price'] == 173
    assert raw.trips.find_one()['price_review_required'] is False
    assert raw.trips.find_one()['requires_manual_settlement'] is False
    assert raw.trips.find_one()['cash_collection_required'] is True
    assert raw.trips.find_one()['ended_early'] is (location != 'destination')
    assert raw.users.find_one({'_id': ObjectId(did)})['active_trip_id'] == 'cash-trip'
    notifications = server.send_push_to_user.await_args_list
    assert notifications[0].args[:2] == (did, 'Ta imot kontantbetaling')
    assert '173 kr' in notifications[0].args[2]
    assert notifications[1].args[:2] == (uid, 'Betal kontant til sjåføren')
    # Retrying arrival cannot mark cash received or send duplicate notices.
    again = asyncio.run(server.driver_arrive('cash-trip', current))
    assert again['already_applied'] is True
    assert server.send_push_to_user.await_count == 2
    assert raw.trips.find_one()['payment_status'] == 'cash_due'


def test_cash_collection_survives_notification_failure(context, monkeypatch):
    raw, db, uid, did = context
    raw.trips.insert_one(cash_trip(uid, did, status='in_trip', dropoff_lat=59.91, dropoff_lng=10.75))
    push = AsyncMock(side_effect=[RuntimeError('push unavailable'), None])
    monkeypatch.setattr(server, 'send_push_to_user', push)
    result = asyncio.run(server.driver_arrive('cash-trip', {'id': did}))
    assert result['ok'] is True and push.await_count == 2
    assert raw.trips.find_one()['payment_status'] == 'cash_due'
    assert raw.trips.find_one()['price_review_required'] is False


@pytest.mark.parametrize('flow', ['reservation', 'legacy'])
@pytest.mark.parametrize('location', ['early', 'missing'])
def test_card_manual_completion_preserves_agreed_fare_and_payment_safeguards(context, monkeypatch, flow, location):
    raw, db, uid, did = context
    raw.trips.insert_one(cash_trip(uid, did, status='in_trip', payment_flow=flow,
        payment_provider='stripe', payment_method='card', payment_status='authorized',
        dropoff_lat=59.91, dropoff_lng=10.75))
    monkeypatch.setattr(server, 'send_push_to_user', AsyncMock(side_effect=[RuntimeError('push unavailable'), None]))
    capture = AsyncMock(return_value={'attempted': True, 'status': 'capture_pending'})
    charge = AsyncMock(return_value={'attempted': False, 'reason': 'disabled_or_missing'})
    monkeypatch.setattr(server, 'ride_reservations', SimpleNamespace(capture=capture))
    monkeypatch.setattr(server, '_attempt_trip_auto_charge', charge)
    current = {'id': did}
    if location == 'early': current.update(last_lat=59.95, last_lng=10.75, last_location_at=datetime.now(timezone.utc).isoformat())
    result = asyncio.run(server.driver_arrive('cash-trip', current))
    trip = raw.trips.find_one()
    assert result['ok'] is True and result['ended_early'] is True
    assert trip['status'] == 'arrived' and trip['price'] == 173
    assert trip['price_review_required'] is False and trip['requires_manual_settlement'] is False
    assert trip['fare_preserved_on_manual_end'] is True
    assert trip['payment_status'] != 'paid'  # Arrival is not proof of settlement.
    assert raw.users.find_one({'_id': ObjectId(did)}).get('active_trip_id') is None
    assert capture.await_count == (1 if flow == 'reservation' else 0)
    assert charge.await_count == (1 if flow == 'legacy' else 0)
    again = asyncio.run(server.driver_arrive('cash-trip', current))
    assert again['already_applied'] is True
    assert charge.await_count == (1 if flow == 'legacy' else 0)


def test_real_receipt_sender_retries_only_missing_recipients_and_escapes_route(context, monkeypatch):
    raw, db, uid, did = context
    raw.trips.insert_one(cash_trip(uid, did, status='completed', payment_status='paid',
        ended_early=True, end_reason='before_destination', pickup_address='<script>fixture</script>'))
    raw.users.update_one({'_id': ObjectId(uid)}, {'$set': {'email': 'customer@example.invalid'}})
    raw.users.update_one({'_id': ObjectId(did)}, {'$set': {'email': 'driver@example.invalid'}})
    monkeypatch.setattr(server, '_commission_for_trip', AsyncMock(return_value=0.0))
    send = Mock(return_value=False); monkeypatch.setattr(server, 'send_email', send)
    first = asyncio.run(server.send_trip_receipts('cash-trip'))
    assert first['email_delivery_pending'] is True and first['gross_amount'] == 173
    assert send.call_count == 2 and '&lt;script&gt;' in send.call_args_list[0].args[2]
    assert all(call.kwargs == {'message_type': 'receipts'} for call in send.call_args_list)
    assert first['ended_early'] is True
    send.return_value = True
    second = asyncio.run(server.send_trip_receipts('cash-trip'))
    assert second['email_delivery_pending'] is False
    assert second['customer_email_sent_at'] and second['driver_email_sent_at']
    again = asyncio.run(server.send_trip_receipts('cash-trip'))
    assert again['receipt_number'] == first['receipt_number'] and send.call_count == 4


def test_backfilled_receipts_do_not_create_an_automatic_historical_mailout(context, monkeypatch):
    raw, db, uid, did = context
    raw.trips.insert_one(cash_trip(uid, did, status='completed', payment_status='paid'))
    raw.users.update_one({'_id': ObjectId(uid)}, {'$set': {'email': 'customer@example.invalid'}})
    monkeypatch.setattr(server, '_commission_for_trip', AsyncMock(return_value=0.0))
    result = asyncio.run(server.ensure_receipt_snapshot('cash-trip', backfilled=True))
    assert result['email_delivery_pending'] is False


def test_cash_is_earnings_but_never_pending_electronic_payout(context, monkeypatch):
    raw, db, uid, did = context
    raw.trips.insert_one(cash_trip(uid, did, status='completed', payment_status='paid'))
    monkeypatch.setattr(server, '_commission_for_trip', AsyncMock(return_value=0.0))
    monkeypatch.setattr(server, '_platform_commission', AsyncMock(return_value=0.0))
    result = asyncio.run(server.driver_payouts({'id': did}))
    assert result['earned_gross_7d'] == result['cash_collected_7d'] == 173
    assert result['paid_trips_7d'] == result['cash_trips_7d'] == 1
    assert result['pending_gross'] == result['pending_net'] == 0


def test_cash_due_remains_current_after_restart_and_blocks_new_offers(context, monkeypatch):
    raw, db, uid, did = context
    raw.trips.insert_one(cash_trip(uid, did, arrived_at=(datetime.now(timezone.utc) - timedelta(days=1)).isoformat()))
    monkeypatch.setattr(server, '_commission_for_trip', AsyncMock(return_value=0.0))
    trip = asyncio.run(server.driver_current({'id': did}))
    assert trip['trip_id'] == 'cash-trip' and trip['driver_earnings'] is None
    now = datetime.now(timezone.utc).isoformat()
    result = asyncio.run(server.driver_pending({'id': did, 'online': True, 'last_location_at': now}))
    assert result['cash_due'] and result['busy'] and result['trips'] == []


def test_cash_confirmation_requires_driver_role_and_strict_amount():
    from pydantic import ValidationError
    with pytest.raises(HTTPException):
        asyncio.run(server.require_driver({'role': 'user'}))
    for amount in [True, -1, 0, 12.5, '17300']:
        with pytest.raises(ValidationError): server.CashReceivedRequest(amount_ore=amount)


def test_interrupted_cash_creation_can_resume_without_card(context, monkeypatch):
    raw, db, uid, did = context
    dispatch, reserve = booking_setup(monkeypatch)
    trip = cash_trip(uid, None, status='payment_authorizing', payment_status='authorizing')
    raw.trips.insert_one(trip)
    result = asyncio.run(server.retry_trip_authorization('cash-trip', {'id': uid}))
    assert result['status'] == 'searching' and result['payment_status'] == 'cash_due'
    dispatch.assert_awaited_once(); reserve.authorize.assert_not_awaited()


def test_confirmed_old_cash_trip_displays_paid_summary(context, monkeypatch):
    raw, db, uid, did = context
    raw.trips.insert_one(cash_trip(uid, did, arrived_at=(datetime.now(timezone.utc) - timedelta(days=1)).isoformat()))
    monkeypatch.setattr(server, '_commission_for_trip', AsyncMock(return_value=0.0))
    asyncio.run(confirm_cash(db, 'cash-trip', did, 17300, mark_paid=AsyncMock(), receipts=AsyncMock()))
    result = asyncio.run(server.driver_current({'id': did}))
    assert result['payment_status'] == 'paid' and result['driver_earnings'] == 173
