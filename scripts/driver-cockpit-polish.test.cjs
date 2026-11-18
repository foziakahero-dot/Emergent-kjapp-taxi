const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {createRequire}=require('node:module');
const req=createRequire(path.resolve(__dirname,'../frontend/package.json'));
const React=req('react'),renderer=req('react-test-renderer'),ts=req('typescript');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const host=name=>({children,...props})=>React.createElement(name,props,children);
function setup(){
 let reduced=false,now=0,nextFrame=0;const frames=new Map(),cache={};
 const colors=new Proxy({}, {get:(_,name)=>name});
 const native={useWindowDimensions:()=>({width:360,fontScale:1}),View:host('View'),Pressable:host('Pressable'),StyleSheet:{absoluteFill:{}}};
 const mocks={react:React,'react/jsx-runtime':req('react/jsx-runtime'),'react-native':native,
  'react-native-safe-area-context':{useSafeAreaInsets:()=>({bottom:34})},
  '@/src/theme':{useColorTheme(){},colors,font:{}},'@/src/lib/format':{kr:n=>`${n} kr`},
  './Typography':{Text:host('Text')},'./V10Icon':{V10Icon:host('Icon')},'./snar10/Glass':{Glass:host('Glass')},
  './Motion':{useReducedMotion:()=>reduced}};
 function component(name,extension='tsx'){
  if(cache[name])return cache[name];const module={exports:{}};
  const source=fs.readFileSync(path.resolve(__dirname,'../driver-app/src/components',name+'.'+extension),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,require:n=>n==='./DriverHomeChrome'?component('DriverHomeChrome'):mocks[n]||(()=>{throw Error(n)})(),
    Date:{now:()=>now},requestAnimationFrame:callback=>{frames.set(++nextFrame,callback);return nextFrame;},cancelAnimationFrame:id=>frames.delete(id)});
  return cache[name]=module.exports;
 }
 return {component,frames,reduce:()=>reduced=true,async tick(ms){now+=ms;const scheduled=[...frames.values()];frames.clear();await renderer.act(async()=>scheduled.forEach(f=>f()));}};
}
const text=tree=>JSON.stringify(tree.toJSON());
const byId=(tree,id)=>tree.root.findAll(n=>typeof n.type==='string'&&n.props.testID===id)[0];

test('driver KPIs distinguish missing data from a real zero and use server-paid trips',async()=>{
 const h=setup(),{DriverOnlineHeader}=h.component('DriverHomeChrome');let tree,earnings=0,offline=0;
 const props={ready:true,busy:false,onEarnings:()=>earnings++,onOffline:()=>offline++};
 await renderer.act(async()=>{tree=renderer.create(React.createElement(DriverOnlineHeader,props));});
 assert.equal(byId(tree,'driver-kpi-0').props.children,'—');
 await renderer.act(async()=>tree.update(React.createElement(DriverOnlineHeader,{...props,summary:{income:0,trips:0,online_minutes:125}})));
 assert.equal(byId(tree,'driver-kpi-0').props.children,'0 kr');assert.equal(byId(tree,'driver-kpi-1').props.children,'0');
 assert.equal(byId(tree,'driver-kpi-2').props.children,'2 t 5 min');assert.match(text(tree),/Betalte turer/);
 await renderer.act(async()=>byId(tree,'driver-today-earnings').props.onPress());assert.equal(earnings,1);
 await renderer.act(async()=>byId(tree,'driver-go-offline').props.onPress());assert.equal(offline,1);
 await renderer.act(async()=>tree.update(React.createElement(DriverOnlineHeader,{...props,ready:false,busy:true})));
 assert.equal(byId(tree,'driver-go-offline').props.disabled,true);assert.doesNotMatch(byId(tree,'driver-go-offline').props.accessibilityLabel,/^Online/);
 await renderer.act(async()=>tree.unmount());
});
test('the single waiting card never promises availability during reconnect or missing GPS',async()=>{
 const h=setup(),{DriverWaitingCard}=h.component('DriverHomeChrome');let tree,height;
 const props={connected:true,gpsReady:true,plate:'QA-TEST',onHeight:n=>height=n};
 await renderer.act(async()=>{tree=renderer.create(React.createElement(DriverWaitingCard,props));});
 assert.match(text(tree),/Venter på neste tur/);assert.match(text(tree),/GPS aktiv/);
 byId(tree,'driver-online-status').props.onLayout({nativeEvent:{layout:{height:182}}});assert.equal(height,182);
 await renderer.act(async()=>tree.update(React.createElement(DriverWaitingCard,{...props,connected:false})));
 assert.match(text(tree),/Kobler til SNAR/);assert.doesNotMatch(text(tree),/Vi varsler deg når en tur er klar/);
 await renderer.act(async()=>tree.update(React.createElement(DriverWaitingCard,{...props,gpsReady:false})));
 assert.match(text(tree),/GPS avventer/);assert.doesNotMatch(text(tree),/GPS aktiv/);
 await renderer.act(async()=>tree.unmount());
});
test('driver navigation keeps route selection and long press, and exposes the selected tab',async()=>{
 const h=setup(),{DriverDock}=h.component('DriverDock');let tree;const selected=[],held=[];
 const props={items:[{id:'home',icon:'home',label:'Hjem'},{id:'trips',icon:'trip',label:'Turer'}],active:'home',onSelect:x=>selected.push(x),onLongPress:x=>held.push(x)};
 await renderer.act(async()=>{tree=renderer.create(React.createElement(DriverDock,props));});
 assert.equal(byId(tree,'tab-home').props.accessibilityState.selected,true);
 await renderer.act(async()=>byId(tree,'tab-trips').props.onPress());await renderer.act(async()=>byId(tree,'tab-home').props.onLongPress());
 assert.deepEqual(selected,['trips']);assert.deepEqual(held,['home']);
 await renderer.act(async()=>tree.update(React.createElement(DriverDock,{...props,active:'trips'})));
 assert.equal(byId(tree,'tab-trips').props.accessibilityState.selected,true);assert.equal(byId(tree,'tab-home').props.accessibilityState.selected,false);
 await renderer.act(async()=>tree.unmount());
});
test('car movement handles north and stationary heading updates by the shortest turn',async()=>{
 const h=setup(),{useSmoothPosition}=h.component('useSmoothPosition','ts');let tree,pos;
 function Probe({target}){pos=useSmoothPosition(target,1000);return null;}
 const point={lat:59.9,lng:10.7,heading:350};
 await renderer.act(async()=>{tree=renderer.create(React.createElement(Probe,{target:point}));});
 await renderer.act(async()=>tree.update(React.createElement(Probe,{target:{...point,heading:10}})));
 await h.tick(500);assert.ok(pos.heading<15||pos.heading>345,`short turn: ${pos.heading}`);
 await h.tick(500);assert.equal(pos.heading,10);
 await renderer.act(async()=>tree.update(React.createElement(Probe,{target:{...point,heading:0}})));
 await h.tick(1000);assert.equal(pos.heading,0);
 await renderer.act(async()=>tree.unmount());assert.equal(h.frames.size,0);
});
test('GPS loss, reduced motion and interrupted fixes cannot leave stale animation running',async()=>{
 const h=setup(),{useSmoothPosition}=h.component('useSmoothPosition','ts');let tree,pos;
 function Probe({target}){pos=useSmoothPosition(target,1000);return null;}
 const point={lat:59.9,lng:10.7,heading:90};
 await renderer.act(async()=>{tree=renderer.create(React.createElement(Probe,{target:point}));});
 await renderer.act(async()=>tree.update(React.createElement(Probe,{target:{...point,lat:59.901}})));
 await h.tick(200);assert.equal(h.frames.size,1);
 await renderer.act(async()=>tree.update(React.createElement(Probe,{target:null})));
 assert.equal(pos,null);assert.equal(h.frames.size,0);
 h.reduce();await renderer.act(async()=>tree.update(React.createElement(Probe,{target:{...point,heading:0}})));
 assert.equal(pos.heading,0);assert.equal(pos.lat,point.lat);assert.equal(h.frames.size,0);
 await renderer.act(async()=>tree.unmount());
});
