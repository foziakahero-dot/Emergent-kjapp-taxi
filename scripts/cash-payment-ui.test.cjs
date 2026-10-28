const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const req = createRequire(path.resolve(__dirname, '../frontend/package.json'));
const React = req('react'), renderer = req('react-test-renderer'), ts = req('typescript');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const noop = () => {};
const host = name => ({children, ...props}) => React.createElement(name, props, children);
const components = new Proxy({}, {get: (_, name) => host(String(name))});
const colors = new Proxy({}, {get: () => '#123456'});
class Value { setValue() {} interpolate() { return 0; } }
const native = {View:host('View'),Text:host('Text'),Pressable:host('Pressable'),ScrollView:host('ScrollView'),Image:host('Image'),
  StyleSheet:{create:x=>x,absoluteFill:{},hairlineWidth:1},Platform:{OS:'android'},Animated:{Value,View:host('AnimatedView')},Easing:{bezier:noop}};
const common = {'react':React,'react/jsx-runtime':req('react/jsx-runtime'),'react-native':native,
  'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:24,bottom:0})},
  'expo-router':{useRouter:()=>({push:noop})},'expo-haptics':{impactAsync:async()=>{},ImpactFeedbackStyle:{}},
  '@/src/theme':{useColorTheme:noop,colors,font:{},themedStyles:fn=>fn()},
  '@/src/components/Motion':{useReducedMotion:()=>true},'@/src/lib/usePersonalShiftGoal':{usePersonalShiftGoal:()=>({goal:'2200',save:noop})},
  '@/src/components/Typography':{Text:host('Text')},'./Typography':{Text:host('Text')},
  '@/src/components/V10UI':{v10:{},V10Action:host('Action'),V10Group:host('Group'),V10Screen:host('Screen'),V10Header:host('Header'),V10Sheet:host('Sheet'),V10Badge:host('Badge')},
  '@/src/lib/format':{kr:n=>`${n} kr`},'@/src/lib/vehicleAssets':{CUSTOMER_VEHICLE_ART:{'ai-first':{label:'SNAR'},premium:{label:'Premium'},suv:{label:'SUV'}}}};
const cache = {};
function load(file) {
  if(cache[file]) return cache[file];
  const module = {exports:{}};
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code,{exports:module.exports,module,require:name=> name === '@/src/components/BookingPrimitives' ? load('frontend/src/components/BookingPrimitives.tsx') : common[name] || components,console,setInterval,clearInterval,Date});
  return cache[file]=module.exports;
}
const text = node => JSON.stringify(node.toJSON());
const byId = (node,id) => node.root.findAll(x=>x.props.testID===id && typeof x.type==='string')[0];
const booking = {stage:'payment',reviewing:false,pickup:'Oslo',destination:{name:'Majorstuen'},estimate:{duration_min:5},vehicle:'ai-first',price:173,nearest:2,methods:[],payment:{type:'cash'},cashEnabled:true,
  waitingPolicy:{token:'fixture',free_minutes:2,per_minute:4,max_fee:60},places:[],stops:[],onHeight:noop,onStage:noop,onPayment:()=>{throw Error('Cash must not require a card')},onBook:noop,onBack:noop,onReview:noop,busy:false,canBook:true,canReview:true};

test('customer availability explains automatic updates and actual nearby supply',async()=>{
  const {AvailabilityStatus}=load('frontend/src/components/AvailabilityStatus.tsx');let tree;
  const search={cars:[],phase:'loading',issue:null,now:0,retry:noop};
  await renderer.act(async()=>{tree=renderer.create(React.createElement(AvailabilityStatus,{compact:true,search}));});
  assert.match(text(tree),/Søker etter ledige biler i nærheten/);
  assert.match(text(tree),/Ledige biler oppdateres automatisk/);
  await renderer.act(async()=>tree.update(React.createElement(AvailabilityStatus,{compact:true,search:{...search,phase:'available',cars:[{id:'driver',eta_min:3}]}})));
  assert.match(text(tree),/1 ledig bil/);assert.match(text(tree),/3 min/);
  await renderer.act(async()=>tree.update(React.createElement(AvailabilityStatus,{compact:true,search:{...search,issue:'offline'}})));
  assert.match(text(tree),/Kan ikke oppdatere/);assert.equal(byId(tree,'availability-auto-update'),undefined);
  await renderer.act(async()=>tree.unmount());
});

test('cash can be selected without a card and is hidden when disabled',async()=>{
  const {CustomerBookingView}=load('frontend/src/components/CustomerBookingView.tsx');let tree,chosen;
  await renderer.act(async()=>{tree=renderer.create(React.createElement(CustomerBookingView,{...booking,payment:null,onPaymentChoice:x=>chosen=x}));});
  await renderer.act(async()=>byId(tree,'booking-pay-cash').props.onPress());
  assert.equal(chosen,'cash');
  await renderer.act(async()=>tree.update(React.createElement(CustomerBookingView,{...booking,cashEnabled:false})));
  assert.equal(byId(tree,'booking-pay-cash'),undefined);
  await renderer.act(async()=>tree.unmount());
});
test('cash review discloses direct payment and never promises a card hold',async()=>{
  let tree;const {CustomerBookingView}=load('frontend/src/components/CustomerBookingView.tsx');
  await renderer.act(async()=>{tree=renderer.create(React.createElement(CustomerBookingView,{...booking,reviewing:true}));});
  assert.match(text(tree),/Kontant til sjåføren/);assert.match(text(tree),/Ingen kortbelastning/);assert.doesNotMatch(text(tree),/Reserverer opptil/);
  assert.equal(byId(tree,'booking-confirm').props.disabled,false);
  await renderer.act(async()=>tree.unmount());
});
test('cash receipt waits for driver and never offers a second online payment',async()=>{
  let tree;const {CustomerReceiptView}=load('frontend/src/components/CustomerReceiptView.tsx');
  const props={trip:{trip_id:'cash',payment_flow:'cash',payment_status:'cash_due',price:173,status:'arrived'},initialReceipt:false,onRefresh:noop};
  await renderer.act(async()=>{tree=renderer.create(React.createElement(CustomerReceiptView,props));});
  assert.match(text(tree),/kontant direkte til sjåføren/);assert.equal(byId(tree,'receipt-pay'),undefined);
  await renderer.act(async()=>tree.update(React.createElement(CustomerReceiptView,{...props,initialReceipt:true,trip:{...props.trip,payment_status:'paid'}})));
  assert.match(text(tree),/Betalt kontant/);
  await renderer.act(async()=>tree.unmount());
});
test('cash completion prompts receipt before showing the earnings summary',async()=>{
  let tree,calls=0;const {DriverCockpitView}=load('driver-app/src/components/DriverCockpitView.tsx');
  const props={user:{id:'driver'},online:true,busy:false,summary:{},completed:{trip_id:'cash',payment_flow:'cash',payment_status:'cash_due',price:173},onCashReceived:()=>calls++};
  await renderer.act(async()=>{tree=renderer.create(React.createElement(DriverCockpitView,props));});
  assert.ok(byId(tree,'driver-cash-collection'));
  assert.match(text(tree),/Ta imot kontantbetaling/);assert.match(text(tree),/173 kr/);
  assert.doesNotMatch(text(tree),/Betaling avventer|SNAR må kontrollere/);
  assert.equal(byId(tree,'driver-summary-continue'),undefined);
  assert.equal(byId(tree,'driver-summary-screen'),undefined);
  await renderer.act(async()=>byId(tree,'driver-confirm-cash').props.onPress());assert.equal(calls,1);
  await renderer.act(async()=>tree.update(React.createElement(DriverCockpitView,{...props,busy:true})));
  assert.equal(byId(tree,'driver-confirm-cash').props.disabled,true);
  await renderer.act(async()=>tree.update(React.createElement(DriverCockpitView,{...props,completed:{...props.completed,price_review_required:true}})));
  assert.equal(byId(tree,'driver-confirm-cash').props.disabled,true);
  await renderer.act(async()=>tree.update(React.createElement(DriverCockpitView,{...props,completed:{...props.completed,payment_status:'paid',driver_earnings:173}})));
  assert.equal(byId(tree,'driver-cash-collection'),undefined);
  assert.ok(byId(tree,'driver-summary-screen'));
  assert.ok(byId(tree,'driver-summary-continue'));
  assert.match(text(tree),/Kontantbetaling bekreftet/);
  await renderer.act(async()=>tree.unmount());
});
