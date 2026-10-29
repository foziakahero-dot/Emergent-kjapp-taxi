const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {createRequire}=require('node:module');
const req=createRequire(path.resolve(__dirname,'../driver-app/package.json'));
const ts=req('typescript'),React=req('react'),renderer=req('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
function load(file,mocks={}){
  const module={exports:{}};
  const source=ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../driver-app/src/lib',file),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(source,{module,exports:module.exports,require:n=> n in mocks?mocks[n]:req(n),
    process:{env:{EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN:'pk.test'}},Date,setTimeout,clearTimeout,console});
  return module.exports;
}
const {navigationTarget}=load('navigationTarget.ts');
const trip={trip_id:'test-trip',status:'driver_on_way',pickup_lat:59.9,pickup_lng:10.7,dropoff_lat:60,dropoff_lng:11,
  stops:[{lat:59.95,lng:10.9}]};
test('pickup ignores passenger stops; active trip includes ordered stops and destination',()=>{
  assert.equal(JSON.stringify(navigationTarget(trip).coordinates),'[[10.7,59.9]]');
  assert.equal(JSON.stringify(navigationTarget({...trip,status:'in_trip'}).coordinates),'[[10.9,59.95],[11,60]]');
  assert.notEqual(navigationTarget(trip).key,navigationTarget({...trip,status:'in_trip'}).key);
  for(const status of ['at_pickup','completed','arrived','cancelled']) assert.equal(navigationTarget({...trip,status}),null);
});
test('invalid destination or stop fails closed instead of silently skipping a stop',()=>{
  for(const pickup_lat of [null,undefined,NaN,Infinity,91,'59.9']) assert.equal(navigationTarget({...trip,pickup_lat}),null);
  assert.equal(navigationTarget({...trip,status:'in_trip',stops:[{lat:null,lng:11}]}),null);
  assert.equal(navigationTarget({...trip,status:'in_trip',stops:'invalid'}),null);
});

test('native session lifecycle, events, mute, denied background GPS and cancelled async start',async()=>{
  let hook,currentTrip=trip,allow=true,releaseFix;
  const events={},calls=[];
  const native={addListener:(n,f)=>{events[n]=f;return{remove:()=>{delete events[n]}}},
    start:async(...a)=>calls.push(['start',...a]),stop:async()=>calls.push(['stop']),setMuted:async v=>calls.push(['muted',v])};
  let fix=async()=>({timestamp:Date.now(),coords:{longitude:10.6,latitude:59.8}});
  const {useDriverNavigation}=load('useDriverNavigation.ts',{
    react:React,'react-native':{Platform:{OS:'android'}},expo:{requireOptionalNativeModule:()=>native},
    'expo-location':{Accuracy:{BestForNavigation:1},getCurrentPositionAsync:()=>fix()},
    './nativeRuntime':{startDriverBackgroundLocation:async()=>({foreground:true,background:allow})},
    './navigationTarget':{navigationTarget}});
  function Harness(){hook=useDriverNavigation(currentTrip);return null;}
  let root;await renderer.act(async()=>{root=renderer.create(React.createElement(Harness));});
  allow=false;await renderer.act(async()=>{await assert.rejects(hook.start(),/hele tiden/)});
  assert.equal(calls.filter(x=>x[0]==='start').length,0);
  allow=true;await renderer.act(async()=>{await hook.start()});
  const id=calls.find(x=>x[0]==='start')[1];assert.equal(hook.active,true);
  await renderer.act(async()=>{events.onInstruction({sessionId:'old',instruction:'Wrong trip'});});
  assert.equal(hook.instruction,'');
  await renderer.act(async()=>{events.onInstruction({sessionId:id,instruction:'Sving til høyre'});});
  assert.equal(hook.instruction,'Sving til høyre');
  await renderer.act(async()=>{await hook.toggleMuted()});assert.equal(hook.muted,true);
  currentTrip={...trip,status:'at_pickup'};
  await renderer.act(async()=>root.update(React.createElement(Harness)));
  assert.equal(hook.active,false);
  currentTrip={...trip,status:'in_trip'};
  await renderer.act(async()=>root.update(React.createElement(Harness)));
  fix=()=>new Promise(r=>{releaseFix=r});
  let pending;await renderer.act(async()=>{pending=hook.start();await Promise.resolve()});
  await renderer.act(async()=>{root.unmount()});
  releaseFix({timestamp:Date.now(),coords:{longitude:10.6,latitude:59.8}});await pending;
  assert.equal(calls.filter(x=>x[0]==='start').length,1);
  assert.equal(Object.keys(events).length,0);
});
