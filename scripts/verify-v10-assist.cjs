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
  user={id:'assist-customer',role:'user'};
  queryData={'assist-payment-methods':{data:[{id:'card',label:'Visa',last4:'4321',verified:true,setup_status:'succeeded',stripe_payment_method_id:'pm_card'}]}};
  stubs['@/src/components/FloatingTabBar']={useHideTabBar(){}};
  const quote={duration_min:11,distance_km:3.4,pricing_version:7,geometry:{coordinates:[[10.74,59.91],[10.75,59.92]]},options:[{vehicle_type:'ai-first',price:184,waiting_policy:{token:'waiting',free_minutes:5,per_minute:4,max_fee:40}}]};
  let requests=[],transcriptions=0,recordings=0,stops=0,searches=0;const creating=deferred();let allowed=true;
  let recorderState={isRecording:false};const recorder={uri:'file:///test.m4a',prepareToRecordAsync:async()=>{},record(){recordings++;recorderState={isRecording:true};},stop:async()=>{stops++;recorderState={isRecording:false};}};
  stubs['expo-audio']={AudioModule:{requestRecordingPermissionsAsync:async()=>({granted:allowed})},RecordingPresets:{HIGH_QUALITY:{}},setAudioModeAsync:async()=>{},useAudioRecorder:()=>recorder,useAudioRecorderState:()=>recorderState};
  stubs['expo-file-system/legacy']={readAsStringAsync:async()=> 'test-audio',EncodingType:{Base64:'base64'}};
  Object.assign(stubs['expo-location'],{Accuracy:{Balanced:1},getCurrentPositionAsync:async()=>({coords:{latitude:59.91,longitude:10.74}})});permissionResult=async()=>({status:'granted'});
  stubs['@/src/lib/api'].aiApi={chat:async()=>({reply:'Actual reply'}),transcribe:async()=>{transcriptions++;return {text:'Taxi til Destination'};}};
  stubs['@/src/lib/api'].placesApi={reverse:async()=>({label:'Actual pickup'}),search:async()=>{searches++;return {results:[{name:'Invalid provider point',lat:null,lng:null},{name:'Actual destination',lat:59.92,lng:10.75}]};}};
  Object.assign(stubs['@/src/lib/api'].tripsApi,{estimate:async()=>quote,request:async body=>{requests.push(body);return creating.promise;},active:async()=>null});
  const Assist=load('frontend','app/(app)/assist.tsx').default;let tree=await mount(Assist);
  await act(async()=>{tree.root.findByProps({testID:'assist-input'}).props.onChangeText('Taxi til Destination');});await act(async()=>button(tree,'assist-send').props.onPress());
  assert.equal(searches,1);assert.equal(requests.length,0);assert.equal(tree.root.findAllByProps({testID:'assist-place-1'}).length,0,'Null provider coordinates are rejected');
  await act(async()=>button(tree,'assist-place-0').props.onPress());await act(async()=>button(tree,'assist-vehicle-ai-first').props.onPress());
  assert.equal(button(tree,'assist-confirm').props.disabled,true);await act(async()=>button(tree,'assist-waiting-consent').props.onPress());
  await act(async()=>{button(tree,'assist-confirm').props.onPress();button(tree,'assist-confirm').props.onPress();});assert.equal(requests.length,1);assert.equal(requests[0].waiting_policy_token,'waiting');assert.equal(requests[0].quoted_pricing_version,7);
  await act(async()=>creating.resolve({trip_id:'assist-created'}));assert.equal(navigation.at(-1)[1],'/booking/assist-created');await unmount(tree);
  searches=0;tree=await mount(Assist);await act(async()=>tree.root.findByProps({testID:'assist-input'}).props.onChangeText('Taxi til Gardermoen i morgen'));await act(async()=>button(tree,'assist-send').props.onPress());assert.equal(searches,0);assert.match(text(tree),/Planlagte turer er ikke aktivert/);await unmount(tree);
  tree=await mount(Assist);allowed=false;await act(async()=>button(tree,'assist-mic').props.onPress());assert.equal(recordings,0);assert.match(text(tree),/Mikrofontilgang/);
  allowed=true;await act(async()=>button(tree,'assist-mic').props.onPress());await act(async()=>tree.update(React.createElement(Assist)));assert.equal(recordings,1);
  recorderState={isRecording:false};await act(async()=>tree.update(React.createElement(Assist)));assert.equal(transcriptions,1,'A duration-limited recording is transcribed once when the recorder stops');
  await act(async()=>button(tree,'assist-voice-close').props.onPress());await unmount(tree);
  tree=await mount(Assist);await act(async()=>button(tree,'assist-mic').props.onPress());await act(async()=>tree.update(React.createElement(Assist)));const before=transcriptions;await act(async()=>button(tree,'assist-voice-close').props.onPress());assert.equal(transcriptions,before,'Closing an active recording cancels it without sending audio');assert.equal(recorderState.isRecording,false);await unmount(tree);
  console.log('PASS: Actual SNAR AI/voice address selection, null coordinate rejection, explicit quote/waiting/card confirmation, booking serialization, future-time refusal, microphone denial, automatic recording completion and cancellation without transcription.');
})().catch(error=>{console.error(error);process.exit(1)});
