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
    return setup,pm


def test_native_setup_uses_existing_customer_and_dynamic_methods(env):
    configure(env)
    assert env.client.post('/payments/native/setup-intent').status_code==200
    args=env.stripe.SetupIntent.create.call_args.kwargs
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
