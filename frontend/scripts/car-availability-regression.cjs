const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
const ts = require(root+'/node_modules/typescript');
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (mod,file) => mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,file);
const { CarAvailabilitySearch, rideSearchProgress, carExpiry, visibleCars } = require(root+'/src/lib/carAvailability.ts');
const { fitMapView, mapContentInsets, mapFocusPoints } = require(root+'/src/lib/mapFocus.ts');
const flush = async()=>{for(let i=0;i<6;i++) await Promise.resolve();};
function clock(){ let now=0,id=0;const jobs=new Map();return {now:()=>now,set(fn,ms){jobs.set(++id,{fn,at:now+ms});return id},clear(i){jobs.delete(i)},async advance(ms){const end=now+ms;while(true){const entries=[...jobs].filter(([,j])=>j.at<=end).sort((a,b)=>a[1].at-b[1].at);if(!entries.length)break;const [i,j]=entries[0];now=j.at;jobs.delete(i);j.fn();await flush();}now=end;await flush();},jobs};}
(async()=>{
 for(const offline of [false,true]){
  const time=clock(),calls=[];const s=new CarAvailabilitySearch(async()=>{calls.push(time.now());if(offline)throw Error('network');return {cars:[]}},()=>{},false,time);
  s.setActive(true);await flush();assert.equal(s.state.issue,offline?'offline':'empty');assert.equal(s.state.attempt,1);
  await time.advance(29_999);assert.deepEqual(calls,[0]);
  await time.advance(1);assert.equal(s.state.attempt,2);
  await time.advance(30_000);assert.equal(s.state.attempt,3);assert.equal(s.state.phase,'waiting');
  await time.advance(30_000);assert.equal(s.state.phase,'exhausted');
  await time.advance(90_000);assert.deepEqual(calls,[0,30_000,60_000]);
  s.retry();await flush();assert.equal(calls.length,4);assert.equal(s.state.attempt,1);s.dispose();
 }
 console.log('PASS: exactly three 30-second attempts; final wait, empty vs offline, manual reset');
 {
  const time=clock();let calls=0,resolve;const s=new CarAvailabilitySearch(()=>{calls++;return new Promise(r=>resolve=r)},()=>{},false,time);
  s.setActive(true);s.setActive(true);s.retry();await time.advance(60_000);assert.equal(calls,1);
  s.dispose();resolve({cars:[{id:'d',lat:59.9,lng:10.7}]});await flush();assert.deepEqual(s.state.cars,[]);assert.equal(time.jobs.size,0);
 }
 {
  const time=clock();let calls=0;const s=new CarAvailabilitySearch(async()=>{calls++;return {cars:[]}},()=>{},false,time);
  s.setActive(true);await flush();s.setActive(false);await time.advance(40_000);assert.equal(calls,1);
  s.setActive(true);await flush();assert.equal(calls,2);s.dispose();
 }
 console.log('PASS: no concurrent requests, no stale unmounted response, background pause and resume');
 {
  const time=clock();let calls=0;
  const car={id:'new-online-driver',lat:59.92,lng:10.79,updated_at:new Date(30_000).toISOString()};const s=new CarAvailabilitySearch(async()=>({cars:++calls===2?[car,{id:'bad',lat:NaN,lng:10}]:[],server_time:new Date(time.now()).toISOString(),gps_fresh_seconds:60}),()=>{},false,time);
  s.setActive(true);await flush();await time.advance(30_000);assert.deepEqual(s.state.cars,[car]);assert.equal(s.state.phase,'available');
  await time.advance(8_000);assert.equal(s.state.issue,'empty');assert.equal(s.state.attempt,1);s.dispose();
 }
 {
  const time=clock();let calls=0;const s=new CarAvailabilitySearch(async()=>{calls++;return {cars:[]}},()=>{},true,time);
  s.setActive(true);await flush();await time.advance(96_000);assert.equal(calls,13);assert.notEqual(s.state.phase,'exhausted');s.dispose();
 }
 console.log('PASS: newly online car shown, invalid GPS hidden, live supply refresh continues while server searches');
 {
  const receivedAt=1_000_000, server=Date.parse('2026-10-16T00:00:00Z');
  const reply={server_time:new Date(server).toISOString(),gps_fresh_seconds:60};
  const car={id:'real',lat:59.9,lng:10.7,updated_at:new Date(server-59_000).toISOString()};
  const deadline=carExpiry(car,reply,receivedAt);
  assert.equal(deadline,receivedAt+1000,'Server age is independent of the device clock');
  const state={cars:[car],expiresAt:{real:deadline}};
  assert.equal(visibleCars(state,receivedAt+999).length,1);
  assert.equal(visibleCars(state,receivedAt+1000).length,0,'No expired marker between network refreshes');
  for(const updated_at of [undefined,'invalid',new Date(server-60_000).toISOString(),new Date(server+60_000).toISOString()]) assert.equal(carExpiry({...car,updated_at},reply,receivedAt),0);
 }
 {
  const time=clock();let resolve,calls=0;const snapshots=[];
  const s=new CarAvailabilitySearch(()=>{calls++;return new Promise(r=>resolve=r)},v=>snapshots.push(v),true,time);
  s.setActive(true);await flush();s.setActive(false);s.setActive(true);
  resolve({cars:[{id:'old-flight',lat:59.9,lng:10.7,updated_at:new Date(0).toISOString()}],server_time:new Date(0).toISOString(),gps_fresh_seconds:60});await flush();
  assert.equal(s.state.cars.length,0,'An old response cannot revive markers after background/resume');
  assert.equal(calls,2,'Resume requests a fresh snapshot after the old request settles');s.dispose();
 }
 console.log('PASS: GPS expiry, invalid/missing timestamps, device clock skew and background/resume race');
 const pickup={lat:59.91,lng:10.75},car={lat:59.94,lng:10.82},far={lat:60.8,lng:11.1};
 assert.deepEqual(mapFocusPoints({pickup,user:pickup,dropoff:far,cars:[car],focusMode:'nearby'}),[pickup,car]);
 assert.deepEqual(mapFocusPoints({pickup,dropoff:far,activeCar:car,cars:[{lat:20,lng:20}],focusMode:'route'}),[pickup,far,car]);
 assert.deepEqual(mapFocusPoints({pickup,cars:[{lat:NaN,lng:1},{lat:91,lng:10},car,car],focusMode:'nearby'}),[pickup,car]);
 const progress=rideSearchProgress({search_attempt:2,search_next_attempt_at:'2026-10-09T01:01:00Z',search_deadline_at:'2026-10-09T01:01:30Z'},Date.parse('2026-10-09T01:00:35Z'));
 assert.equal(progress.seconds,25);assert.equal(progress.label,'Forsøk 2 av 3');
 console.log('PASS: map frames pickup and real cars, preserves assigned route, canonical countdown');
 const project=(p,z)=>{const size=256*2**z,s=Math.sin(p.lat*Math.PI/180);return {x:(p.lng+180)/360*size,y:(0.5-Math.log((1+s)/(1-s))/(4*Math.PI))*size};};
 for(const [width,height,insets,points] of [
  [390,844,{top:184,right:48,bottom:442,left:48},[pickup,car]],
  [390,844,{top:136,right:48,bottom:492,left:48},[pickup,car]],
  [360,640,{top:160,right:48,bottom:330,left:48},[pickup,car]],
  [390,844,{top:136,right:48,bottom:492,left:48},[pickup]],
  [844,390,{top:70,right:48,bottom:210,left:48},[pickup,car]],
 ]){
  const fitted=fitMapView(points,width,height,insets),center=project(fitted.center,fitted.zoom);
  for(const p of points){const world=project(p,fitted.zoom),x=world.x-center.x+width/2,y=world.y-center.y+height/2;
   assert.ok(x>=insets.left-0.001&&x<=width-insets.right+0.001,'Car/pickup must fit between side overlays');
   assert.ok(y>=insets.top-0.001&&y<=height-insets.bottom+0.001,'Car/pickup must stay below search and above booking card');
  }
 }
 const small=mapContentInsets(320,500,{top:220,right:48,bottom:460,left:48});
 assert.ok(500-small.top-small.bottom>=64);
 console.log('PASS: cars and single pickup fit the unobscured viewport on compact, tall and landscape screens');
})().catch(e=>{console.error(e);process.exitCode=1});
