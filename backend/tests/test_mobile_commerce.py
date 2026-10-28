"""HTTP regressions for identity roles, settlement and duplicate payment protection."""
import asyncio
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
import pytest
import mongomock
from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mobile_commerce as commerce
from onboarding_emails import queue_customer_welcome
from stripe_fleet import ensure_fleet_account


class Cursor:
    def __init__(self, rows): self.rows = rows
    async def to_list(self, limit): return list(self.rows)[:limit]


class Collection:
    def __init__(self, collection): self.raw = collection
    async def find_one(self, query, **kwargs): return self.raw.find_one(query, **kwargs)
    async def update_one(self, query, update, **kwargs): return self.raw.update_one(query, update, **kwargs)
    async def update_many(self, query, update): return self.raw.update_many(query, update)
    async def count_documents(self, query): return self.raw.count_documents(query)
    async def insert_one(self, data): return self.raw.insert_one(data)
    async def count_documents(self, query): return self.raw.count_documents(query)
    def find(self, query): return Cursor(self.raw.find(query))


class Database:
    def __init__(self): self.raw = mongomock.MongoClient().kjapp
    def __getattr__(self, name): return Collection(self.raw[name])


@pytest.fixture
def env(monkeypatch):
    monkeypatch.setenv('APP_ENV', 'development')
    monkeypatch.setenv('GOOGLE_CLIENT_ID', 'owned-web-client')
    monkeypatch.setenv('STRIPE_PUBLISHABLE_KEY', 'pk_test_example')
    monkeypatch.setenv('NATIVE_PAYMENTS_ENABLED', 'true')
    db = Database()
    db.raw.users.create_index('email', unique=True)
    for provider in ('google', 'apple'):
        db.raw.users.create_index(provider + '_sub', unique=True, partialFilterExpression={provider + '_sub': {'$type': 'string'}})
    uid, fid = ObjectId(), ObjectId()
    current = {'id': str(uid), 'role': 'user', 'email': 'customer@gmail.com', 'fleet_id': str(fid)}
    db.raw.users.insert_one({'_id': uid, 'email': current['email'], 'role': 'user', 'google_sub': 'google-1'})
    db.raw.fleets.insert_one({'_id': fid, 'owner_user_id': str(uid), 'active': True})
    db.raw.trips.insert_one({'trip_id': 'ride-1', 'user_id': str(uid), 'status': 'arrived', 'price': 300, 'payment_status': 'pending'})
    pi = {'id': 'pi_1', 'client_secret': 'pi_1_secret_example', 'amount': 30000,
        'currency': 'nok', 'status': 'requires_payment_method', 'metadata': {'trip_id': 'ride-1', 'user_id': str(uid)}}
    class StripeObject(dict):
        __getattr__ = dict.__getitem__
    obj = StripeObject(pi)
    stripe = SimpleNamespace(api_key='sk_test_example', RequestsClient=Mock(),
        PaymentIntent=SimpleNamespace(create=Mock(return_value=obj), retrieve=Mock(return_value=obj)),
        Account=SimpleNamespace(create=Mock(return_value=SimpleNamespace(id='acct_1')), modify=Mock(), retrieve=Mock()),
        AccountLink=SimpleNamespace(create=Mock(return_value=SimpleNamespace(url='https://connect.stripe.com/setup/test'))))
    def sdk_client(*_args, **_kwargs):
        return SimpleNamespace(v1=SimpleNamespace(
            payment_intents=SimpleNamespace(
                create=lambda params, options=None: stripe.PaymentIntent.create(**params, **(options or {})),
                retrieve=lambda intent_id: stripe.PaymentIntent.retrieve(intent_id)),
            setup_intents=SimpleNamespace(retrieve=lambda setup_id: stripe.SetupIntent.retrieve(setup_id)),
            payment_methods=SimpleNamespace(retrieve=lambda pm_id: stripe.PaymentMethod.retrieve(pm_id))))
    stripe.StripeClient = Mock(side_effect=sdk_client)
    verify = AsyncMock(return_value={'sub': 'google-1', 'email': current['email'], 'email_verified': True})
    risk = AsyncMock(side_effect=lambda user, *args, **kwargs: user)
    mark_paid, receipts = AsyncMock(), AsyncMock()
    destination = AsyncMock(return_value={'fleet_id': str(fid), 'stripe_account_id': 'acct_1', 'commission_rate': .1})
    monkeypatch.setattr(commerce, 'stripe_destination_for_trip', destination)
    app = FastAPI()
    apple_keys = AsyncMock(return_value=[])
    webhook = commerce.install_mobile_commerce(app, db, stripe=stripe,
        get_current_user=lambda: current, require_customer=lambda: current, require_fleet_owner=lambda: current,
        rate_limit=AsyncMock(), verify_google=verify, apple_keys=apple_keys,
        hash_password=lambda _: 'hash', create_access_token=lambda *args: 'session-token',
        create_twofa_token=lambda _: '2fa', set_auth_cookie=Mock(),
        user_public=lambda user: {'id': str(user['_id']), 'role': user['role'], 'approved': user.get('approved')},
        apply_driver_risk=risk, require_active_fleet=AsyncMock(), real_trip_filter=lambda query: query,
        mark_paid=mark_paid, send_receipts=receipts, on_customer_created=lambda user: queue_customer_welcome(db, user))
    return SimpleNamespace(client=TestClient(app), db=db, uid=uid, fid=fid, current=current,
        stripe=stripe, pi=obj, verify=verify, risk=risk, paid=mark_paid, receipts=receipts,
        destination=destination, webhook=webhook, apple_keys=apple_keys)


def sign_in(e, client='customer'):
    return e.client.post('/auth/google/native', json={'identity_token': 'verified-token', 'client': client, 'device_id': 'device-1'})


def test_customer_session_uses_verified_identity(env):
    result = sign_in(env)
    assert result.status_code == 200
    assert result.json()['user']['role'] == 'user'
    assert env.db.raw.users.find_one({'_id': env.uid})['google_sub'] == 'google-1'
    env.verify.assert_awaited_once_with('verified-token', 'owned-web-client')


def test_customer_cannot_enter_driver_app(env):
    assert sign_in(env, 'driver').status_code == 403
    assert env.db.raw.users.count_documents({}) == 1


def test_social_login_never_creates_driver(env):
    env.verify.return_value['sub'] = 'new-driver'
    env.verify.return_value['email'] = 'new-driver@gmail.com'
    assert sign_in(env, 'driver').status_code == 403
    assert env.db.raw.users.count_documents({}) == 1


def test_unapproved_driver_is_blocked(env):
    env.db.raw.users.update_one({'_id': env.uid}, {'$set': {'role': 'driver', 'approved': False}})
    assert sign_in(env, 'driver').status_code == 403


def test_google_rejects_even_linked_approved_driver(env):
    env.db.raw.users.update_one({'_id': env.uid}, {'$set': {'role': 'driver', 'approved': True, 'fleet_id': str(env.fid)}})
    assert sign_in(env, 'driver').status_code == 403
    env.verify.assert_not_awaited()
    env.risk.assert_not_awaited()
    config = env.client.get('/auth/native/config?client=driver').json()
    assert config['google_enabled'] is False and config['google_web_client_id'] == ''


def test_existing_identity_is_not_overwritten(env):
    env.db.raw.users.update_one({'_id': env.uid}, {'$set': {'google_sub': 'other-google'}})
    assert sign_in(env).status_code == 409
    assert env.db.raw.users.find_one({'_id': env.uid})['google_sub'] == 'other-google'


def test_second_factor_is_not_bypassed(env):
    env.db.raw.users.update_one({'_id': env.uid}, {'$set': {'totp_enabled': True}})
    assert sign_in(env).status_code == 409
    assert env.db.raw.users.find_one({'_id': env.uid})['google_sub'] == 'google-1'


def test_invalid_apple_token_cannot_create_session(env):
    result = env.client.post('/auth/apple/native', json={'identity_token': 'invalid-token'})
    assert result.status_code == 401


def test_native_payment_splits_server_fare_and_reuses_intent(env):
    for _ in range(2):
        response = env.client.post('/payments/native/intent', json={'trip_id': 'ride-1', 'amount': 1})
        assert response.status_code == 200
    env.stripe.PaymentIntent.create.assert_called_once()
    kwargs = env.stripe.PaymentIntent.create.call_args.kwargs
    assert kwargs['amount'] == 30000
    assert kwargs['application_fee_amount'] == 3000
    assert kwargs['transfer_data'] == {'destination': 'acct_1'}
    assert env.db.raw.payment_transactions.count_documents({}) == 1


def test_unready_fleet_never_charges_platform_instead(env):
    env.destination.return_value = None
    assert env.client.post('/payments/native/intent', json={'trip_id': 'ride-1'}).status_code == 409
    env.stripe.PaymentIntent.create.assert_not_called()


def test_existing_checkout_blocks_native_payment(env):
    env.db.raw.payment_transactions.insert_one({'trip_id': 'ride-1', 'status': 'initiated', 'kind': 'checkout'})
    assert env.client.post('/payments/native/intent', json={'trip_id': 'ride-1'}).status_code == 409
    env.stripe.PaymentIntent.create.assert_not_called()


def test_payment_lock_prevents_second_intent(env):
    from datetime import datetime, timezone
    env.db.raw.trips.update_one({'trip_id': 'ride-1'}, {'$set': {'payment_checkout_lock': 'other', 'payment_checkout_locked_at': datetime.now(timezone.utc)}})
    assert env.client.post('/payments/native/intent', json={'trip_id': 'ride-1'}).status_code == 409
    env.stripe.PaymentIntent.create.assert_not_called()


def test_wrong_owner_cannot_read_payment(env):
    env.client.post('/payments/native/intent', json={'trip_id': 'ride-1'})
    env.current['id'] = str(ObjectId())
    assert env.client.get('/payments/native/intent/pi_1').status_code == 404


def test_only_stripe_verified_success_marks_trip_paid(env):
    env.client.post('/payments/native/intent', json={'trip_id': 'ride-1'})
    assert env.client.get('/payments/native/intent/pi_1').json()['payment_status'] != 'paid'
    env.paid.assert_not_awaited()
    env.pi['status'] = 'succeeded'
    assert env.client.get('/payments/native/intent/pi_1').json()['payment_status'] == 'paid'
    env.paid.assert_awaited_once()


def test_mismatched_amount_is_rejected(env):
    env.client.post('/payments/native/intent', json={'trip_id': 'ride-1'})
    env.pi.update(status='succeeded', amount=100)
    assert env.client.get('/payments/native/intent/pi_1').status_code == 409
    env.paid.assert_not_awaited()


def test_connected_account_event_is_not_platform_payment(env):
    env.client.post('/payments/native/intent', json={'trip_id': 'ride-1'})
    env.pi['status'] = 'succeeded'
    assert asyncio.run(env.webhook({'type': 'payment_intent.succeeded', 'account': 'acct_other', 'data': {'object': env.pi}})) is False
    env.paid.assert_not_awaited()


def test_native_payments_require_matching_live_or_test_keys(env, monkeypatch):
    monkeypatch.setenv('STRIPE_PUBLISHABLE_KEY', 'pk_live_mismatch')
    assert env.client.get('/payments/native/config').json()['enabled'] is False
    assert env.client.post('/payments/native/intent', json={'trip_id': 'ride-1'}).status_code == 503


def test_fleet_onboarding_is_owner_scoped_and_reuses_account(env):
    env.current['role'] = 'fleet_owner'
    for _ in range(2):
        assert env.client.post('/fleet/stripe/onboarding').status_code == 200
    env.stripe.Account.create.assert_called_once()
    kwargs = env.stripe.Account.create.call_args.kwargs
    assert kwargs['idempotency_key'].endswith(str(env.fid))
    assert env.stripe.AccountLink.create.call_args.kwargs['return_url'].endswith('/okonomi?stripe=return')


def test_other_fleet_cannot_be_onboarded(env):
    env.current['role'] = 'fleet_owner'
    env.current['id'] = str(ObjectId())
    assert env.client.post('/fleet/stripe/onboarding').status_code == 404
    env.stripe.Account.create.assert_not_called()



def test_authenticated_customer_can_explicitly_link_third_party_google_email(env):
    env.current['email'] = 'person@company.example'
    env.verify.return_value['email'] = env.current['email']
    result = env.client.post('/auth/google/link', json={'identity_token': 'verified-token', 'client': 'customer'})
    assert result.status_code == 200
    assert env.db.raw.users.find_one({'_id': env.uid})['google_sub'] == 'google-1'


def test_google_link_rejects_wrong_email_and_existing_different_identity(env):
    env.verify.return_value['email'] = 'someoneelse@gmail.com'
    assert env.client.post('/auth/google/link', json={'identity_token': 'verified-token'}).status_code == 409
    env.verify.return_value['email'] = env.current['email']
    env.db.raw.users.update_one({'_id': env.uid}, {'$set': {'google_sub': 'previous-link'}})
    assert env.client.post('/auth/google/link', json={'identity_token': 'verified-token'}).status_code == 409
    assert env.db.raw.users.find_one({'_id': env.uid})['google_sub'] == 'previous-link'


def test_google_link_never_takes_another_users_identity(env):
    env.db.raw.users.update_one({'_id': env.uid}, {'$unset': {'google_sub': ''}})
    env.db.raw.users.insert_one({'google_sub': 'google-1', 'email': 'another@gmail.com', 'role': 'user'})
    assert env.client.post('/auth/google/link', json={'identity_token': 'verified-token'}).status_code == 409
    assert not env.db.raw.users.find_one({'_id': env.uid}).get('google_sub')


def test_native_beta_payment_rejects_live_keys(env, monkeypatch):
    env.stripe.api_key = 'sk_live_fixture'
    monkeypatch.setenv('STRIPE_PUBLISHABLE_KEY', 'pk_live_fixture')
    assert env.client.get('/payments/native/config').json()['enabled'] is False
    assert env.client.post('/payments/native/intent', json={'trip_id': 'ride-1'}).status_code == 503
    env.stripe.PaymentIntent.create.assert_not_called()


def test_native_beta_supports_restricted_test_key(env):
    env.stripe.api_key = 'rk_test_fixture'
    assert env.client.get('/payments/native/config').json()['enabled'] is True


def test_native_config_live_requires_explicit_production_gate(env, monkeypatch):
    env.stripe.api_key = 'sk_live_example'
    monkeypatch.setenv('STRIPE_PUBLISHABLE_KEY', 'pk_live_example')
    assert env.client.get('/payments/native/config').json()['enabled'] is False
    monkeypatch.setenv('NATIVE_PAYMENTS_LIVE_ENABLED', 'true')
    monkeypatch.setenv('APP_ENV', 'production')
    monkeypatch.setenv('QA_MODE', 'true')
    assert env.client.get('/payments/native/config').json()['enabled'] is False
    monkeypatch.setenv('QA_MODE', 'false')
    assert env.client.get('/payments/native/config').json()['enabled'] is False
    monkeypatch.setenv('DB_NAME', 'snar_production_fixture')
    monkeypatch.setenv('STRIPE_WEBHOOK_SECRET', 'whsec_fixture')
    assert env.client.get('/payments/native/config').json()['enabled'] is True
    env.stripe.api_key = 'sk_test_example'
    assert env.client.get('/payments/native/config').json()['enabled'] is False


def test_wallet_setup_verifies_ownership_and_records_wallet(env):
    env.db.raw.users.update_one({'_id': env.uid}, {'$set': {'stripe_customer_id': 'cus_wallet'}})
    setup = {'id': 'seti_wallet', 'status': 'succeeded', 'customer': 'cus_wallet', 'metadata': {'user_id': str(env.uid)}, 'payment_method': 'pm_wallet'}
    env.stripe.SetupIntent = SimpleNamespace(retrieve=Mock(return_value=setup))
    env.stripe.PaymentMethod = SimpleNamespace(retrieve=Mock(return_value={'id': 'pm_wallet', 'type': 'card', 'customer': 'cus_wallet', 'card': {'brand': 'visa', 'last4': '4242', 'wallet': {'type': 'google_pay'}}}))
    result = env.client.get('/payments/native/setup-intent/seti_wallet')
    assert result.status_code == 200
    card = result.json()['card']
    assert result.json()['verified'] is True
    assert card['label'] == 'Visa' and card['wallet'] == 'google_pay'
    other = env.db.raw.payment_methods.insert_one({'user_id': str(env.uid), 'is_default': True}).inserted_id
    selected = env.client.post('/payment-methods/' + card['id'] + '/default')
    assert selected.status_code == 200 and selected.json()['default_payment_method_id'] == card['id']
    assert env.db.raw.users.find_one({'_id': env.uid})['default_payment_method_id'] == card['id']
    setup['metadata']['user_id'] = str(ObjectId())
    assert env.client.get('/payments/native/setup-intent/seti_wallet').status_code == 404


def test_default_card_rejects_foreign_unverified_and_detached_methods(env):
    env.db.raw.users.update_one({'_id': env.uid}, {'$set': {'stripe_customer_id': 'cus_wallet'}})
    method = {'user_id': str(env.uid), 'verified': True, 'setup_status': 'succeeded', 'stripe_payment_method_id': 'pm_bad'}
    mid = str(env.db.raw.payment_methods.insert_one(method).inserted_id)
    env.stripe.PaymentMethod = SimpleNamespace(retrieve=Mock(return_value={'customer': 'cus_other', 'type': 'card'}))
    assert env.client.post('/payment-methods/' + mid + '/default').status_code == 409
    env.db.raw.payment_methods.update_one({'_id': ObjectId(mid)}, {'$set': {'verified': False}})
    assert env.client.post('/payment-methods/' + mid + '/default').status_code == 404
    env.db.raw.payment_methods.update_one({'_id': ObjectId(mid)}, {'$set': {'verified': True, 'user_id': str(ObjectId())}})
    assert env.client.post('/payment-methods/' + mid + '/default').status_code == 404
    assert env.client.post('/payment-methods/not-an-id/default').status_code == 400
