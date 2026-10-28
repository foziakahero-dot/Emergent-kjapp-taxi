import ast,asyncio,logging
from pathlib import Path
from types import SimpleNamespace
from datetime import datetime,timezone
class HTTPException(Exception):
 def __init__(self,status_code,detail): self.status_code=status_code
class Collection:
 def __init__(self,doc):self.doc=doc;self.race=False
 def match(self,q):return self.doc is not None and all(self.doc.get(k)==v for k,v in q.items())
 async def find_one(self,q):return dict(self.doc) if self.match(q) else None
 async def update_one(self,q,u):
  if self.race or not self.match(q):return SimpleNamespace(modified_count=0)
  self.doc.update(u.get('$set',{}))
  for k in u.get('$unset',{}):self.doc.pop(k,None)
  return SimpleNamespace(modified_count=1)
notifications=[];charges=[];push_fails=False
async def push(*args,**kw):
 notifications.append((args,kw))
 if push_fails and len(notifications)==1:raise RuntimeError('push channel unavailable')
async def charge(t):charges.append(t);return {'attempted':True}
ns=dict(HTTPException=HTTPException,datetime=datetime,timezone=timezone,ObjectId=str,_real_trip_filter=lambda x:x,_fresh_driver_location=lambda x:x=='fresh',haversine_km=lambda *x:distance,DROPOFF_ARRIVAL_RADIUS_M=300,send_push_to_user=push,_attempt_trip_auto_charge=charge,logging=logging)
from cash_payments import is_cash
ns['is_cash'] = is_cash
source_tree=ast.parse((Path(__file__).resolve().parents[1] / 'server.py').read_text())
tree=ast.Module(body=[n for n in source_tree.body if isinstance(n,ast.AsyncFunctionDef) and n.name == 'driver_arrive'],type_ignores=[])
for n in tree.body:
 if isinstance(n,ast.AsyncFunctionDef):n.decorator_list=[];n.args.defaults=[]
exec(compile(tree,'actual-server-endpoint','exec'),ns)
def setup(status='in_trip',km=3.6):
 global distance,push_fails
 distance=km;push_fails=False;notifications.clear();charges.clear()
 db=SimpleNamespace(trips=Collection({'trip_id':'t','driver_id':'d','user_id':'c','status':status,'dropoff_lat':59.,'dropoff_lng':10.,'price':167}),users=Collection({'_id':'d','active_trip_id':'t'}));ns['db']=db
 return db,{'id':'d','last_location_at':'fresh','last_lat':59.94,'last_lng':10.76}
async def reject(c,code):
 try:await ns['driver_arrive']('t',c)
 except HTTPException as e:assert e.status_code==code
 else:raise AssertionError('expected rejection')
async def main():
 db,c=setup();r=await ns['driver_arrive']('t',c)
 assert r['ok'] and r['ended_early'];assert db.trips.doc['status']=='arrived'
 assert db.trips.doc['actual_dropoff_lat']==c['last_lat'];assert db.trips.doc['price_review_required']
 assert 'active_trip_id' not in db.users.doc;assert not charges
 assert [n[0][0] for n in notifications]==['c','d'];assert all(n[0][4]=='trip_ended_early' for n in notifications)
 r=await ns['driver_arrive']('t',c);assert r['already_applied'] and r['ended_early'];assert len(notifications)==2
 db,c=setup(km=.02);r=await ns['driver_arrive']('t',c);assert not r['ended_early'];assert len(charges)==1;assert notifications[0][0][1]=='Du er fremme'
 db,c=setup();c['id']='other';await reject(c,404);assert db.trips.doc['status']=='in_trip'
 db,c=setup('at_pickup');await reject(c,409)
 db,c=setup();c['last_location_at']='stale';r=await ns['driver_arrive']('t',c)
 assert r['ok'] and not r['location_verified'];assert db.trips.doc['actual_dropoff_lat'] is None
 assert db.trips.doc['last_known_driver_lat']==c['last_lat'];assert db.trips.doc['end_reason']=='gps_unavailable'
 assert db.trips.doc['price_review_required'] and not charges and len(notifications)==2
 assert 'active_trip_id' not in db.users.doc
 db,c=setup();c['last_lat']=None;r=await ns['driver_arrive']('t',c)
 assert r['ok'] and db.trips.doc['actual_dropoff_lat'] is None and not charges
 db,c=setup();db.trips.race=True;await reject(c,409);assert not notifications and not charges;assert db.users.doc['active_trip_id']=='t'
 db,c=setup();global push_fails;push_fails=True
 logging.disable(logging.CRITICAL)
 r=await ns['driver_arrive']('t',c);assert r['ok'] and len(notifications)==2 and not charges
 print('9 ride-end checks passed, including stale/missing GPS manual ending, unknown actual position, both alerts and payment hold.')
def test_early_ride_ending():
 try:
  asyncio.run(main())
 finally:
  logging.disable(logging.NOTSET)

if __name__ == '__main__':
 test_early_ride_ending()
