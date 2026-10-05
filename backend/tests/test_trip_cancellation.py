import ast,asyncio,os,sys
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace
from datetime import datetime,timezone
BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
import internal_ride_testing as ride_testing
class HTTPException(Exception):
 def __init__(self,status_code,detail):self.status_code=status_code
class Collection:
 def __init__(self,doc):self.doc=doc;self.updates=[];self.race=False
 def match(self,q):
  return self.doc is not None and all(self.doc.get(k) in v['$in'] if isinstance(v,dict) else self.doc.get(k)==v for k,v in q.items())
 async def find_one(self,q,*args):return dict(self.doc) if self.match(q) else None
 async def update_one(self,q,u):
  self.updates.append((q,u))
  if self.race or not self.match(q):return SimpleNamespace(modified_count=0)
  self.doc.update(u.get('$set',{}))
  for k in u.get('$unset',{}):self.doc.pop(k,None)
  return SimpleNamespace(modified_count=1)
async def pricing():return {'customer_cancellation_fee':50,'late_driver_cancellation_fee':75,'free_cancel_minutes':2}
async def push(*args):pass
ns=dict(ride_reservations=SimpleNamespace(release=push),ride_testing=ride_testing,HTTPException=HTTPException,datetime=datetime,timezone=timezone,active_pricing=pricing,send_push_to_user=push,ObjectId=str,InvalidId=ValueError,_real_trip_filter=lambda x:x)
server_tree=ast.parse((BACKEND / 'server.py').read_text())
names={'_customer_cancellable_statuses','cancel_trip_preview','cancel_trip','driver_cancel'}
tree=ast.Module(body=[n for n in server_tree.body if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)) and n.name in names],type_ignores=[])
for n in tree.body:
 if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)):n.decorator_list=[];n.args.defaults=[]
exec(compile(tree,'actual-server-functions','exec'),ns)
def setup(status='in_trip',test=True):
 t={'trip_id':'t','user_id':'c','driver_id':'d','status':status,'internal_beta_test':test,'created_at':'2020-01-01T00:00:00+00:00'}
 db=SimpleNamespace(trips=Collection(t),users=Collection({'_id':'d','active_trip_id':'t'}));ns['db']=db;return db
async def expect_error(fn,code):
 try:await fn()
 except HTTPException as e:assert e.status_code==code
 else:raise AssertionError('expected rejection')
async def main():
 db=setup();assert (await ns['cancel_trip_preview']('t',{'id':'c'}))['cancellation_fee']==0
 assert (await ns['cancel_trip']('t',{'id':'c'}))['ok'];assert db.trips.doc['status']=='cancelled';assert 'active_trip_id' not in db.users.doc
 assert (await ns['cancel_trip']('t',{'id':'c'}))['already_applied']
 setup(test=False);await expect_error(lambda:ns['cancel_trip']('t',{'id':'c'}),400)
 setup();await expect_error(lambda:ns['cancel_trip']('t',{'id':'outsider'}),404)
 db=setup();db.trips.doc['driver_id']='other';await expect_error(lambda:ns['cancel_trip']('t',{'id':'c'}),400)
 setup();os.environ['KJAPP_INTERNAL_RIDE_TEST_ENABLED']='false';await expect_error(lambda:ns['cancel_trip']('t',{'id':'c'}),400);os.environ['KJAPP_INTERNAL_RIDE_TEST_ENABLED']='true'
 db=setup('driver_on_way',False);assert (await ns['cancel_trip_preview']('t',{'id':'c'}))['cancellation_fee']==50
 db=setup();db.trips.race=True;await expect_error(lambda:ns['cancel_trip']('t',{'id':'c'}),409);assert db.users.doc['active_trip_id']=='t'
 db=setup('at_pickup');assert (await ns['driver_cancel']('t',{'id':'d'}))['ok'];assert db.trips.doc['driver_cancellation_penalty']==0;assert 'active_trip_id' not in db.users.doc
 assert (await ns['driver_cancel']('t',{'id':'d'}))['already_applied']
 setup();await expect_error(lambda:ns['driver_cancel']('t',{'id':'outsider'}),404)
 print('10 cancellation behavior checks passed (ownership, state race, fees, test isolation, lock cleanup, retry).')
def test_cancellation_behaviors():
 with patch.dict(os.environ, {'KJAPP_INTERNAL_RIDE_TEST_ENABLED':'true', 'STRIPE_SECRET_KEY':'sk_test_mock', 'KJAPP_INTERNAL_RIDE_TEST_CUSTOMER_IDS':'c', 'KJAPP_INTERNAL_RIDE_TEST_DRIVER_IDS':'d'}):
  asyncio.run(main())

if __name__ == '__main__':
 test_cancellation_behaviors()
