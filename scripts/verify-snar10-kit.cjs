/** Behavioral/source-contract checks. Native visual parity requires device captures. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const root = path.resolve(__dirname, '..');
const req = createRequire(path.join(root, 'frontend/package.json'));
const React = req('react'), renderer = req('react-test-renderer'), ts = req('typescript');
const {act} = renderer;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let mode='light', segments=['support'], trip={trip_id:'owned-trip',status:'searching'}, stale=false;
const navigation=[], invalidations=[], cache=new Map();
const error=console.error; console.error=(...a)=>{if(!String(a[0]).includes('react-test-renderer is deprecated'))error(...a)};
const native={View:'View',Pressable:'Pressable',Text:'Text',TextInput:'TextInput',Image:'Image',ScrollView:'ScrollView',ActivityIndicator:'Spinner',
  StyleSheet:{absoluteFill:{position:'absolute',inset:0},create:x=>x,hairlineWidth:1,flatten:x=>Array.isArray(x)?Object.assign({},...x.map(native.StyleSheet.flatten)):x||{}},
  AppState:{currentState:'active',addEventListener:()=>({remove(){}})},BackHandler:{addEventListener:()=>({remove(){}})}};
function load(app,file){
  const abs=path.join(root,app,file);if(cache.has(abs))return cache.get(abs).exports;
  const m={exports:{}};cache.set(abs,m);
  const localRequire=name=>{
    if(name==='react')return React;if(name==='react/jsx-runtime')return req(name);if(name==='react-native')return native;
    if(name==='expo-blur')return{BlurView:'BlurView',BlurTargetView:'BlurTargetView'};
    if(name==='react-native-safe-area-context')return{useSafeAreaInsets:()=>({top:44,bottom:34,left:0,right:0})};
    if(name==='@/src/theme')return{useColorTheme:()=>({effective:mode}),colors:new Proxy({}, {get:(_,key)=>{
      const t=load(app,'src/theme/snar10.ts')[mode==='dark'?'darkColors':'colors'];
      const aliases={text:'textPrimary',textMuted:'textTertiary',accent:'primary',accentOn:'onPrimary',success:'positive',danger:'critical',cardSubtle:'surfaceSubtle',lineStrong:'dividerStrong'};
      return t[aliases[key]||key]??key;
    }}),font:{medium:'Geist_500Medium',semibold:'Geist_600SemiBold',body:'Geist_400Regular'}};
    if(name==='@/src/components/Typography')return{Text:'Text',TextInput:'TextInput'};
    if(name==='@/src/components/V10Icon'||name==='@/src/components/Icon')return{V10Icon:'Icon',Icon:'Icon'};
    if(name==='@/src/components/V10Entrance')return{V10Entrance:({children,...p})=>React.createElement('Entrance',p,children)};
    if(name==='@/src/components/FigmaGradient')return{FigmaGradient:'Gradient'};
    if(name==='@/src/context/AuthContext')return{useAuth:()=>({user:{id:'customer-a',role:'user',legal_accepted:true}})};
    if(name==='@/src/lib/api')return{tripsApi:{active:async()=>trip}};
    if(name==='@/src/lib/tripPresence')return{driverPresence:()=>({fresh:true})};
    if(name==='expo-router')return{useSegments:()=>segments,router:{push:p=>navigation.push(p),replace:p=>navigation.push(p)}};
    if(name==='@tanstack/react-query')return{useQuery:()=>({data:trip,isError:stale}),useQueryClient:()=>({invalidateQueries:async q=>invalidations.push(q)})};
    const rel=name.startsWith('@/')?name.slice(2):path.join(path.dirname(file),name);
    const target=[rel+'.tsx',rel+'.ts',path.join(rel,'index.ts')].find(p=>fs.existsSync(path.join(root,app,p)));
    if(target)return load(app,target);throw Error('Unexpected dependency '+name+' in '+file);
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(abs,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,
    {module:m,exports:m.exports,require:localRequire,console,setTimeout,clearTimeout},{filename:abs});return m.exports;
}
const host=(tree,id)=>tree.root.findAll(n=>n.type==='Pressable'&&n.props.testID===id)[0];
async function mount(C){let tree;await act(async()=>{tree=renderer.create(React.createElement(C),{createNodeMock:e=>e.type==='BlurTargetView'?{nativeView:true}:null})});return tree;}
(async()=>{
  const contract=JSON.parse(fs.readFileSync(path.join(root,'docs/snar-v10/CURRENT_FLEET_V2_SCREEN_INDEX_20261014.json')));
  for(const product of ['customer','driver'])for(const screen of contract[product])for(const p of screen.native_paths)assert.ok(fs.existsSync(path.join(root,p)),`${product}/${screen.id}: missing ${p}`);
  assert.equal(contract.customer.length,36);assert.equal(contract.driver.length,30);
  for(const app of ['frontend','driver-app']){
    const tokens=load(app,'src/theme/snar10.ts');assert.equal(tokens.typography.display.letterSpacing,-1.4);assert.equal(tokens.typography.over.letterSpacing,.66);
    assert.equal(tokens.colors.glass,'rgba(255,255,255,.78)');assert.equal(tokens.darkColors.map.water,'#07111C');assert.equal(tokens.dock.itemRadius,16);
    const {FloatingTabBar,TabBarVisibilityProvider,TabScene}=load(app,'src/components/FloatingTabBar.tsx');
    const names=app==='frontend'?['home','history','assist','messages','profile']:['home','earnings','intel','messages','profile'];
    const routes=names.map(name=>({name,key:'key-'+name}));let focused=0,prevent=false;const calls=[];
    const props=()=>({driver:app==='driver-app',state:{index:focused,routes},descriptors:Object.fromEntries(routes.map(r=>[r.key,{options:{title:r.name}}])),navigation:{emit:e=>{calls.push(e);return{defaultPrevented:prevent}},navigate:(...a)=>calls.push(a)}});
    const C=()=>React.createElement(TabBarVisibilityProvider,null,React.createElement(TabScene,{routeKey:routes[focused].key},React.createElement('Content')),React.createElement(FloatingTabBar,props()));
    let tree=await mount(C);assert.equal(tree.root.findAll(n=>n.type==='Pressable'&&n.props.accessibilityRole==='tab').length,5);
    const blur=tree.root.findByType('BlurView');assert.ok(blur.props.blurTarget.current?.nativeView,'focused scene target must be a mounted native view');
    assert.equal(blur.props.blurMethod,'dimezisBlurViewSdk31Plus');assert.equal(tree.root.findAll(n=>n.type==='View'&&n.props.testID==='snar10-glass-tint').length,1,'exactly one tint layer');
    prevent=true;await act(async()=>host(tree,'tab-'+names[3]).props.onPress());assert.equal(calls.filter(Array.isArray).length,0,'preventDefault blocks navigation');
    prevent=false;await act(async()=>host(tree,'tab-'+names[3]).props.onPress());assert.equal(calls.filter(Array.isArray).at(-1)[0],names[3]);
    const ai=names[2];assert.equal(native.StyleSheet.flatten(host(tree,'tab-'+ai).props.style({pressed:false})).height,52);
    assert.equal(host(tree,'tab-'+ai).findByType('Icon').props.color,tokens.colors.onInverse,'inverse icon remains bright even when inactive');
    assert.equal(tree.root.findAll(n=>n.type==='View'&&String(n.props.testID||'').startsWith('dock-unread-')).length,0,'no fabricated unread status');
    mode='dark';focused=2;await act(async()=>tree.update(React.createElement(C)));
    assert.equal(tree.root.findByType('BlurView').props.tint,'dark');assert.equal(host(tree,'tab-'+ai).props.accessibilityState.selected,true);
    assert.ok(tree.root.findAll(n=>n.type==='View'&&n.props.testID==='dock-active-'+ai).length);
    await act(async()=>tree.unmount());mode='light';
    const {Sheet}=load(app,'src/components/snar10/Sheet.tsx');tree=await mount(()=>React.createElement(Sheet,null,React.createElement('Content')));
    assert.equal(tree.root.findByType('Gradient').props.angle,165);assert.equal(tree.root.findByType('ScrollView').props.contentContainerStyle.paddingBottom,34);await act(async()=>tree.unmount());
    const {Button}=load(app,'src/components/snar10/Button.tsx');tree=await mount(()=>React.createElement(Button,{label:'Fortsett',busy:true,testID:'busy'}));
    assert.equal(host(tree,'busy').props.disabled,true);assert.equal(host(tree,'busy').props.accessibilityState.busy,true);await act(async()=>tree.unmount());
  }
  // The actual global shell must leave a search minimized until an explicit reopen.
  const {GlobalCustomerShell}=load('frontend','src/components/GlobalCustomerShell.tsx');
  let tree=await mount(()=>React.createElement(GlobalCustomerShell,null,React.createElement('Draft',{value:'retained'})));
  assert.deepEqual(navigation,[],'searching REST status cannot automatically reopen the booking screen');
  assert.ok(tree.root.findByType('BlurView').props.blurTarget.current?.nativeView,'detail dock has its own registered target');
  assert.ok(host(tree,'customer-journey-island'));await act(async()=>host(tree,'customer-journey-island').props.onPress());
  assert.equal(navigation.at(-1),'/booking/owned-trip');assert.equal(invalidations.length,1);
  trip={...trip,status:'completed'};await act(async()=>tree.update(React.createElement(GlobalCustomerShell,null,React.createElement('Draft',{value:'retained'}))));
  assert.equal(Boolean(host(tree,'customer-journey-island')),false,'completed trip removes the island');await act(async()=>tree.unmount());
  assert.equal(fs.readFileSync(path.join(root,'frontend/src/theme/snar10.ts'),'utf8'),fs.readFileSync(path.join(root,'driver-app/src/theme/snar10.ts'),'utf8'),'same canonical tokens in both independent Expo apps');
  console.log('PASS: 66 original screen entries retain adapters; both actual five-tab navigators preserve events, focus targets, one glass tint, inverse AI and theme; sheet/button guards; minimized search stays closed and explicit island reopens owned trip.');
})().catch(e=>{console.error(e);process.exitCode=1});
