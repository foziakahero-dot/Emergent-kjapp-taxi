const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const req = createRequire(path.resolve(__dirname, '../frontend/package.json'));
const React = req('react'), renderer = req('react-test-renderer'), ts = req('typescript');
const {QueryClient, QueryClientProvider} = req('@tanstack/react-query');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const host = name => ({children,...props}) => React.createElement(name,props,children);
const noop = () => {};
const records = new Map();
let writeFailure = false, delayedRead;
const storage = {
  getItem: async key => delayedRead ? delayedRead : records.get(key) || null,
  setItem: async (key,value) => { if(writeFailure) throw Error('device full'); records.set(key,value); },
};
const common = {
  react:React, 'react/jsx-runtime':req('react/jsx-runtime'), '@tanstack/react-query':req('@tanstack/react-query'),
  'react-native':{Pressable:host('Pressable'),View:host('View')},
  '@/src/utils/storage':{storage}, './Typography':{Text:host('Text')},
  './V10Icon':{V10Icon:host('Icon')},
  './V10UI':{V10Group:host('Group'),V10Section:host('Section'),v10:{}},
  '@/src/theme':{colors:new Proxy({},{get:()=>'#123456'}),font:{semibold:'Geist'},useColorTheme:noop},
};
const cache = new Map();
function load(file) {
  if(cache.has(file)) return cache.get(file);
  const full = path.resolve(__dirname,'..',file), module={exports:{}};
  const code = ts.transpileModule(fs.readFileSync(full,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code,{exports:module.exports,module,require:name=>{
    if(common[name]) return common[name];
    if(name==='@/src/lib/usePaymentPreference') return load('frontend/src/lib/usePaymentPreference.ts');
    if(name.startsWith('.')) return load(path.relative(path.resolve(__dirname,'..'),path.resolve(path.dirname(full),name+'.ts')));
    throw Error('Unexpected dependency: '+name);
  },console});
  cache.set(file,module.exports);return module.exports;
}
const persistence = load('frontend/src/lib/paymentPreference.ts');
const hooks = load('frontend/src/lib/usePaymentPreference.ts');
const {PaymentPreferenceSection} = load('frontend/src/components/PaymentPreferenceSection.tsx');
const byId = (tree,id) => tree.root.findAll(n=>typeof n.type==='string'&&n.props.testID===id)[0];
const client = () => new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});
const wrap = (qc,child) => React.createElement(QueryClientProvider,{client:qc},child);
const flush = () => renderer.act(async()=>{await new Promise(resolve=>setTimeout(resolve,10));});

test('device choice survives reload, is account-scoped and falls back safely for corrupt data',async()=>{
  records.clear();
  assert.equal(await persistence.readPaymentPreference('customer-a'),'card');
  await persistence.savePaymentPreference('customer-a','cash');
  assert.equal(await persistence.readPaymentPreference('customer-a'),'cash');
  assert.equal(await persistence.readPaymentPreference('customer-b'),'card');
  records.set('snar_payment_preference_v1:customer-b','invalid');
  assert.equal(await persistence.readPaymentPreference('customer-b'),'card');
  writeFailure=true;
  await assert.rejects(persistence.savePaymentPreference('customer-a','card'));
  writeFailure=false;
  assert.equal(await persistence.readPaymentPreference('customer-a'),'cash');
});

test('late hydration cannot override an explicit booking choice or leak it to another account',async()=>{
  let resolveRead, selection, tree;
  delayedRead=new Promise(resolve=>resolveRead=resolve);
  const qc=client();
  function Probe({id}) { selection=hooks.useBookingPaymentChoice(id); return null; }
  await renderer.act(async()=>{tree=renderer.create(wrap(qc,React.createElement(Probe,{id:'customer-a'})));});
  assert.equal(selection.ready,false);
  await renderer.act(async()=>selection.select('cash'));
  assert.equal(selection.choice,'cash'); assert.equal(selection.ready,true);
  delayedRead=null; resolveRead('card'); await flush();
  assert.equal(selection.choice,'cash');
  await renderer.act(async()=>tree.update(wrap(qc,React.createElement(Probe,{id:'customer-b'}))));
  await flush();
  assert.equal(selection.choice,'card');
  await renderer.act(async()=>tree.unmount()); qc.clear();
});

test('profile preference persists cash without card APIs, updates observers, and respects availability',async()=>{
  records.clear(); const qc=client(); let tree,booking;
  function Probe() {booking=hooks.useBookingPaymentChoice('customer-a');return null;}
  const props={userId:'customer-a',cashEnabled:true,cardEnabled:true,configReady:true};
  const render = p => wrap(qc,React.createElement(React.Fragment,null,React.createElement(PaymentPreferenceSection,p),React.createElement(Probe)));
  await renderer.act(async()=>{tree=renderer.create(render(props));}); await flush();
  await renderer.act(async()=>byId(tree,'payment-preference-cash').props.onPress()); await flush();
  assert.equal(booking.choice,'cash');
  assert.equal(byId(tree,'payment-preference-cash').props.accessibilityState.checked,true);
  assert.match(JSON.stringify(tree.toJSON()),/Kontant er valgt for neste tur/);
  await renderer.act(async()=>tree.update(render({...props,cashEnabled:false})));
  assert.equal(byId(tree,'payment-preference-cash').props.disabled,true);
  assert.match(JSON.stringify(tree.toJSON()),/Kontantbetaling er ikke tilgjengelig nå/);
  await renderer.act(async()=>tree.update(render({...props,configReady:false})));
  assert.equal(byId(tree,'payment-preference-card').props.disabled,true);
  await renderer.act(async()=>tree.unmount()); qc.clear();
});

test('failed device save does not report success or change the confirmed preference',async()=>{
  records.clear(); const qc=client(); let tree;
  await renderer.act(async()=>{tree=renderer.create(wrap(qc,React.createElement(PaymentPreferenceSection,{userId:'customer-error',cashEnabled:true,cardEnabled:true,configReady:true})));});
  await flush(); writeFailure=true;
  await renderer.act(async()=>byId(tree,'payment-preference-cash').props.onPress()); writeFailure=false;
  assert.ok(byId(tree,'payment-preference-error'));
  assert.equal(byId(tree,'payment-preference-notice'),undefined);
  assert.equal(qc.getQueryData(persistence.paymentPreferenceKey('customer-error')),'card');
  await renderer.act(async()=>tree.unmount()); qc.clear();
});
