/** Behavioral checkpoint tests. Native visual/device validation remains separate. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const appRequire = createRequire(path.join(root, 'frontend/package.json'));
const React = appRequire('react');
const renderer = appRequire('react-test-renderer');
const ts = appRequire('typescript');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { act } = renderer;
let testClock = 0, testTimerId = 0, reduceMotion = false; const testTimers = new Map();
async function tick(milliseconds) { testClock += milliseconds; await act(async () => { for (const [id, timer] of [...testTimers]) if (timer.at <= testClock) { testTimers.delete(id); timer.callback(); } }); }
const originalError = console.error;
console.error = (...args) => { if (!String(args[0]).includes('react-test-renderer is deprecated')) originalError(...args); };
let user = null, navigation = [], permissionCalls = 0, permissionResult;
let loginResult, loginCalls = 0, logoutCalls = 0, vehicleResult, vehicleCalls = 0, currentTripId = 'trip-paid';
let queryData = {}, updates = [], storageWrites = [], sent = [], invalidated = [], updateResult, sendResult;
const router = Object.fromEntries(['push', 'replace', 'navigate', 'back'].map(method => [method, target => navigation.push([method, target])]));
class Value { constructor(value) { this.value = value; } setValue(value) { this.value = value; } stopAnimation() {} interpolate(config) { return config; } }
const native = {
  Animated: { Value, View: 'AnimatedView', timing: () => ({ start() {}, stop() {} }) }, Easing: { linear: value => value },
  View: 'View', Text: 'Text', TextInput: 'TextInput', Image: 'Image', Switch: 'Switch', KeyboardAvoidingView: 'KeyboardAvoidingView', ScrollView: 'ScrollView', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator',
  FlatList: ({ data, renderItem, ListEmptyComponent }) => React.createElement('FlatList', null, data.length ? data.map((item, index) => React.createElement(React.Fragment, { key: index }, renderItem({ item, index }))) : ListEmptyComponent),
  AppState: { addEventListener: () => ({ remove() {} }) }, Platform: { OS: 'ios' }, Linking: { openURL: async () => {} },
  StyleSheet: { create: value => value, hairlineWidth: 1, absoluteFill: { position: 'absolute', inset: 0 } },
};
const queryClient = { setQueryData: (key, data) => { const value = typeof data === 'function' ? data(queryData[key[0]]?.data) : data; updates.push([key, value]); queryData[key[0]] = { ...queryData[key[0]], data: value }; }, invalidateQueries: async x => invalidated.push(x.queryKey) };
const stubs = {
  'expo-status-bar': { StatusBar: 'StatusBar' },
  'expo-web-browser': { openBrowserAsync: async () => ({type:'dismiss'}) },
  '@/src/components/FigmaGradient': { FigmaGradient: 'Gradient' },
  '@/src/components/AppleSignInButton': { AppleSignInButton: 'AppleSignInButton' },
  '@/src/components/DesignField': { DesignField: ({action,...props}) => React.createElement('DesignField',props,action) },
  '@/src/components/SocialIcons': { GoogleIcon: 'GoogleIcon' },
  '@/src/components/VehicleAsset': { VehicleAsset: 'VehicleAsset' },
  'react-native-svg': new Proxy({ __esModule: true, default: 'Svg' }, { get: (target, key) => key in target ? target[key] : String(key) }),
  '@/src/components/Motion': { useReducedMotion: () => reduceMotion, Rise: ({children}) => React.createElement('Rise',null,children) },
  'react': React, 'react/jsx-runtime': appRequire('react/jsx-runtime'), 'react-native': native,
  'expo-router': { useRouter: () => router, useLocalSearchParams: () => ({ tripId: currentTripId }), useFocusEffect: callback => React.useEffect(callback, [callback]) },
  'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 48, bottom: 34 }) },
  'expo-location': { requestForegroundPermissionsAsync: () => { permissionCalls++; return permissionResult(); } },
  '@/src/context/AuthContext': { useAuth: () => ({ user, refresh: async () => {}, login: async (...args) => { loginCalls++; return loginResult(...args); }, logout: async () => { logoutCalls++; } }) },
  '@/src/components/Typography': { Text: 'Text', TextInput: 'TextInput' },
  '@/src/components/Map': { Map: 'Map' },
  '@/src/components/V10Icon': { V10Icon: 'Icon' },
  '@/src/components/Icon': { Icon: 'Icon' },
  '@/src/components/CustomerPhoto': { CustomerPhoto: 'CustomerPhoto' },
  '@/src/components/ui': { Loader: 'Loader' },
  '@/src/theme': { colors: {}, font: {}, useTheme: () => ({ colors: {}, font: {} }), useColorTheme: () => ({}), themedStyles: factory => factory(), makeStyles: factory => () => factory({}) },
  '@/src/lib/format': { apiError: error => error.message, vehicleMeta: () => ({ name: 'SNAR' }), kr: value => value == null ? '– kr' : Math.round(value) + ' kr' },
  '@/src/utils/storage': { storage: { setItem: async (...args) => storageWrites.push(args) } },
  '@tanstack/react-query': {
    useQueryClient: () => queryClient,
    useQuery: ({ queryKey }) => ({ isPending: false, isError: false, refetch: async () => {}, ...queryData[queryKey[0]] }),
  },
  '@/src/lib/api': {
    tripsApi: { active: async () => ({}), list: async () => ({}), get: async () => ({}) },
    mePlacesApi: { list: async () => ({}) }, paymentApi: { list: async () => ({}) },
    authApi: { me: async () => ({}) }, authenticatedFileSource: async () => null,
    apiError: error => error.message,
    driverApi: { summary: async () => ({}), weekly: async () => ({}), payouts: async () => ({}), vehicles: async () => ({}), history: async () => ({}), selectVehicle: async id => { vehicleCalls++; return vehicleResult(id); }, ratings: async () => ({}), current: async () => ({}), identityVerification: async () => ({}) },
    settingsApi: { get: async () => ({}), update: async data => { updates.push(['request', data]); return updateResult(data); } },
    messagesApi: { list: async () => ({}), send: async (...args) => { sent.push(args); return sendResult(); } },
  },
};
const cache = new Map();
function load(app, file) {
  const absolute = path.join(root, app, file);
  if (cache.has(absolute)) return cache.get(absolute);
  const module = { exports: {} };
  const compiled = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const localRequire = name => {
    if (stubs[name]) return stubs[name];
    if (name.startsWith('@/')) {
      const relative = name.slice(2);
      return load(app, relative + (fs.existsSync(path.join(root, app, relative + '.tsx')) ? '.tsx' : '.ts'));
    }
    throw new Error(`Unmocked dependency ${name}`);
  };
  vm.runInNewContext(compiled, { require: localRequire, module, exports: module.exports, console, Set, process: { env: {} }, setTimeout: (callback, delay) => { const id = ++testTimerId; testTimers.set(id, { callback, at: testClock + delay }); return id; }, clearTimeout: id => testTimers.delete(id), setInterval: () => ++testTimerId, clearInterval() {} }, { filename: absolute });
  cache.set(absolute, module.exports);
  return module.exports;
}
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const text = tree => JSON.stringify(tree.toJSON());
const button = (tree, id) => tree.root.findAll(node => node.type === 'Pressable' && node.props.testID === id)[0];
async function mount(Component) { let tree; await act(async () => { tree = renderer.create(React.createElement(Component)); }); return tree; }
async function unmount(tree) { await act(async () => tree.unmount()); }
(async()=>{
 user={id:'support-customer',email:'qa@example.test',fullName:'QA Customer'};
 let calls=0,tickets=[],answer=deferred();
 stubs['@/src/lib/api'].aiApi={chat:async()=>{calls++;return answer.promise;}};
 let ticketReply={data:{}};
 stubs['@/src/lib/api'].api={post:async(route,body)=>{tickets.push({route,body});return ticketReply;}};
 const Support=load('frontend','src/components/CustomerSupport.tsx').CustomerSupport;
 let tree;await act(async()=>{tree=renderer.create(React.createElement(Support,{onBack(){}}));});
 await act(async()=>tree.root.findByProps({testID:'support-message-input'}).props.onChangeText('Jeg trenger hjelp med betalingen'));
 await act(async()=>{button(tree,'support-send').props.onPress();button(tree,'support-send').props.onPress();});
 assert.equal(calls,1);
 await act(async()=>answer.reject(new Error('AI-assistenten er utilgjengelig')));
 assert.equal(tree.root.findByProps({testID:'support-message-input'}).props.value,'Jeg trenger hjelp med betalingen');
 assert.ok(button(tree,'support-retry'));
 answer=deferred();await act(async()=>button(tree,'support-retry').props.onPress());
 await act(async()=>answer.resolve({reply:'Confirmed provider answer'}));
 assert.equal(calls,2);
 assert.equal(tree.root.findAllByType('Text').filter(node=>node.props.children==='Jeg trenger hjelp med betalingen').length,1,'Retry does not add the same customer message again');
 await act(async()=>button(tree,'support-escalate').props.onPress());
 assert.equal(tickets[0].route,'/support/public');
 assert.equal(tickets[0].body.contact,'qa@example.test');
 assert.doesNotMatch(text(tree),/Henvendelsen er mottatt/,'An unconfirmed ticket is not reported as received');
 ticketReply={data:{ok:true,ticket_id:'actual-ticket'}};
 await act(async()=>button(tree,'support-escalate').props.onPress());
 assert.match(text(tree),/actual-ticket/);
 const count=tickets.length;await act(async()=>button(tree,'support-escalate').props.onPress());
 assert.equal(tickets.length,count,'An identical confirmed ticket is not recreated');
 await unmount(tree);
 user={id:'no-contact'};await act(async()=>{tree=renderer.create(React.createElement(Support,{onBack(){}}));});
 await act(async()=>tree.root.findByProps({testID:'support-message-input'}).props.onChangeText('Hjelp med en tur uten kontakt'));
 await act(async()=>button(tree,'support-escalate').props.onPress());
 assert.equal(tickets.length,count);assert.match(text(tree),/kontaktinformasjon/);
 await unmount(tree);
 // Support overview accepts the backend's actual array and hides failed cached trip data.
 user={id:'support-customer',email:'qa@example.test'};
 queryData={'customer-active-trip':{data:null},trips:{data:[{trip_id:'owned-trip',dropoff_address:'Actual destination'}]}};
 const Overview=load('frontend','app/support.tsx').default;tree=await mount(Overview);
 assert.match(text(tree),/Actual destination/);
 await act(async()=>button(tree,'customer-support-chat-open').props.onPress());
 assert.equal(navigation.at(-1)[1].params.tripId,'owned-trip');await unmount(tree);
 queryData={'customer-active-trip':{data:{trip_id:'stale-trip',dropoff_address:'Stale destination'},isError:true},trips:{isError:true,data:[{trip_id:'stale-history',dropoff_address:'Stale history'}]}};
 tree=await mount(Overview);assert.doesNotMatch(text(tree),/Stale destination|Stale history/);await unmount(tree);
 await act(async()=>{tree=renderer.create(React.createElement(Support,{initialMessage:'Feil pris\nTurreferanse: owned-trip',onBack(){}}));});
 assert.equal(tree.root.findByProps({testID:'support-message-input'}).props.value,'Feil pris\nTurreferanse: owned-trip');assert.equal(tickets.length,count,'Prefilling trip context never sends a ticket');await unmount(tree);
 console.log('PASS: Actual support AI-failure draft recovery, explicit retry without duplicate bubbles, serialized requests, unconfirmed ticket handling, real ticket IDs, confirmed-ticket deduplication and missing contact gate.');
})().catch(error=>{console.error(error);process.exit(1)});
