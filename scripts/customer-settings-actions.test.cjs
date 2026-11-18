/** Render the real settings screens with isolated native/HTTP adapters. */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const {createRequire} = require('node:module');
const root = path.resolve(__dirname, '..'), req = createRequire(path.join(root,'frontend/package.json'));
const React = req('react'), renderer = req('react-test-renderer'), ts = req('typescript'), query = req('@tanstack/react-query');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const host = name => ({children,...props}) => React.createElement(name, props, children);
const noop = () => {};
let mode = 'share', trips = null, readTrip = async () => trips, pickup = async (_id,value) => ({ok:true,waiting_inside:value});
let shareLink = async () => ({url:'https://qa.example.invalid/tur/fixture'}), ai = async () => {throw {response:{status:503}};};
let ticket = async () => ({data:{ok:true,ticket_id:'fixture-ticket'}}), failStorage = false;
let shareCalls = 0, pickupCalls = 0, ticketCalls = 0, aiCalls = 0, exportCalls = 0, nativeImports = 0;
let user = {id:'fixture-customer',email:'qa@example.invalid',fullName:'QA Customer',legal_accepted:true}, backCalls = 0;
let placeRecords = [], placeWrites = [];
const navigations = [], cache = new Map(), stored = new Map();
const colors = new Proxy({}, {get:()=>'#123456'});
const stubs = {
 react:React, 'react/jsx-runtime':req('react/jsx-runtime'), '@tanstack/react-query':query,
 'react-native':{View:host('View'),Text:host('Text'),TextInput:host('TextInput'),Pressable:host('Pressable'),ScrollView:host('ScrollView'),KeyboardAvoidingView:host('KeyboardAvoidingView'),ActivityIndicator:host('Loader'),Modal:({visible,children,...props})=>visible?React.createElement('Modal',props,children):null,Platform:{OS:'android'},Linking:{openURL:async()=>{}},Share:{sharedAction:'sharedAction',share:async()=>{shareCalls++;return {action:'sharedAction'};}}},
 'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:24,bottom:24})},
 'expo-constants':{default:{expoConfig:{version:'fixture'}}},
 'expo-router':{useRouter:()=>({push:value=>navigations.push(value),replace:value=>navigations.push(value),back:()=>backCalls++}),useLocalSearchParams:()=>({mode})},
 '@/src/context/AuthContext':{useAuth:()=>({user,logout:async()=>{}})},
 '@/src/theme':{colors,font:{},useColorTheme:noop,useTheme:()=>({colors}),makeStyles:fn=>()=>fn(colors)},
 '@/src/utils/storage':{storage:{getItem:async key=>stored.get(key)||null,setItem:async(key,value)=>{if(failStorage)throw Error('Device storage unavailable');stored.set(key,value);}}},
 '@/src/components/Typography':{Text:host('Text'),TextInput:host('TextInput')},
 '@/src/components/V10UI':Object.fromEntries(['V10Action','V10Group','V10Header','V10Row','V10Screen','V10Section','V10State'].map(name=>[name,host(name)])),
 '@/src/components/V10Entrance':{V10Entrance:host('Entrance')},
 '@/src/components/ThemeModeRow':{ThemeModeRow:host('ThemeModeRow')},
 '@/src/components/DesignToggle':{DesignToggle:host('Toggle')},
 '@/src/components/Icon':{Icon:host('Icon')},
 '@/src/components/Motion':{useReducedMotion:()=>true},
 '@/src/components/ui':{Button:host('Button'),Loader:host('Loader')},
 '@/src/lib/format':{apiError:e=>e?.response?.data?.detail||e?.message||'Request failed'},
 '@/src/lib/api':{tripsApi:{active:()=>readTrip(),pickupPreference:(...args)=>{pickupCalls++;return pickup(...args);}},safetyApi:{shareLink:(...args)=>shareLink(...args),log:async()=>({ok:true})},gdprApi:{export:async()=>{exportCalls++;return {trips:[]};},delete:async()=>{throw Error('Deletion not invoked by these tests');}},aiApi:{chat:(...args)=>{aiCalls++;return ai(...args);}},api:{post:(...args)=>{ticketCalls++;return ticket(...args);}}},
};
let backHandler, hasHistory=true;
stubs['react-native'].AppState={currentState:'active',addEventListener:()=>({remove:noop})};
stubs['react-native'].BackHandler={addEventListener:(_event,fn)=>{backHandler=fn;return {remove:noop};}};
stubs['expo-router'].router={canGoBack:()=>hasHistory,back:()=>backCalls++,replace:value=>navigations.push(value)};
stubs['expo-router'].useSegments=()=>['customer-data'];
stubs['expo-router'].useFocusEffect=callback=>React.useEffect(callback,[callback]);
Object.assign(stubs['react-native'], {StyleSheet:{absoluteFill:{}}, Keyboard: {dismiss:noop}});
stubs['@/src/components/FigmaGradient']={FigmaGradient:host('FigmaGradient')};
stubs['@/src/components/CustomerPhoto']={CustomerPhoto:host('CustomerPhoto')};
stubs['@/src/components/V10Icon']={V10Icon:host('V10Icon')};
stubs['@/src/lib/usePaymentPreference']={usePaymentPreference:()=>({choice:'cash'})};
stubs['@/src/components/BookingPrimitives']={confirmedPaymentMethod:()=>null};
Object.assign(stubs['@/src/components/V10UI'], {V10Badge: host('Badge')});
Object.assign(stubs['@/src/lib/format'], {kr:n=>`${n} kr`,vehicleMeta:()=>({name:'SNAR'})});
Object.assign(stubs['@/src/lib/api'], {
 mePlacesApi:{
  list:async()=>({places:placeRecords}),
  add:async value=>{placeWrites.push(value);placeRecords=[...placeRecords,{...value,id:'fixture-favorite'}];},
  update:async (id,value)=>{placeWrites.push({id,...value});placeRecords=placeRecords.map(place=>place.id===id?{...value,id}:place);},
 },
 placesApi:{search:async()=>({results:[{name:'Fixture address',lat:59.91,lng:10.75}]})},
 paymentApi:{list:async()=>[]},
});
function saveFixtureLabel(label) {
 stubs['expo-router'].useLocalSearchParams=()=>({label});
}
stubs['./snar10/Island']={Island:host('Island')};
stubs['@/src/lib/tripPresence']={driverPresence:()=>({fresh:true})};
stubs['@/src/components/FloatingTabBar']={FloatingTabBar:host('Dock'),TabBarVisibilityProvider:host('Visibility'),TabScene:host('Scene')};
stubs['@/src/components/V10UI'].v10 = {};
stubs['@/src/components/V10UI'].V10Row=({right,children,...props})=>React.createElement('V10Row',props,children,right);
stubs['./Typography'] = stubs['@/src/components/Typography'];
stubs['./V10UI'] = stubs['@/src/components/V10UI'];
function load(relative) {
 const absolute=path.join(root,'frontend',relative);
 if(cache.has(absolute))return cache.get(absolute).exports;
 const module={exports:{}};cache.set(absolute,module);
 const compiled=ts.transpileModule(fs.readFileSync(absolute,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 vm.runInNewContext(compiled,{module,exports:module.exports,console,Date,setTimeout,clearTimeout,
 require(name){if(name==='expo-file-system'||name==='expo-sharing'){nativeImports++;throw Error('Native export intentionally unavailable');}if(stubs[name])return stubs[name];if(name.startsWith('@/'))return load(name.slice(2)+(name.endsWith('Row')?'.tsx':'.ts'));if(name.startsWith('./'))return load(path.relative(path.join(root,'frontend'),path.resolve(path.dirname(absolute),name+'.ts')));throw Error('Unexpected import: '+name);}}, {filename:absolute});
 return module.exports;
}
const language=load('src/lib/customerLanguage.ts');
stubs['@/src/lib/customerLanguage']=language;
stubs['@/src/components/LanguageRow']=load('src/components/LanguageRow.tsx');
const Settings=load('app/settings.tsx').default, TripSettings=load('app/customer-trip-settings.tsx').default, Data=load('app/customer-data.tsx').default, Support=load('src/components/CustomerSupport.tsx').CustomerSupport;
const {act}=renderer;
const wait=()=>new Promise(resolve=>setTimeout(resolve,15));
async function mount(Component,props={}) {
 const client=new query.QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});let tree;
 await act(async()=>{tree=renderer.create(React.createElement(query.QueryClientProvider,{client},React.createElement(Component,props)));await wait();});
 await act(wait);
 await act(wait);
 return {tree,client,close:async()=>{await act(async()=>tree.unmount());client.clear();}};
}
const node=(tree,id)=>tree.root.findAll(n=>typeof n.type==='string'&&n.props.testID===id)[0];
const text=tree=>tree.root.findAll(n=>typeof n.type==='string').flatMap(n=>[n.props.title,n.props.label,n.props.subtitle,n.props.body,typeof n.props.children==='string'?n.props.children:'']).filter(v=>typeof v==='string').join(' | ');
const active=(status='driver_on_way')=>({trip_id:'fixture-trip',status,pickup_address:'Fixture pickup',dropoff_address:'Fixture destination',pickup_waiting_inside:false});

test('settings rows navigate to their distinct trip and privacy screens; language persists and translates',async()=>{
 const page=await mount(Settings), {tree}=page;
 await act(async()=>node(tree,'settings-trip-share').props.onPress());
 await act(async()=>node(tree,'settings-pickup-instructions').props.onPress());
 await act(async()=>node(tree,'settings-data').props.onPress());
 assert.deepEqual(JSON.parse(JSON.stringify(navigations)),[{pathname:'/customer-trip-settings',params:{mode:'share'}},{pathname:'/customer-trip-settings',params:{mode:'pickup'}},'/customer-data']);
 await act(async()=>node(tree,'settings-language').props.onPress());
 await act(async()=>node(tree,'language-choice-en').props.onPress());
 assert.equal(stored.get(language.CUSTOMER_LANGUAGE_KEY),'en');assert.ok(text(tree).includes('Settings'));assert.ok(text(tree).includes('Share trip'));
 await act(async()=>node(tree,'settings-language').props.onPress());
 failStorage=true;await act(async()=>node(tree,'language-choice-nb').props.onPress());
 assert.ok(node(tree,'language-save-error'));assert.ok(text(tree).includes('Settings'));assert.equal(stored.get(language.CUSTOMER_LANGUAGE_KEY),'en');
 failStorage=false;await act(async()=>node(tree,'language-choice-nb').props.onPress());await page.close();
 // Rehydrate in a fresh module instance, as on a cold launch.
 stored.set(language.CUSTOMER_LANGUAGE_KEY,'en');cache.delete(path.join(root,'frontend/src/lib/customerLanguage.ts'));
 const cold=load('src/lib/customerLanguage.ts');let current;
 function Harness(){current=cold.useTranslation();return null;}
 const coldPage=await mount(Harness);assert.equal(current.language,'en');assert.equal(current.t('Innstillinger'),'Settings');await coldPage.close();stored.set(language.CUSTOMER_LANGUAGE_KEY,'nb');
});

test('share: empty/offline states never redirect or create links; live trip opens native sharing',async()=>{
 const before=navigations.length;trips=null;mode='share';let links=0;shareLink=async()=>{links++;return {url:'https://qa.example.invalid/tur/fixture'};};
 let page=await mount(TripSettings);assert.ok(text(page.tree).includes('Ingen aktiv tur'));assert.equal(links,0);assert.equal(navigations.length,before);await page.close();
 readTrip=async()=>{throw Error('Offline');};page=await mount(TripSettings);assert.ok(text(page.tree).includes('Kunne ikke hente aktiv tur'));assert.equal(links,0);await page.close();
 readTrip=async()=>trips;trips=active('in_trip');page=await mount(TripSettings);assert.equal(links,0);
 await act(async()=>node(page.tree,'settings-share-trip').props.onPress());assert.equal(shareCalls,1);assert.equal(links,1);await page.close();
 // Trip finishes between query and button tap: no share token is requested.
 trips=active();page=await mount(TripSettings);trips=null;
 await act(async()=>node(page.tree,'settings-share-trip').props.onPress());assert.equal(links,1);assert.ok(node(page.tree,'trip-settings-error'));await page.close();
 // Do not open the share sheet after the screen was closed.
 trips=active();let resolveLink;shareLink=()=>new Promise(resolve=>resolveLink=resolve);page=await mount(TripSettings);
 let pending;await act(async()=>{pending=node(page.tree,'settings-share-trip').props.onPress();await wait();});await page.close();
 await act(async()=>{resolveLink({url:'https://qa.example.invalid/tur/fixture'});await pending;});assert.equal(shareCalls,1);
});

test('pickup: saves only server-confirmed state; failed acknowledgement and wrong phase cannot save',async()=>{
 mode='pickup';trips=active('at_pickup');let page=await mount(TripSettings);
 assert.ok(node(page.tree,'settings-waiting-inside'),text(page.tree));
 assert.equal(node(page.tree,'settings-waiting-inside').props.value,false);
 await act(async()=>node(page.tree,'settings-waiting-inside').props.onChange(true));await act(wait);
 assert.equal(node(page.tree,'settings-waiting-inside').props.value,true);assert.ok(node(page.tree,'trip-settings-saved'));await page.close();
 pickup=async()=>({ok:false,waiting_inside:true});page=await mount(TripSettings);
 await act(async()=>node(page.tree,'settings-waiting-inside').props.onChange(true));
 assert.equal(node(page.tree,'settings-waiting-inside').props.value,false);assert.ok(node(page.tree,'trip-settings-error'));assert.equal(node(page.tree,'trip-settings-saved'),undefined);await page.close();
 const before=pickupCalls;trips=active('in_trip');page=await mount(TripSettings);assert.equal(node(page.tree,'settings-waiting-inside'),undefined);assert.equal(pickupCalls,before);await page.close();
});

test('privacy opens without settings API or native export module and stays on screen after export failure',async()=>{
 const before=navigations.length,page=await mount(Data);
 assert.ok(node(page.tree,'customer-data-screen'));assert.ok(node(page.tree,'gdpr-export'));assert.equal(exportCalls,0);assert.equal(nativeImports,0);assert.equal(navigations.length,before);
 await act(async()=>node(page.tree,'gdpr-export').props.onPress());assert.equal(exportCalls,1);assert.ok(nativeImports>0);assert.ok(node(page.tree,'gdpr-export-info'));assert.equal(navigations.length,before);assert.ok(node(page.tree,'customer-data-screen'));await page.close();
});

test('AI 503 preserves draft and offers human support; only confirmed ticket clears draft',async()=>{
 const page=await mount(Support,{onBack:noop,initialMessage:'Jeg trenger hjelp til en testtur.'}),{tree}=page;
 await act(async()=>node(tree,'support-send').props.onPress());assert.equal(aiCalls,1);assert.equal(ticketCalls,0);assert.ok(node(tree,'support-human-fallback'));assert.equal(node(tree,'support-retry'),undefined);assert.ok(node(tree,'support-message-input').props.value.includes('testtur'));
 ticket=async()=>({data:{ok:false}});await act(async()=>node(tree,'support-human-send').props.onPress());assert.equal(ticketCalls,1);assert.ok(node(tree,'support-message-input').props.value.includes('testtur'));assert.ok(!text(tree).includes('fixture-ticket'));
 ticket=async()=>({data:{ok:true,ticket_id:'fixture-ticket'}});await act(async()=>node(tree,'support-human-send').props.onPress());assert.equal(ticketCalls,2);assert.equal(node(tree,'support-message-input').props.value,'');assert.equal(node(tree,'support-human-fallback'),undefined);assert.ok(text(tree).includes('fixture-ticket'));assert.equal(aiCalls,1);await page.close();
});


test('Android back returns to the preceding settings screen before falling back to home',async()=>{
 const Shell=load('src/components/GlobalCustomerShell.tsx').GlobalCustomerShell;trips=null;const before=navigations.length,oldBack=backCalls;
 const page=await mount(Shell,{children:React.createElement('PrivacyScreen')});
 assert.equal(typeof backHandler,'function');
 hasHistory=true;await act(async()=>assert.equal(backHandler(),true));assert.equal(backCalls,oldBack+1);assert.equal(navigations.length,before);
 hasHistory=false;await act(async()=>assert.equal(backHandler(),true));assert.equal(navigations.at(-1),'/(app)/home');await page.close();
});

test('English account shortcuts use the canonical place key and open support chat',async()=>{
 const Profile=load('app/(app)/profile.tsx').default;
 placeRecords=[{id:'fixture-home',label:'Hjem',name:'Min adresse'}];
 await act(async()=>language.saveCustomerLanguage('en'));
 const page=await mount(Profile), {tree}=page;
 const home=node(tree,'profile-place-home'), work=node(tree,'profile-place-work'), help=node(tree,'profile-ai-help');
 assert.equal(home.props.title,'Home');
 assert.equal(home.props.subtitle,'Min adresse');
 assert.match(work.props.subtitle,/one tap/);
 assert.equal(help.props.title,'AI support chat');
 await act(async()=>{home.props.onPress();help.props.onPress();});
 assert.deepEqual(JSON.parse(JSON.stringify(navigations.slice(-2))),[{pathname:'/saved-places',params:{label:'Hjem'}},'/support-chat']);
 await page.close();
});

test('named favorites save once and an existing favorite can be edited',async()=>{
 saveFixtureLabel(undefined);
 const SavedPlaces=load('app/saved-places.tsx').default;
 placeRecords=[];placeWrites=[];
 const page=await mount(SavedPlaces), {tree}=page;
 async function chooseAddress() {
  await act(async()=>node(tree,'places-search-input').props.onChangeText('Fixture address'));
  await act(async()=>new Promise(resolve=>setTimeout(resolve,375)));
  await act(async()=>node(tree,'places-result-0').props.onPress());
 }
 await act(async()=>node(tree,'places-add').props.onPress());
 await chooseAddress();
 await act(async()=>node(tree,'places-custom-name').props.onChangeText(' Hjem '));
 assert.equal(node(tree,'places-save-favorite').props.disabled,true);
 await act(async()=>node(tree,'places-custom-name').props.onChangeText(' Trening '));
 await act(async()=>{const save=node(tree,'places-save-favorite').props.onPress;save();save();});
 await act(wait);
 assert.equal(placeWrites.length,1);
 assert.equal(placeWrites[0].label,'Trening');
 assert.ok(node(tree,'place-fixture-favorite'));
 await act(async()=>node(tree,'place-edit-fixture-favorite').props.onPress());
 await chooseAddress();
 assert.equal(node(tree,'places-custom-name').props.value,'Trening');
 await act(async()=>node(tree,'places-custom-name').props.onChangeText('Barnehage'));
 await act(async()=>node(tree,'places-save-favorite').props.onPress());
 assert.equal(placeWrites[1].id,'fixture-favorite');
 assert.equal(placeWrites[1].label,'Barnehage');
 await page.close();
});

test('Activity reconfirms a changed cancellation fee and sends one request',async()=>{
 const History=load('app/(app)/history.tsx').default;
 let fee=0, requests=0;
 trips={...active(),driver_id:'fixture-driver',driver:{name:'Testsjåfør'},eta_min:3,eta_updated_at:new Date().toISOString()};
 Object.assign(stubs['@/src/lib/api'].tripsApi, {
  list:async()=>[],
  cancelPreview:async()=>({cancellation_fee:fee,currency:'NOK'}),
  cancel:async()=>{requests++;trips=null;return {ok:true};},
 });
 const page=await mount(History), {tree}=page;
 assert.match(JSON.stringify(tree.toJSON()),/Testsjåfør/);
 assert.match(JSON.stringify(tree.toJSON()),/Henting om ca\./);
 await act(async()=>node(tree,'history-cancel-trip').props.onPress());
 assert.equal(requests,0);
 await act(async()=>node(tree,'history-cancel-keep').props.onPress());
 assert.equal(node(tree,'history-cancel-confirm'),undefined);
 await act(async()=>node(tree,'history-cancel-trip').props.onPress());
 fee=42;
 await act(async()=>node(tree,'history-cancel-confirm').props.onPress());
 assert.match(text(tree),/42 kr/);
 assert.equal(requests,0);
 await act(async()=>{const confirm=node(tree,'history-cancel-confirm').props.onPress;confirm();confirm();});
 await act(wait);
 assert.equal(requests,1);
 assert.equal(node(tree,'history-active-trip'),undefined);
 await page.close();
});
