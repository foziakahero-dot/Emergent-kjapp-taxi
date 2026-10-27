import asyncio
import ast
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

import mongomock
import pytest
from pymongo import ReturnDocument

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ride_search import RideSearch, search_fields
from ride_reservations import RideReservations

START = datetime.now(timezone.utc)

class Collection:
    def __init__(self, raw): self.raw = raw
    async def find_one(self, *args, **kwargs): return self.raw.find_one(*args, **kwargs)
    async def find_one_and_update(self, *args, **kwargs): return self.raw.find_one_and_update(*args, **kwargs)
    async def update_one(self, *args, **kwargs): return self.raw.update_one(*args, **kwargs)

def fixture(interval=30):
    # A long full-suite run must not expire this test before it starts.
    global START
    START = datetime.now(timezone.utc)
    raw = mongomock.MongoClient().db
    db = SimpleNamespace(trips=Collection(raw.trips), payment_transactions=Collection(raw.payment_transactions))
    trip = {'trip_id':'one-ride','user_id':'one-customer','driver_id':None,'status':'searching',
            'created_at':(START-timedelta(minutes=10)).isoformat(),'authorized_at':START.isoformat(),
            'pricing_snapshot':{'search_interval_seconds':interval}, 'payment_intent_id':'existing-reservation'}
    raw.trips.insert_one(trip)
    offers, releases, notifications = [], [], []
    async def offer(t):
        offers.append(t['search_attempt'])
        raw.trips.update_one({'trip_id':t['trip_id'],'driver_id':None}, {'$set':{'dispatch_mode':'sequential', 'offer_driver_id':'fixture-driver-'+str(t['search_attempt']), 'offer_expires_at':(START+timedelta(seconds=30*t['search_attempt'])).isoformat()}})
    async def release(t): releases.append(t['trip_id'])
    async def notify(*args): notifications.append(args)
    engine = RideSearch(db,real_filter=lambda q:q,offer=offer,release=release,notify=notify)
    return raw, db, engine, offers, releases, notifications

def tick(raw, engine, seconds):
    return engine.tick(raw.trips.find_one({'trip_id':'one-ride'}), START+timedelta(seconds=seconds))

@pytest.mark.parametrize('interval',[30,60])
def test_two_30_second_rounds_reuse_one_trip_and_stop_at_60(interval):
    raw, db, engine, offers, releases, messages = fixture(interval)
    async def run():
        for at in [0,29,30,31,59]: await tick(raw,engine,at)
        assert offers == [1,2]
        assert raw.trips.find_one()['status']=='searching'
        await asyncio.gather(tick(raw,engine,60),tick(raw,engine,60))
        assert raw.trips.find_one()['cancel_reason']=='no_driver_available'
        assert raw.trips.find_one()['search_state']=='exhausted'
        assert releases==['one-ride'] and len(messages)==1
        await tick(raw,engine,interval*10)
        assert len(offers)==2 and raw.trips.count_documents({})==1
        assert raw.trips.find_one()['payment_intent_id']=='existing-reservation'
    asyncio.run(run())

def test_nearby_matches_pickup_class_equipment_and_live_gps():
    from bson import ObjectId
    from typing import Optional
    raw=mongomock.MongoClient().db
    class Cursor:
        def __init__(self, cursor): self.it=iter(cursor)
        def __aiter__(self): return self
        async def __anext__(self):
            try: return next(self.it)
            except StopIteration: raise StopAsyncIteration
    class FindCollection(Collection):
        def find(self,*args,**kwargs):return Cursor(self.raw.find(*args,**kwargs))
    db=SimpleNamespace(users=FindCollection(raw.users),trips=Collection(raw.trips))
    now=datetime.now(timezone.utc)
    def driver(**changes):
        d={'_id':ObjectId(),'role':'driver','approved':True,'accepted_terms_at':now.isoformat(),'online':True,
           'last_location_at':now.isoformat(),'last_location_recorded_at':now.isoformat(),'last_location_session':{'exp':now.timestamp()+3600},'last_lat':59.91,'last_lng':10.76,'vehicle_type':'premium','capabilities':['child_seat']}
        d.update(changes);raw.users.insert_one(d);return d
    good=driver()
    for changes in ({'online':False},{'approved':False},{'demo':True},{'active_trip_id':'busy'},
                    {'last_location_at':(now-timedelta(seconds=61)).isoformat()},
                    {'last_lat':60.8},{'vehicle_type':'ai-first'},{'capabilities':[]},{'disabled':True}): driver(**changes)
    async def assigned(d,required=False):return {'vehicle_type':d['vehicle_type'],'car':'Actual car','plate':'AB12345'}
    async def compliance(*args):return {'operational':True}
    async def suspended(*args):return False
    env={'NearbyCarsRequest':SimpleNamespace,'Request':SimpleNamespace,'db':db,'datetime':datetime,'timedelta':timedelta,
         'timezone':timezone,'GPS_FRESH_SECONDS':2,'RADIUS_KM':5,'math':__import__('math'),
         'media_versions':__import__('driver_media').media_versions,
         'road_eta': SimpleNamespace(enrich=lambda cars, destination: [car.update(eta_min=None) for car in cars]),
         'position_bounds':__import__('live_cars').position_bounds,'fresh_sample_time':__import__('live_cars').fresh_sample_time,
         '_session_is_current':lambda session,user:True,'_session_is_revoked':suspended,
         'ride_testing':SimpleNamespace(driver_supply_filter=lambda test:{},is_test_customer=lambda uid:False),
         '_real_trip_filter':lambda q:q,'_fleet_is_suspended':suspended,'_assigned_fleet_vehicle':assigned,
         '_driver_shift_compliance':compliance,'haversine_km':lambda a,b,c,d:abs(c-a)*111+abs(d-b)*55,
         '_driver_supports_special_needs':lambda d,needs:set(needs).issubset(d.get('capabilities',[]))}
    nearby=function('_nearby_cars_snapshot',env)
    result=asyncio.run(nearby(SimpleNamespace(lat=59.91,lng=10.75,vehicle_type='premium',special_needs=['child_seat']),{'id':'customer'}))
    assert [c['id'] for c in result['cars']]==[str(good['_id'])]
    assert result['gps_fresh_seconds']==2

def test_persisted_search_survives_restart_and_background():
    raw, db, engine, offers, releases, _ = fixture()
    async def run():
        await tick(raw,engine,0)
        restarted = RideSearch(db,real_filter=lambda q:q,offer=engine.offer,release=engine.release,notify=engine.notify)
        await tick(raw,restarted,31)
        assert raw.trips.find_one()['search_attempt']==2 and offers==[1,2]
        await tick(raw,restarted,90)
        assert releases==['one-ride']
    asyncio.run(run())

def test_start_clock_is_bank_authorization_not_creation():
    raw,_,_,_,_,_ = fixture()
    fields=search_fields(raw.trips.find_one(),START)
    assert fields['search_started_at']==START.isoformat()
    assert fields['search_deadline_at']==(START+timedelta(seconds=60)).isoformat()
    assert search_fields({'pricing_snapshot':{'search_interval_seconds':999}},START)['search_interval_seconds']==30

def test_sequential_offer_preserves_response_window_and_advances_on_expiry():
    raw,_,engine,offers,releases,_=fixture()
    async def run():
        await tick(raw,engine,0)
        raw.trips.update_one({}, {'$set':{'dispatch_mode':'sequential','offer_expires_at':(START+timedelta(seconds=40)).isoformat()}})
        await tick(raw,engine,30)
        assert offers==[1] and raw.trips.find_one()['search_attempt']==2
        await tick(raw,engine,40)
        assert offers==[1,2] and not releases
    asyncio.run(run())

def test_concurrent_round_only_one_dispatch_and_acceptance_wins_timeout():
    raw,_,engine,offers,releases,_=fixture()
    async def run():
        await tick(raw,engine,0)
        await asyncio.gather(tick(raw,engine,30),tick(raw,engine,30))
        assert offers==[1,2]
        stale=raw.trips.find_one()
        raw.trips.update_one({}, {'$set':{'status':'driver_on_way','driver_id':'accepted'}})
        await engine.tick(stale,START+timedelta(seconds=60))
        assert raw.trips.find_one()['status']=='driver_on_way' and not releases
    asyncio.run(run())

def test_legacy_search_is_bounded_and_customer_cancellation_not_repeated():
    raw,_,engine,offers,releases,_=fixture()
    raw.trips.update_one({}, {'$unset':{'authorized_at':''}})
    asyncio.run(tick(raw,engine,0))
    assert raw.trips.find_one()['status']=='cancelled' and offers==[]
    raw,_,engine,offers,releases,_=fixture()
    raw.trips.update_one({}, {'$set':{'status':'cancelled','cancelled_by':'customer'}})
    asyncio.run(tick(raw,engine,90))
    assert not releases and not offers

def test_deadline_releases_existing_stripe_intent_without_create_or_capture():
    raw,db,engine,_,_,_=fixture()
    record={'trip_id':'one-ride','user_id':'one-customer','kind':'ride_reservation',
            'stripe_payment_intent_id':'pi_existing','stripe_customer_id':'cus_existing','authorized_amount_ore':10000}
    raw.payment_transactions.insert_one(record)
    pi={'id':'pi_existing','status':'requires_capture','currency':'nok','amount':10000,'customer':'cus_existing',
        'metadata':{'trip_id':'one-ride','user_id':'one-customer','source':'snar_ride_reservation'}}
    calls=[]
    def retrieve(pid): calls.append(('retrieve',pid));return dict(pi)
    def cancel(pid, params, options):
        calls.append(('cancel',pid,options['idempotency_key'])); pi['status']='canceled';return dict(pi)
    reservations=RideReservations(db,SimpleNamespace(StripeError=RuntimeError),mark_paid=None,receipts=None,push=None,dispatch=None,destination=None)
    reservations.client=lambda:SimpleNamespace(v1=SimpleNamespace(payment_intents=SimpleNamespace(retrieve=retrieve,cancel=cancel)))
    engine.release=reservations.release
    async def run():
        await tick(raw,engine,0); await tick(raw,engine,90); await tick(raw,engine,93)
        assert calls==[('retrieve','pi_existing'),('cancel','pi_existing','snar-release-one-ride')]
        assert raw.trips.find_one()['reservation_status']=='released'
        assert raw.payment_transactions.count_documents({})==1
    asyncio.run(run())

def function(name, env):
    tree=ast.parse((Path(__file__).parents[1]/'server.py').read_text())
    fn=next(n for n in tree.body if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)) and n.name==name)
    fn.decorator_list=[]
    exec(compile(ast.Module(body=[fn],type_ignores=[]),'<real-server-function>','exec'),env)
    return env[name]

def test_broadcast_retry_requeries_and_offers_newly_online_driver():
    raw,db,engine,_,_,_=fixture(); pushed=[];online=[]
    async def candidates(*args,**kwargs): return online
    async def commission(trip): return .1
    async def push(*args,**kwargs):pushed.append(args[0])
    from typing import Optional
    env={'Optional':Optional,'db':db,'ride_search':engine,'_dispatch_candidates':candidates,
         '_required_driver_capabilities':lambda needs:[],'_commission_for_trip':commission,
         '_real_trip_filter':lambda q:q,'send_push_to_user':push,'datetime':datetime,'timezone':timezone,
         'timedelta':timedelta,'DISPATCH_OFFER_SECONDS':30}
    engine.offer=function('offer_trip_to_next_driver',env)
    async def run():
        await tick(raw,engine,0); assert raw.trips.find_one()['dispatch_mode']=='sequential'
        online.append({'id':'new-online-driver','km':1})
        await tick(raw,engine,30)
        assert raw.trips.find_one()['offer_driver_id']=='new-online-driver' and pushed==['new-online-driver']
    asyncio.run(run())

def test_initial_dispatch_and_retry_cannot_duplicate_driver_offer():
    raw,db,engine,_,_,_=fixture(); pushed=[]
    async def candidates(*args,**kwargs):
        await asyncio.sleep(0)
        return [{'id':'one-driver','km':1}]
    async def commission(trip):return .1
    async def push(*args,**kwargs):pushed.append(args[0])
    from typing import Optional
    env={'Optional':Optional,'db':db,'ride_search':engine,'_dispatch_candidates':candidates,
         '_required_driver_capabilities':lambda needs:[],'_commission_for_trip':commission,
         '_real_trip_filter':lambda q:{'$and':[{'demo':{'$ne':True}},q]},'send_push_to_user':push,
         'datetime':datetime,'timezone':timezone,'timedelta':timedelta,'DISPATCH_OFFER_SECONDS':30}
    offer=function('offer_trip_to_next_driver',env)
    async def run():
        trip=await engine.ensure_started(raw.trips.find_one(),START)
        await asyncio.gather(offer(trip),offer(trip))
        assert pushed==['one-driver']
        assert raw.trips.find_one()['offer_seq']==1
    asyncio.run(run())


def test_cancel_is_customer_owned_idempotent_and_never_cancels_accepted_trip():
    raw, _, engine, _, releases, _ = fixture()
    async def run():
        assert not await engine.cancel('one-ride', 'another-customer')
        assert await engine.cancel('one-ride', 'one-customer')
        assert await engine.cancel('one-ride', 'one-customer')
        assert releases == ['one-ride']
        raw.trips.update_one({}, {'$set':{'status':'driver_on_way', 'driver_id':'accepted'}})
        assert not await engine.cancel('one-ride', 'one-customer')
        assert raw.trips.find_one()['status'] == 'driver_on_way'
    asyncio.run(run())
