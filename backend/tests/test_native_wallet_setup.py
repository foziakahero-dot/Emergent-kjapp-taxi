"""Server authority for native card/wallet setup, default selection and webhook recovery."""
import asyncio
from types import SimpleNamespace
from unittest.mock import Mock
from bson import ObjectId
from test_mobile_commerce import env
from payment_method_selection import selected_payment_method


def configure(env):
    env.db.raw.users.update_one({'_id':env.uid},{'$set':{'stripe_customer_id':'cus_unit'}})
    env.db.raw.payment_methods.create_index([('user_id',1),('stripe_payment_method_id',1)],unique=True,
        partialFilterExpression={'stripe_payment_method_id':{'$type':'string'}})
    class StripeObject(dict):
        __getattr__=dict.__getitem__
    setup=StripeObject(id='seti_unit',client_secret='seti_unit_secret',status='succeeded',customer='cus_unit',
        payment_method='pm_wallet',metadata={'user_id':str(env.uid),'source':'kjapp_native_setup'})
    pm=StripeObject(id='pm_wallet',customer='cus_unit',type='card',
        card={'brand':'visa','last4':'4242','exp_month':12,'exp_year':2028,'wallet':{'type':'google_pay'}})
    env.stripe.SetupIntent=SimpleNamespace(create=Mock(return_value=setup),retrieve=Mock(return_value=setup))
    env.stripe.PaymentMethod=SimpleNamespace(retrieve=Mock(return_value=pm))
    env.stripe.StripeClient=Mock(return_value=SimpleNamespace(v1=SimpleNamespace(
        setup_intents=env.stripe.SetupIntent, payment_methods=env.stripe.PaymentMethod)))
    return setup,pm


def test_native_setup_uses_existing_customer_and_dynamic_methods(env):
    configure(env)
    assert env.client.post('/payments/native/setup-intent').status_code==200
    args=env.stripe.SetupIntent.create.call_args.args[0]
    assert args['customer']=='cus_unit' and args['usage']=='off_session'
    assert 'payment_method_types' not in args
    assert args['automatic_payment_methods']['enabled'] is True


def test_verified_setup_is_saved_once_even_after_webhook_retry(env):
    setup,pm=configure(env)
    assert asyncio.run(env.webhook({'type':'setup_intent.succeeded','data':{'object':setup}})) is True
    first=env.client.get('/payments/native/setup-intent/seti_unit')
    assert first.status_code==200 and first.json()['verified'] is True
    assert first.json()['card']['wallet']=='google_pay'
    assert asyncio.run(env.webhook({'type':'setup_intent.succeeded','data':{'object':setup}})) is True
    assert env.db.raw.payment_methods.count_documents({})==1
    assert env.client.get('/payments/native/setup-intent/seti_unit').json()['card']['id']==first.json()['card']['id']


def test_incomplete_setup_cannot_verify_and_other_owners_cannot_read(env):
    setup,pm=configure(env)
    setup['status']='requires_payment_method'
    assert env.client.get('/payments/native/setup-intent/seti_unit').json()['ready'] is False
    assert env.db.raw.payment_methods.count_documents({})==0
    setup['metadata']['user_id']=str(ObjectId())
    assert env.client.get('/payments/native/setup-intent/seti_unit').status_code==404


def test_wallet_method_must_belong_to_stripe_customer(env):
    setup,pm=configure(env);pm['customer']='cus_other'
    assert env.client.get('/payments/native/setup-intent/seti_unit').status_code==409
    assert env.db.raw.payment_methods.count_documents({})==0


def test_selected_wallet_card_becomes_authoritative_default(env):
    configure(env)
    card=env.client.get('/payments/native/setup-intent/seti_unit').json()['card']
    old={'_id':ObjectId(),'user_id':str(env.uid),'verified':True,'setup_status':'succeeded','stripe_payment_method_id':'pm_old','is_default':True}
    env.db.raw.payment_methods.insert_one(old)
    response=env.client.post('/payment-methods/'+card['id']+'/default')
    assert response.status_code==200 and response.json()['default_payment_method_id']==card['id']
    user=env.db.raw.users.find_one({'_id':env.uid})
    selected=asyncio.run(selected_payment_method(env.db,str(env.uid),user))
    assert str(selected['_id'])==card['id']
    env.current['id']=str(ObjectId())
    assert env.client.post('/payment-methods/'+card['id']+'/default').status_code==404


def test_unverified_method_cannot_become_default(env):
    card={'_id':ObjectId(),'user_id':str(env.uid),'verified':False,'stripe_payment_method_id':'pm_unverified'}
    env.db.raw.payment_methods.insert_one(card)
    assert env.client.post('/payment-methods/'+str(card['_id'])+'/default').status_code==404


def test_google_pay_setup_requires_explicit_qa_flag_and_future_usage(env, monkeypatch):
    setup, pm = configure(env)
    monkeypatch.setenv('APP_ENV', 'qa')
    monkeypatch.setenv('GOOGLE_PAY_ENABLED', 'true')
    request = {'wallet': 'google_pay', 'future_use_accepted': True}
    assert env.client.post('/payments/native/setup-intent', json=request).status_code == 503
    monkeypatch.setenv('QA_GOOGLE_PAY_ENABLED', 'true')
    assert env.client.post('/payments/native/setup-intent', json={'wallet': 'google_pay'}).status_code == 422
    assert env.client.post('/payments/native/setup-intent', json=request).status_code == 200
    params = env.stripe.SetupIntent.create.call_args.args[0]
    assert params['usage'] == 'off_session' and params['metadata']['wallet'] == 'google_pay'
    assert params['metadata']['future_use_scope'] == 'customer_booked_snar_rides'
    assert params['metadata']['future_use_accepted_at']
    assert 'payment_method_types' not in params


def test_google_pay_identity_and_consent_are_verified_before_saving(env):
    setup, pm = configure(env)
    setup['metadata'].update(wallet='google_pay', future_use_accepted_at='2026-10-16T20:00:00+00:00', future_use_scope='customer_booked_snar_rides')
    pm['card']['wallet'] = None
    assert env.client.get('/payments/native/setup-intent/seti_unit').status_code == 409
    assert env.db.raw.payment_methods.count_documents({}) == 0
    pm['card']['wallet'] = {'type': 'google_pay'}
    saved = env.client.get('/payments/native/setup-intent/seti_unit').json()['card']
    assert saved['wallet'] == 'google_pay' and saved['future_use_accepted_at']
    assert env.db.raw.payment_methods.find_one()['future_use_scope'] == 'customer_booked_snar_rides'


def test_setup_webhook_recovery_works_after_ui_is_disabled(env, monkeypatch):
    setup, pm = configure(env)
    monkeypatch.setenv('NATIVE_PAYMENTS_ENABLED', 'false')
    assert asyncio.run(env.webhook({'type': 'setup_intent.succeeded', 'data': {'object': setup}})) is True
    assert env.db.raw.payment_methods.count_documents({}) == 1


def test_live_wallets_require_matching_keys_and_explicit_production_switch(env, monkeypatch):
    configure(env)
    env.stripe.api_key = 'sk_live_private'
    monkeypatch.setenv('STRIPE_PUBLISHABLE_KEY', 'pk_live_public')
    assert env.client.get('/payments/native/config').json()['enabled'] is False
    monkeypatch.setenv('APP_ENV', 'production')
    assert env.client.get('/payments/native/config').json()['enabled'] is False
    monkeypatch.setenv('NATIVE_PAYMENTS_LIVE_ENABLED', 'true')
    assert env.client.get('/payments/native/config').json()['enabled'] is True
    monkeypatch.setenv('APP_ENV', 'qa')
    assert env.client.get('/payments/native/config').json()['enabled'] is False
    assert env.client.post('/payments/native/setup-intent').status_code == 503


def test_web_wallet_setup_requires_explicit_activation_and_consent(env, monkeypatch):
    configure(env)
    body = {'wallet': 'google_pay', 'platform': 'web', 'future_use_accepted': True}
    monkeypatch.setenv('GOOGLE_PAY_ENABLED', 'true')
    assert env.client.post('/payments/native/setup-intent', json=body).status_code == 503
    monkeypatch.setenv('WEB_WALLETS_ENABLED', 'true')
    assert env.client.post('/payments/native/setup-intent', json={**body, 'future_use_accepted':False}).status_code == 422
    assert env.client.post('/payments/native/setup-intent', json=body).status_code == 200


def test_apple_native_needs_merchant_and_explicit_flag(env, monkeypatch):
    configure(env)
    body = {'wallet': 'apple_pay', 'future_use_accepted': True}
    assert env.client.post('/payments/native/setup-intent', json=body).status_code == 503
    monkeypatch.setenv('APPLE_PAY_MERCHANT_ID', 'merchant.no.snar')
    monkeypatch.setenv('APPLE_PAY_ENABLED', 'true')
    assert env.client.post('/payments/native/setup-intent', json=body).status_code == 200
