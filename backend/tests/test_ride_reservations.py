import asyncio
import copy
import sys
from pathlib import Path
from types import SimpleNamespace

import mongomock
import pytest
from bson import ObjectId
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ride_reservations import RideReservations


class Collection:
    def __init__(self, collection): self.raw = collection
    async def find_one(self, *args, **kwargs): return self.raw.find_one(*args, **kwargs)
    async def update_one(self, *args, **kwargs): return self.raw.update_one(*args, **kwargs)


class StripeError(Exception): pass


class Intents:
    def __init__(self):
        self.objects = {}; self.keys = {}; self.captures = 0; self.creates = 0; self.fail_capture = False; self.status = 'requires_capture'
    def create(self, params, options):
        key = options['idempotency_key']
        if key in self.keys: return copy.deepcopy(self.objects[self.keys[key]])
        self.creates += 1
        pi = {**copy.deepcopy(params), 'id': 'pi_test_' + str(self.creates), 'status': self.status,
              'amount_capturable': params['amount'] if self.status == 'requires_capture' else 0,
              'amount_received': 0, 'client_secret': 'test_secret', 'latest_charge': 'ch_test'}
        self.objects[pi['id']] = pi; self.keys[key] = pi['id']; return copy.deepcopy(pi)
    def retrieve(self, pi_id): return copy.deepcopy(self.objects[pi_id])
    def capture(self, pi_id, params, options):
        if self.fail_capture: raise StripeError('capture unavailable')
        pi = self.objects[pi_id]
        if pi['status'] != 'succeeded':
            self.captures += 1; pi.update(status='succeeded', amount_received=params['amount_to_capture'], amount_capturable=0)
        return copy.deepcopy(pi)
    def cancel(self, pi_id, params, options):
        pi = self.objects[pi_id]; pi.update(status='canceled', amount_capturable=0); return copy.deepcopy(pi)


def fixture():
    raw = mongomock.MongoClient().db
    db = SimpleNamespace(**{n: Collection(raw[n]) for n in ['users', 'trips', 'payment_methods', 'payment_transactions']})
    uid = str(ObjectId()); did = str(ObjectId())
    raw.users.insert_one({'_id': ObjectId(uid), 'stripe_customer_id': 'cus_test'})
    raw.payment_methods.insert_one({'user_id': uid, 'verified': True, 'setup_status': 'succeeded', 'stripe_payment_method_id': 'pm_test'})
    trip = {'trip_id': 't', 'user_id': uid, 'driver_id': did, 'status': 'payment_authorizing', 'price': 173, 'payment_flow': 'reservation'}
    raw.trips.insert_one(copy.deepcopy(trip))
    intents = Intents(); events = []; receipts = []
    async def paid(trip_id, user_id): raw.trips.update_one({'trip_id': trip_id}, {'$set': {'payment_status': 'paid', 'status': 'completed'}})
    async def receipt(trip_id): receipts.append(trip_id)
    async def push(*args): events.append(('push', args))
    async def dispatch(t): events.append(('dispatch', t['trip_id']))
    async def destination(t): return None
    stripe = SimpleNamespace(api_key='sk_test_mock', StripeError=StripeError)
    service = RideReservations(db, stripe, mark_paid=paid, receipts=receipt, push=push, dispatch=dispatch, destination=destination)
    service.client = lambda: SimpleNamespace(v1=SimpleNamespace(payment_intents=intents))
    return service, trip, raw, intents, events, receipts


def run(coro): return asyncio.run(coro)


def test_reservation_before_dispatch_and_capture_once():
    async def check():
        s,t,raw,pi,events,receipts = fixture()
        await s.authorize(t)
        saved = raw.trips.find_one({'trip_id':'t'})
        assert saved['status'] == 'searching' and saved['payment_status'] == 'reserved'
        assert events == [('dispatch','t')] and pi.captures == 0
        assert next(iter(pi.objects.values()))['capture_method'] == 'manual'
        await s.authorize(saved); assert len(events)==1 and pi.creates==1
        raw.trips.update_one({'trip_id':'t'}, {'$set':{'status':'arrived', 'ended_early':True, 'price_review_required':True}})
        assert (await s.capture(t))['paid']
        assert (await s.capture(t))['paid'] and pi.captures==1
        assert raw.trips.find_one({'trip_id':'t'})['payment_status']=='paid'
        assert raw.trips.find_one({'trip_id':'t'})['price_review_required'] is False
        assert receipts and len([e for e in events if e[0]=='push'])==2
    run(check())


def test_declined_card_does_not_dispatch():
    async def check():
        s,t,raw,pi,events,_ = fixture(); pi.status='requires_payment_method'
        with pytest.raises(HTTPException) as exc: await s.authorize(t)
        assert exc.value.status_code==402 and not events and not pi.captures
    run(check())


def test_authentication_before_dispatch_then_confirm():
    async def check():
        s,t,raw,pi,events,_=fixture();pi.status='requires_action'
        with pytest.raises(HTTPException) as exc: await s.authorize(t)
        assert exc.value.detail['code']=='reservation_requires_action' and not events
        record=await s.record(t);obj=pi.objects[record['stripe_payment_intent_id']]
        obj.update(status='requires_capture',amount_capturable=17300)
        result=await s.confirm('t',t['user_id']);assert result['payment_status']=='reserved' and len(events)==1
        with pytest.raises(HTTPException):await s.confirm('t',str(ObjectId()))
    run(check())


def test_cancel_releases_hold_even_if_authorization_callback_arrives_late():
    async def check():
        s,t,raw,pi,events,_=fixture();await s.authorize(t)
        raw.trips.update_one({'trip_id':'t'},{'$set':{'status':'cancelled'}})
        await s.release(t);record=await s.record(t)
        assert pi.objects[record['stripe_payment_intent_id']]['status']=='canceled' and pi.captures==0
        assert raw.trips.find_one({'trip_id':'t'})['reservation_status']=='released'
    run(check())


def test_start_requires_live_sufficient_hold():
    async def check():
        s,t,raw,pi,_,_=fixture();await s.authorize(t)
        await s.require_reserved(raw.trips.find_one({'trip_id':'t'}))
        record=await s.record(t);pi.objects[record['stripe_payment_intent_id']]['amount_capturable']=10
        with pytest.raises(HTTPException):await s.require_reserved(raw.trips.find_one({'trip_id':'t'}))
    run(check())


def test_failed_capture_remains_unpaid_then_recovers():
    async def check():
        s,t,raw,pi,_,receipts=fixture();await s.authorize(t)
        raw.trips.update_one({'trip_id':'t'},{'$set':{'status':'arrived'}});pi.fail_capture=True
        assert not (await s.capture(t))['paid'] and not receipts
        assert raw.trips.find_one({'trip_id':'t'})['payment_status']=='capture_pending'
        pi.fail_capture=False;assert (await s.capture(t))['paid'];assert pi.captures==1
    run(check())


def test_webhook_does_not_trust_stale_or_mismatched_event():
    async def check():
        s,t,raw,pi,_,receipts=fixture();await s.authorize(t);record=await s.record(t)
        raw.trips.update_one({'trip_id':'t'},{'$set':{'status':'arrived'}})
        obj=pi.objects[record['stripe_payment_intent_id']]
        await s.webhook({'type':'payment_intent.succeeded','data':{'object':{'id':obj['id'],'status':'succeeded'}}})
        assert not receipts and pi.captures==0
        obj['metadata']['user_id']='other';assert not (await s.capture(t))['paid'];assert not receipts
    run(check())


def test_partial_capture_and_no_overcharging():
    async def check():
        s,t,raw,pi,_,_=fixture();await s.authorize(t)
        raw.trips.update_one({'trip_id':'t'},{'$set':{'status':'arrived','price':200}})
        assert not (await s.capture(t))['paid'] and pi.captures==0
        raw.trips.update_one({'trip_id':'t'},{'$set':{'price':100}})
        assert (await s.capture(t))['paid'];assert next(iter(pi.objects.values()))['amount_received']==10000
    run(check())
