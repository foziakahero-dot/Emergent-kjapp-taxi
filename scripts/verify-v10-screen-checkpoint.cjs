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
let testClock = 0, testTimerId = 0, reduceMotion = false; const testTimers = new Map(), hapticCalls = [];
async function tick(milliseconds) { testClock += milliseconds; await act(async () => { for (const [id, timer] of [...testTimers]) if (timer.at <= testClock) { testTimers.delete(id); timer.callback(); } }); }
const originalError = console.error;
console.error = (...args) => { if (!String(args[0]).includes('react-test-renderer is deprecated')) originalError(...args); };
let user = null, navigation = [], permissionCalls = 0, permissionResult;
let socialLoginResult, socialCalls = 0, registerResult, registerCalls = 0;
let loginResult, loginCalls = 0, logoutCalls = 0, vehicleResult, vehicleCalls = 0, currentTripId = 'trip-paid';
let queryData = {}, updates = [], storageWrites = [], sent = [], invalidated = [], updateResult, sendResult;
const router = Object.fromEntries(['push', 'replace', 'navigate', 'back'].map(method => [method, target => navigation.push([method, target])]));
class Value { constructor(value) { this.value = value; this.listeners = new Map(); } setValue(value) { this.value = value; this.listeners.forEach(listener => listener({ value })); } addListener(listener) { const id = String(this.listeners.size + 1); this.listeners.set(id, listener); return id; } removeListener(id) { this.listeners.delete(id); } stopAnimation() {} interpolate(config) { return config; } }
const native = {
  PanResponder: { create: config => ({ panHandlers: config }) },
  Animated: { Value, View: 'AnimatedView', timing: () => ({ start() {}, stop() {} }), loop: animation => animation }, Easing: { linear: value => value, bezier: (...values) => values },
  Modal: ({ visible, children }) => visible ? React.createElement('Modal', null, children) : null,
  View: 'View', Text: 'Text', TextInput: 'TextInput', Image: 'Image', KeyboardAvoidingView: 'KeyboardAvoidingView', ScrollView: 'ScrollView', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator',
  FlatList: ({ data, renderItem, ListEmptyComponent }) => React.createElement('FlatList', null, data.length ? data.map((item, index) => React.createElement(React.Fragment, { key: index }, renderItem({ item, index }))) : ListEmptyComponent),
  AppState: { addEventListener: () => ({ remove() {} }) }, Platform: { OS: 'ios' }, Linking: { openURL: async () => {} },
  StyleSheet: { create: value => value, hairlineWidth: 1, absoluteFill: { position: 'absolute', inset: 0 } },
};
const queryClient = { setQueryData: (key, data) => { const value = typeof data === 'function' ? data(queryData[key[0]]?.data) : data; updates.push([key, value]); queryData[key[0]] = { ...queryData[key[0]], data: value }; }, invalidateQueries: async x => invalidated.push(x.queryKey) };
const stubs = {
  'expo-image': { Image: 'DriverImage' },
  'expo-speech': {speak(){},stop:async()=>{}},
  'expo-haptics': { ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' }, impactAsync: async style => { hapticCalls.push(style); } },
  'expo-blur': { BlurTargetView: ({children,...props}) => React.createElement('BlurTargetView',props,children), BlurView: 'BlurView' },
  'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
  './V10CategoryImage': { V10CategoryImage: 'V10CategoryImage' },
  './V10MinimizeHandle': { V10MinimizeHandle: 'V10MinimizeHandle' },
  './V10Glass': { V10Glass: 'V10Glass' },
  './V10CustomerAvatar': { V10CustomerAvatar: 'V10CustomerAvatar' },
  './V10Entrance': { V10Entrance: ({children,...props}) => React.createElement('V10Entrance',props,children) },
  'expo-status-bar': { StatusBar: 'StatusBar' },
  'react-native-svg': new Proxy({ __esModule: true, default: 'Svg' }, { get: (target, key) => key in target ? target[key] : String(key) }),
  '@/src/components/V10Entrance': { V10Entrance: ({children,...props}) => React.createElement('V10Entrance',props,children) },
  '@/src/components/Motion': { useReducedMotion: () => reduceMotion, Collapse: ({open,children})=>React.createElement('Collapse',{open},children) },
  'react': React, 'react/jsx-runtime': appRequire('react/jsx-runtime'), 'react-native': native,
  'expo-router': { useRouter: () => router, useLocalSearchParams: () => ({ tripId: currentTripId }), useFocusEffect: callback => React.useEffect(callback, [callback]) },
  'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 48, bottom: 34 }) },
  'expo-location': { requestForegroundPermissionsAsync: () => { permissionCalls++; return permissionResult(); } },
  '@/src/context/AuthContext': { useAuth: () => ({ user, register: async data => { registerCalls++; return registerResult(data); }, refresh: async () => {}, signInWithGoogle: async () => { socialCalls++; return socialLoginResult(); }, signInWithApple: async () => { socialCalls++; return socialLoginResult(); }, login: async (...args) => { loginCalls++; return loginResult(...args); }, logout: async () => { logoutCalls++; } }) },
  '@/src/components/Typography': { Text: 'Text', TextInput: 'TextInput' },
  '@/src/components/Map': { Map: 'Map' },
  '@/src/components/V10Icon': { V10Icon: 'Icon' },
  '@/src/components/Icon': { Icon: 'Icon' },
  '@/src/components/CustomerPhoto': { CustomerPhoto: 'CustomerPhoto' },
  '@/src/components/ui': { Loader: 'Loader' },
  '@/src/theme': { colors: {}, font: {}, saveColorThemeMode: async () => true, useColorTheme: () => ({mode:'light',effective:'light',ready:true}), themedStyles: factory => factory(), makeStyles: factory => () => factory({}) },
  '@/src/lib/format': { apiError: error => error.message, vehicleMeta: () => ({ name: 'SNAR' }), kr: value => value == null ? '– kr' : Math.round(value) + ' kr' },
  '@/src/utils/storage': { storage: { getItem: async () => null, setItem: async (...args) => storageWrites.push(args) } },
  '@tanstack/react-query': {
    useQueryClient: () => queryClient,
    useQuery: ({ queryKey }) => ({ isPending: false, isError: false, refetch: async () => {}, ...queryData[queryKey[0]] }),
  },
  '@/src/lib/api': {
    tripDriverPhotoSource: async () => null,
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
    if (/\.(png|webp)$/.test(name)) { const asset = path.resolve(path.dirname(absolute), name); assert.ok(fs.statSync(asset).size > 0); return { uri: asset }; }
    if (name.startsWith('@/')) {
      const relative = name.slice(2);
      return load(app, relative + (fs.existsSync(path.join(root, app, relative + '.tsx')) ? '.tsx' : '.ts'));
    }
    if (name.startsWith('./') || name.startsWith('../')) {
      const relative = path.join(path.dirname(file), name);
      return load(app, relative + (fs.existsSync(path.join(root, app, relative + '.tsx')) ? '.tsx' : '.ts'));
    }
    throw new Error(`Unmocked dependency ${name}`);
  };
  vm.runInNewContext(compiled, { require: localRequire, module, exports: module.exports, console, process: { env: {} }, Set, setTimeout: (callback, delay) => { const id = ++testTimerId; testTimers.set(id, { callback, at: testClock + delay }); return id; }, clearTimeout: id => testTimers.delete(id), setInterval: () => ++testTimerId, clearInterval() {} }, { filename: absolute });
  cache.set(absolute, module.exports);
  return module.exports;
}
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const text = tree => JSON.stringify(tree.toJSON());
const button = (tree, id) => tree.root.findAll(node => node.type === 'Pressable' && node.props.testID === id)[0];
async function mount(Component) { let tree; await act(async () => { tree = renderer.create(React.createElement(Component)); }); return tree; }
async function unmount(tree) { await act(async () => tree.unmount()); }
(async () => {
  const { DriverAvatar } = load('driver-app', 'src/components/DriverAvatar.tsx');
  const originalAvatarQuery = stubs['@tanstack/react-query'].useQuery;
  let avatarQuery, avatarAccount = { id: 'driver-a', fullName: 'Ada Berg' };
  stubs['@tanstack/react-query'].useQuery = options => { avatarQuery = options; return { data: { uri: 'authenticated-avatar' } }; };
  let avatarTree = await mount(() => React.createElement(DriverAvatar, { account: avatarAccount, size: 32 }));
  assert.equal(avatarQuery.enabled, false);
  assert.equal(avatarTree.root.findAllByType('DriverImage').length, 0, 'Missing photo path cannot display stale private data');
  assert.match(text(avatarTree), /AB/);
  avatarAccount = { ...avatarAccount, profile_photo_path: '/private/avatar-a' };
  await act(async () => avatarTree.update(React.createElement(DriverAvatar, { account: avatarAccount, size: 32 })));
  assert.deepEqual(Array.from(avatarQuery.queryKey), ['driver-profile-photo-source', 'driver-a', '/private/avatar-a']);
  assert.equal(avatarQuery.enabled, true);
  await act(async () => avatarTree.root.findByType('DriverImage').props.onError());
  assert.equal(avatarTree.root.findAllByType('DriverImage').length, 0, 'Broken private photos fall back to initials');
  avatarAccount = { id: 'driver-b', fullName: 'Bente Moe', profile_photo_path: '/private/avatar-a' };
  await act(async () => avatarTree.update(React.createElement(DriverAvatar, { account: avatarAccount, size: 32 })));
  assert.equal(avatarQuery.queryKey[1], 'driver-b', 'Private photo cache is scoped to the account');
  assert.equal(avatarTree.root.findAllByType('DriverImage').length, 1, 'A previous account image failure cannot hide a new account image');
  await unmount(avatarTree);
  stubs['@tanstack/react-query'].useQuery = originalAvatarQuery;
  console.log('PASS: Driver avatar missing-path gate, account-scoped query and image-failure fallback.');
  const Intelligence = load('driver-app', 'app/(driver)/intel.tsx').default;
  navigation = []; let intelligenceTree = await mount(Intelligence);
  assert.equal(button(intelligenceTree, 'driver-intelligence-navigate').props.disabled, true, 'No guidance without a real recommendation');
  assert.doesNotMatch(text(intelligenceTree), /620 kr|82 %|Høy sikkerhet/, 'Prototype forecast and battery values are not account facts');
  assert.equal(navigation.length, 0);
  await act(async () => button(intelligenceTree, 'driver-intelligence-stay').props.onPress());
  assert.equal(navigation.at(-1)[1], '/(driver)/home'); await unmount(intelligenceTree);
  const { ExperienceStudio } = load('frontend', 'src/components/ExperienceStudio.tsx');
  const choices = [{id:'ai-first',label:'Effektiv',icon:'navigation',title:'Effektiv reise',sub:'Standard · estimert henting 3 min',body:'Se rute og pris.'},{id:'comfort',label:'Pusterom',icon:'moon',title:'Pusterom',sub:'Comfort · ikke tilgjengelig',body:'Ikke tilgjengelig',disabled:true},{id:'premium',label:'Signatur',icon:'star',title:'Signaturreise',sub:'Premium · estimert henting 6 min',body:'Se Premium.'}];
  let applied=[],continued=0,applyResult=deferred();
  let studioTree=await mount(()=>React.createElement(ExperienceStudio,{product:'customer',value:'ai-first',options:choices,onApply:value=>{applied.push(value);return applyResult.promise},onContinue:()=>{continued++}}));
  await act(async()=>button(studioTree,'customer-studio-open').props.onPress());
  assert.equal(button(studioTree,'customer-studio-choice-comfort').props.disabled,true,'Unsupported Comfort cannot change the real vehicle class');
  await act(async()=>button(studioTree,'customer-studio-choice-premium').props.onPress());
  assert.deepEqual(applied,[],'A studio draft does not book or change the current vehicle');
  await act(async()=>button(studioTree,'customer-studio-cancel').props.onPress());
  await act(async()=>button(studioTree,'customer-studio-open').props.onPress());
  assert.equal(button(studioTree,'customer-studio-choice-ai-first').props.accessibilityState.selected,true,'Cancel discards unconfirmed draft');
  await act(async()=>button(studioTree,'customer-studio-choice-premium').props.onPress());
  await act(async()=>{button(studioTree,'customer-studio-apply').props.onPress();button(studioTree,'customer-studio-apply').props.onPress()});
  assert.deepEqual(applied,['premium'],'Apply serializes simultaneous taps');
  await act(async()=>applyResult.resolve(false));
  assert.match(text(studioTree),/Valget kunne ikke lagres/);assert.equal(continued,0,'A failed save cannot continue');
  applyResult=deferred();await act(async()=>button(studioTree,'customer-studio-apply').props.onPress());
  await act(async()=>applyResult.reject(new Error('storage unavailable')));
  assert.equal(continued,0);assert.equal(studioTree.root.findAllByProps({testID:'customer-studio-dialog'}).length,1,'Save errors preserve the open draft');
  applyResult=deferred();await act(async()=>button(studioTree,'customer-studio-apply').props.onPress());await act(async()=>applyResult.resolve(true));
  assert.equal(continued,1);assert.equal(studioTree.root.findAllByProps({testID:'customer-studio-dialog'}).length,0);await unmount(studioTree);
  studioTree=await mount(()=>React.createElement(ExperienceStudio,{product:'driver',value:'2200',options:[{...choices[0],id:'2200',sub:'Dagsmål 2 200 kr'}],earnings:null,onApply:()=>true,onContinue:()=>{}}));
  assert.match(text(studioTree),/Dagens inntekt er ikke tilgjengelig/);assert.doesNotMatch(text(studioTree),/0 av 2/,'Missing income is not invented as zero');await unmount(studioTree);
  console.log('PASS: New-source Reisestudio draft/cancel, unavailable class, async apply failures/retry, duplicate lock and no automatic booking; missing driver income stays unavailable.');
  const ScheduledTrip = load('frontend', 'app/scheduled-trip.tsx').default;
  studioTree = await mount(ScheduledTrip);
  const scheduledTime = () => studioTree.root.findByProps({testID:'schedule-time'}).props.children;
  const originalTime = scheduledTime();
  await act(async()=>button(studioTree,'schedule-later').props.onPress());
  const afterTime = scheduledTime();
  const minuteValue = value => Number(value.slice(0,2))*60 + Number(value.slice(3));
  assert.equal((minuteValue(afterTime)-minuteValue(originalTime)+1440)%1440,5,'Time selection moves in five-minute steps');
  await act(async()=>button(studioTree,'schedule-earlier').props.onPress());assert.equal(scheduledTime(),originalTime);
  await act(async()=>button(studioTree,'schedule-day-3').props.onPress());assert.equal(button(studioTree,'schedule-day-3').props.accessibilityState.checked,true);
  assert.equal(button(studioTree,'schedule-confirm-unavailable').props.disabled,true,'Absent scheduling contract cannot create a booking');
  assert.match(text(studioTree),/Ingen tur blir bestilt/);await unmount(studioTree);
  console.log('PASS: Current-source planned-trip preview date/time selection, five-minute stepping and truthful disabled booking.');
  const { usePersonalShiftGoal } = load('driver-app','src/lib/usePersonalShiftGoal.ts');
  const studioStorage = stubs['@/src/utils/storage'].storage;
  const originalStudioRead = studioStorage.getItem, originalStudioWrite = studioStorage.setItem;
  let goalState,goalReads=[],goalWrites=[],goalAccount='driver-a';
  studioStorage.getItem=key=>{const request=deferred();goalReads.push({key,...request});return request.promise};
  studioStorage.setItem=(key,value)=>{const request=deferred();goalWrites.push({key,value,...request});return request.promise};
  const GoalProbe=()=>{goalState=usePersonalShiftGoal(goalAccount);return React.createElement('Text',null,goalState.goal)};
  studioTree=await mount(GoalProbe);assert.equal(await goalState.save('2800'),false,'Loading or absent account cannot persist a target');
  await act(async()=>goalReads[0].resolve('3400'));assert.equal(goalState.goal,'3400');
  goalAccount='driver-b';await act(async()=>studioTree.update(React.createElement(GoalProbe)));assert.equal(goalState.goal,'2200','Account change immediately hides the previous target');
  await act(async()=>goalReads[1].resolve('2200'));assert.equal(await goalState.save('not-a-goal'),false);
  let firstGoalSave,duplicateGoalSave;await act(async()=>{firstGoalSave=goalState.save('2800');duplicateGoalSave=goalState.save('3400')});
  assert.equal(await duplicateGoalSave,false);assert.equal(goalWrites.length,1);assert.equal(goalWrites[0].key,'snar_driver_shift_goal_v1:driver-b');assert.equal(goalState.goal,'2200','Unconfirmed persistence does not change the target');
  const rejectedGoalSave=assert.rejects(firstGoalSave,/device storage failed/);await act(async()=>goalWrites[0].reject(new Error('device storage failed')));await rejectedGoalSave;assert.equal(goalState.goal,'2200');
  let retryGoalSave;await act(async()=>{retryGoalSave=goalState.save('2800')});await act(async()=>goalWrites[1].resolve());assert.equal(await retryGoalSave,true);assert.equal(goalState.goal,'2800');
  let staleGoalSave;await act(async()=>{staleGoalSave=goalState.save('3400')});goalAccount='driver-c';await act(async()=>studioTree.update(React.createElement(GoalProbe)));await act(async()=>goalWrites[2].resolve());assert.equal(await staleGoalSave,false,'A save for the previous account cannot update or navigate the new account');assert.equal(goalState.goal,'2200');
  await unmount(studioTree);studioStorage.getItem=originalStudioRead;studioStorage.setItem=originalStudioWrite;
  console.log('PASS: Driver target loading/validation, account isolation, confirmed device persistence, duplicate lock, failed-save retry and stale-account suppression.');
  const Permissions = load('frontend', 'app/permissions.tsx').default;
  let tree = await mount(Permissions);
  await act(async () => button(tree, 'permissions-manual').props.onPress());
  assert.equal(permissionCalls, 0, 'Manual address must not request OS location permission');
  assert.equal(navigation.at(-1)[1], '/login');
  await unmount(tree);

  for (const [account, target] of [[null, '/login'], [{ id: 'customer', legal_accepted: false }, '/legal-consent'], [{ id: 'customer', legal_accepted: true }, '/(app)/home']]) {
    user = account; navigation = [];
    const request = deferred(); permissionResult = () => request.promise;
    tree = await mount(Permissions);
    const startCount = permissionCalls;
    let first;
    await act(async () => { first = button(tree, 'permissions-continue').props.onPress(); });
    assert.equal(button(tree, 'permissions-manual').props.disabled, true);
    await act(async () => { button(tree, 'permissions-continue').props.onPress(); });
    assert.equal(permissionCalls, startCount + 1, 'Repeated taps must not open duplicate prompts');
    await act(async () => { request.resolve({ status: 'granted' }); await first; });
    assert.equal(navigation.at(-1)[1], target, 'Location permission must not bypass login or legal consent');
    await unmount(tree);
  }
  user = null; navigation = [];
  permissionResult = async () => ({ status: 'denied', canAskAgain: false });
  tree = await mount(Permissions);
  await act(async () => button(tree, 'permissions-continue').props.onPress());
  assert.equal(navigation.length, 0, 'Denial is not success');
  assert.match(text(tree), /telefonens innstillinger/);
  assert.equal(!!button(tree, 'permissions-manual').props.disabled, false);
  permissionResult = async () => { throw new Error('OS unavailable'); };
  await act(async () => button(tree, 'permissions-continue').props.onPress());
  assert.match(text(tree), /Kunne ikke be om posisjon/);
  await unmount(tree);

  const Navigation = load('driver-app', 'app/driver-navigation.tsx').default;
  user = { id: 'driver-test' };
  queryData = { 'driver-navigation-settings': { data: { navigation_app: 'google' } } };
  updateResult = async () => ({ navigation_app: 'google' });
  tree = await mount(Navigation);
  await act(async () => button(tree, 'driver-navigation-choice-waze').props.onPress());
  assert.match(text(tree), /Kunne ikke lagre/);
  assert.equal(storageWrites.length, 0, 'Unconfirmed response must not save a local preference');
  const save = deferred(); updateResult = () => save.promise;
  let pending;
  const previousRequests = updates.filter(([key]) => key === 'request').length;
  await act(async () => { pending = button(tree, 'driver-navigation-choice-waze').props.onPress(); });
  await act(async () => { button(tree, 'driver-navigation-choice-apple').props.onPress(); });
  assert.equal(updates.filter(([key]) => key === 'request').length, previousRequests + 1, 'Navigation saves are serialized');
  await act(async () => { save.resolve({ settings: { navigation_app: 'waze' } }); await pending; });
  assert.deepEqual(storageWrites.at(-1), ['driver_navigation_app_v2:driver-test', 'waze']);
  assert.equal(updates.at(-1)[1].settings.navigation_app, 'waze');
  await unmount(tree);

  const Messages = load('driver-app', 'app/(driver)/messages.tsx').default;
  queryData = { 'driver-message-trip': { data: { trip_id: 'old', status: 'completed' } } };
  tree = await mount(Messages);
  assert.match(text(tree), /Ingen aktive samtaler/);
  assert.equal(sent.length, 0);
  await unmount(tree);
  queryData = {
    'driver-message-trip': { data: { trip_id: 'active', status: 'at_pickup', customer: { name: 'Test Customer' }, pickup_address: 'Test address' } },
    'driver-trip-messages': { data: { messages: [{ id: 'one', from_role: 'user', text: 'Test incoming message' }] } },
  };
  const sending = deferred(); sendResult = () => sending.promise;
  const beforeMessageFeedback = hapticCalls.length;
  tree = await mount(Messages);
  assert.match(text(tree), /Test incoming message/);
  const quickButtons = () => tree.root.findAll(node => node.type === 'Pressable' && node.props.accessibilityState && 'disabled' in node.props.accessibilityState);
  await act(async () => { quickButtons()[0].props.onPress(); quickButtons()[1].props.onPress(); });
  assert.equal(sent.length, 1, 'Only one quick reply may be in flight');
  assert.equal(hapticCalls.length, beforeMessageFeedback, 'Unconfirmed message cannot emit success feedback');
  assert.deepEqual(sent[0], ['active', 'Jeg er fremme']);
  await act(async () => sending.resolve({ ok: true }));
  assert.equal(hapticCalls.length, beforeMessageFeedback + 1);
  assert.equal(invalidated.at(-1)[1], 'active');
  sendResult = async () => { throw new Error('network'); };
  await act(async () => quickButtons()[0].props.onPress());
  assert.match(text(tree), /ikke bekreftet sendt/);
  assert.equal(hapticCalls.length, beforeMessageFeedback + 1, 'Failed message cannot emit success feedback');
  await unmount(tree);
  stubs['@/src/components/AppleSignInButton'] = { AppleSignInButton: 'AppleButton' };
  const Login = load('driver-app', 'app/driver-login.tsx').default;
  async function fillLogin(tree) {
    await act(async () => {
      tree.root.findByProps({ testID: 'driver-login-identifier' }).props.onChangeText('  driver@example.test  ');
      tree.root.findByProps({ testID: 'driver-login-password' }).props.onChangeText('test-only-password');
    });
  }
  tree = await mount(Login); navigation = [];
  await act(async () => button(tree, 'driver-login-submit').props.onPress());
  assert.equal(loginCalls, 0, 'Blank credentials must not invoke authentication');
  await fillLogin(tree);
  const loginRequest = deferred();
  loginResult = (identifier, password) => { assert.equal(identifier, 'driver@example.test'); assert.equal(password, 'test-only-password'); return loginRequest.promise; };
  await act(async () => { button(tree, 'driver-login-submit').props.onPress(); button(tree, 'driver-login-submit').props.onPress(); });
  assert.equal(loginCalls, 1, 'Rapid login taps must not race authentication');
  await act(async () => loginRequest.resolve({ role: 'driver', approved: true, legal_accepted: true, identity_verification_status: 'verified' }));
  assert.equal(navigation.at(-1)[1], '/(driver)/home');
  await unmount(tree);
  for (const [result, target, rejected] of [
    [{ role: 'user', approved: true }, null, true],
    [{ role: 'driver', approved: false }, null, true],
    [{ twofa_required: true }, null, false],
    [{ role: 'driver', approved: true, legal_accepted: false }, '/driver-legal-consent', false],
    [{ role: 'driver', approved: true, legal_accepted: true, identity_verification_status: 'pending_review' }, '/driver-approval', false],
    [{ role: 'driver', approved: true, legal_accepted: true, identity_verification_status: 'verified', identity_recheck_required: true }, '/driver-approval', false],
  ]) {
    navigation = []; const previousLogout = logoutCalls;
    loginResult = async () => result;
    tree = await mount(Login); await fillLogin(tree);
    await act(async () => button(tree, 'driver-login-submit').props.onPress());
    assert.equal(navigation.at(-1)?.[1] || null, target);
    assert.equal(logoutCalls - previousLogout, rejected ? 1 : 0);
    await unmount(tree);
  }
  loginResult = async () => { throw new Error('Login offline'); };
  tree = await mount(Login); await fillLogin(tree);
  await act(async () => button(tree, 'driver-login-submit').props.onPress());
  assert.match(text(tree), /Login offline/);
  assert.equal(button(tree, 'driver-login-submit').props.disabled, false);
  await unmount(tree);

  stubs['@/src/components/AppleSignInButton'] = { AppleSignInButton: 'AppleButton' };
  navigation = []; socialCalls = 0;
  tree = await mount(Login); const driverSocialRequest = deferred();
  socialLoginResult = () => driverSocialRequest.promise;
  await act(async () => { tree.root.findByType('AppleButton').props.onPress(); tree.root.findByType('AppleButton').props.onPress(); button(tree, 'driver-login-submit').props.onPress(); });
  assert.equal(socialCalls, 1, 'Driver social providers share the password lock');
  await act(async () => driverSocialRequest.resolve({ id: 'driver', role: 'driver', approved: true, legal_accepted: true, identity_verification_status: 'pending_review' }));
  assert.equal(navigation.at(-1)[1], '/driver-approval'); await unmount(tree);
  tree = await mount(Login); socialLoginResult = async () => null; navigation = [];
  assert.equal(tree.root.findAll(node => node.props.testID === 'driver-login-google').length, 0); await act(async () => tree.root.findByType('AppleButton').props.onPress()); assert.equal(navigation.length, 0); await unmount(tree);
  tree = await mount(Login); socialLoginResult = async () => { throw new Error('Provider unavailable'); };
  await act(async () => tree.root.findByType('AppleButton').props.onPress()); assert.match(text(tree), /Provider unavailable/); assert.equal(button(tree, 'driver-login-submit').props.disabled, false); await unmount(tree);
  const Register = load('frontend', 'app/register.tsx').default;
  tree = await mount(Register); registerCalls = 0; navigation = [];
  await act(async () => button(tree, 'register-submit').props.onPress()); assert.equal(registerCalls, 0);
  await act(async () => { for (const [id,value] of [['register-name','QA Customer'],['register-email',' qa@example.test '],['register-password','test-only-password']]) tree.root.findByProps({testID:id}).props.onChangeText(value); });
  await act(async () => button(tree, 'register-submit').props.onPress()); assert.equal(registerCalls, 0, 'Terms must be explicitly accepted');
  await act(async () => button(tree, 'register-legal-consent').props.onPress());
  const registrationRequest = deferred(); registerResult = data => { assert.equal(data.email, 'qa@example.test'); assert.equal(data.accepted_terms, true); return registrationRequest.promise; };
  const beforeRegistrationSocial = socialCalls;
  await act(async () => { button(tree, 'register-submit').props.onPress(); button(tree, 'register-submit').props.onPress(); button(tree, 'register-google').props.onPress(); });
  assert.equal(registerCalls, 1); assert.equal(socialCalls, beforeRegistrationSocial);
  await act(async () => registrationRequest.resolve({id:'new-customer',role:'user',legal_accepted:true})); assert.equal(navigation.at(-1)[1], '/profile-setup'); await unmount(tree);
  tree = await mount(Register); navigation = []; socialLoginResult = async () => ({id:'new-social',role:'user',legal_accepted:false});
  await act(async () => button(tree,'register-google').props.onPress()); assert.equal(navigation.at(-1)[1], '/legal-consent'); await unmount(tree);
  tree = await mount(Register); socialLoginResult = async () => { throw new Error('Registration provider offline'); };
  await act(async () => button(tree,'register-google').props.onPress()); assert.match(text(tree),/Registration provider offline/); assert.equal(button(tree,'register-submit').props.disabled,false); await unmount(tree);
  console.log('PASS: Driver social login locks/cancellation/failure/selfie gate; Customer registration consent, duplicates, provider/legal flow and retry.');

  socialCalls = 0;
  const CustomerLogin = load('frontend', 'app/login.tsx').default;
  tree = await mount(CustomerLogin); const loginBeforeCustomer = loginCalls;
  await act(async () => button(tree, 'login-submit').props.onPress()); assert.equal(loginCalls, loginBeforeCustomer);
  const fillCustomer = async () => act(async () => { tree.root.findByProps({ testID: 'login-email' }).props.onChangeText('  customer@example.test  '); tree.root.findByProps({ testID: 'login-password' }).props.onChangeText('test-only-password'); });
  await fillCustomer(); const customerLoginRequest = deferred();
  loginResult = (identifier, password) => { assert.equal(identifier, 'customer@example.test'); assert.equal(password, 'test-only-password'); return customerLoginRequest.promise; };
  socialLoginResult = async () => ({ id: 'social', role: 'user', legal_accepted: true });
  await act(async () => { button(tree, 'login-submit').props.onPress(); button(tree, 'login-submit').props.onPress(); button(tree, 'login-google').props.onPress(); tree.root.findByType('AppleButton').props.onPress(); });
  assert.equal(loginCalls, loginBeforeCustomer + 1); assert.equal(socialCalls, 0, 'Password/Google/Apple cannot race each other');
  await act(async () => customerLoginRequest.resolve({ id: 'customer', role: 'user', legal_accepted: true })); assert.equal(navigation.at(-1)[1], '/permissions'); await unmount(tree);
  for (const [response, target, message] of [[{ id: 'customer', role: 'user', legal_accepted: false }, '/legal-consent', null], [{ id: 'driver', role: 'driver', legal_accepted: true }, null, /sjåførkonto/], [{ twofa_required: true }, null, /tofaktor/], [{}, null, /ikke bekreftet/]]) {
    navigation = []; tree = await mount(CustomerLogin); await fillCustomer(); loginResult = async () => response;
    await act(async () => button(tree, 'login-submit').props.onPress());
    if (target) assert.equal(navigation.at(-1)[1], target); else { assert.equal(navigation.length, 0); assert.match(text(tree), message); }
    await unmount(tree);
  }
  console.log('PASS: Actual Customer sign-in blank/duplicate/shared provider lock, canonical role/legal/2FA gates and rejection of unconfirmed authentication.');
  const Profile = load('driver-app', 'app/(driver)/profile.tsx').default;
  user = { id: 'driver-test', fullName: 'Test Driver', identity_verification_status: 'verified', identity_recheck_required: true };
  queryData = { me: { data: user }, 'driver-ratings': { data: { count: 2, average: 4.5 } } };
  tree = await mount(Profile);
  assert.doesNotMatch(text(tree), /Verifisert/);
  assert.match(text(tree), /2 vurderinger/);
  navigation = [];
  for (const [id, target] of [['documents', '/driver-documents'], ['vehicles', '/driver-vehicles'], ['fleet', '/driver-fleet'], ['activity', '/driver-trips'], ['navigation', '/driver-navigation'], ['settings', '/driver-settings']]) {
    await act(async () => button(tree, 'driver-profile-' + id).props.onPress());
    assert.equal(navigation.at(-1)[1], target);
  }
  await unmount(tree);
  const Fleet = load('driver-app', 'app/driver-fleet.tsx').default;
  queryData = { me: { data: { ...user, fleet_id: 'actual-fleet', fleet_active: false } } };
  tree = await mount(Fleet); assert.match(text(tree), /Inaktiv fleet/); await unmount(tree);
  queryData.me.data.fleet_active = true;
  tree = await mount(Fleet); assert.match(text(tree), /Aktiv fleet/); await unmount(tree);
  delete queryData.me.data.fleet_active;
  tree = await mount(Fleet); assert.match(text(tree), /Tilknyttet/); assert.doesNotMatch(text(tree), /Aktiv fleet/); await unmount(tree);
  const historyHelpers = load('driver-app', 'src/lib/driverHistory.ts');
  assert.equal(historyHelpers.confirmedTripIncome({ payment_status: 'pending', driver_earnings: 999 }), null);
  assert.equal(historyHelpers.confirmedTripIncome({ payment_status: 'paid', driver_earnings: null }), null);
  assert.equal(historyHelpers.confirmedTripIncome({ payment_status: 'paid', driver_earnings: 0 }), 0);
  assert.equal(historyHelpers.confirmedTripIncome({ payment_status: 'paid', driver_earnings: NaN }), null);
  assert.equal(historyHelpers.confirmedTripIncome({ payment_status: 'paid', driver_earnings: -1 }), null);
  const grouped = historyHelpers.groupHistory([{ trip_id: 'timezone', created_at: '2026-10-13T22:30:00Z' }], new Date('2026-10-14T08:00:00Z'));
  assert.equal(grouped[0].title, 'I dag', 'History grouping uses Oslo calendar dates');
  assert.equal(historyHelpers.historyDate('not-a-date'), 'Dato mangler');

  const Vehicles = load('driver-app', 'app/driver-vehicles.tsx').default;
  queryData = { 'driver-vehicles': { data: { vehicles: [{ id: 'one', selected: true, car: 'One', plate: 'TEST1' }, { id: 'two', selected: false, car: 'Two', plate: 'TEST2' }, { id: 'busy', busy: true }, { id: 'parked', active: false }] } } };
  tree = await mount(Vehicles);
  assert.equal(!!button(tree, 'driver-vehicle-busy').props.disabled, true);
  assert.equal(!!button(tree, 'driver-vehicle-parked').props.disabled, true);
  vehicleResult = async () => ({ vehicle_id: 'other', selected: true });
  await act(async () => button(tree, 'driver-vehicle-two').props.onPress());
  assert.equal(queryData['driver-vehicles'].data.vehicles[0].selected, true, 'Unconfirmed vehicle response preserves selected car');
  assert.match(text(tree), /ikke bekreftet/);
  const vehicleRequest = deferred(); vehicleResult = () => vehicleRequest.promise;
  const countBefore = vehicleCalls;
  await act(async () => { button(tree, 'driver-vehicle-two').props.onPress(); button(tree, 'driver-vehicle-two').props.onPress(); });
  assert.equal(vehicleCalls, countBefore + 1, 'Duplicate car selection is guarded');
  await act(async () => vehicleRequest.resolve({ vehicle_id: 'two', selected: true }));
  assert.equal(queryData['driver-vehicles'].data.vehicles.find(v => v.id === 'two').selected, true);
  assert.equal(queryData['driver-vehicles'].data.vehicles.find(v => v.id === 'one').selected, false);
  await unmount(tree);

  const Activity = load('driver-app', 'app/driver-trips.tsx').default;
  queryData = { 'driver-history': { data: { trips: [{ trip_id: 'trip-paid', status: 'completed', payment_status: 'paid', driver_earnings: 162, price: 184, pickup_address: 'Area A', dropoff_address: 'Area B', created_at: '2026-10-13T08:00:00Z' }, { trip_id: 'trip-unpaid', status: 'completed', payment_status: 'pending', driver_earnings: 999, price: 1000, created_at: '2026-10-13T08:30:00Z' }] } } };
  tree = await mount(Activity);
  assert.match(text(tree), /162 kr/); assert.doesNotMatch(text(tree), /999 kr/);
  await act(async () => button(tree, 'driver-history-trip-trip-paid').props.onPress());
  assert.equal(navigation.at(-1)[1], '/driver-trip/trip-paid');
  await unmount(tree);
  const TripDetail = load('driver-app', 'app/driver-trip/[tripId].tsx').default;
  tree = await mount(TripDetail);
  assert.match(text(tree), /skjult etter turen/); assert.match(text(tree), /162 kr/);
  await unmount(tree);
  const paidHistoryTrip = queryData['driver-history'].data.trips[0];
  paidHistoryTrip.price = undefined; tree = await mount(TripDetail);
  assert.match(text(tree), /Betaling bekreftet/); assert.doesNotMatch(text(tree), /Inntekt vises når betaling/); await unmount(tree);
  paidHistoryTrip.price = 100; tree = await mount(TripDetail);
  assert.match(text(tree), /plattformbeløp ikke tilgjengelig/); assert.doesNotMatch(text(tree), /plattform 0 kr/); await unmount(tree);
  paidHistoryTrip.price = 184;
  currentTripId = 'trip-unpaid'; tree = await mount(TripDetail);
  assert.doesNotMatch(text(tree), /999 kr/); assert.match(text(tree), /betaling er bekreftet/);
  await unmount(tree);
  currentTripId = 'not-in-history'; tree = await mount(TripDetail);
  assert.match(text(tree), /Turen er ikke tilgjengelig/); await unmount(tree);
  const Earnings = load('driver-app', 'app/(driver)/earnings.tsx').default;
  const todayIso = new Date().toISOString().slice(0, 10);
  queryData = {
    'driver-summary': { data: { income: 321, trips: 2, online_minutes: 60, bonus: 0 } },
    'driver-weekly': { data: { days: [{ date: todayIso, income: 222, trips: 2, gross_income: 250 }] } },
    'driver-payouts': { data: { earned_net_7d: 222, stripe_connect_ready: false, next_payout_date: null } },
    'driver-history': { data: { trips: [{ trip_id: 'unpaid-now', payment_status: 'pending', driver_earnings: 999, created_at: new Date().toISOString() }] } },
  };
  tree = await mount(Earnings);
  assert.match(text(tree), /321 kr/); assert.doesNotMatch(text(tree), /999 kr/);
  await act(async () => button(tree, 'driver-earnings-detail-open').props.onPress());
  assert.equal(navigation.at(-1)[1], '/driver-earnings-detail'); await unmount(tree);
  queryData['driver-summary'].isError = true;
  tree = await mount(Earnings); assert.doesNotMatch(text(tree), /321 kr/); assert.match(text(tree), /Kunne ikke hente inntektsdata/); await unmount(tree);
  queryData['driver-summary'].isError = false;
  const EarningsDetail = load('driver-app', 'app/driver-earnings-detail.tsx').default;
  tree = await mount(EarningsDetail); assert.match(text(tree), /321 kr/);
  await act(async () => button(tree, 'driver-earnings-period-week').props.onPress());
  assert.match(text(tree), /222 kr/); assert.doesNotMatch(text(tree), /999 kr/);
  assert.doesNotMatch(text(tree), /Neste utbetaling/); await unmount(tree);
  queryData['driver-weekly'].data = {};
  tree = await mount(EarningsDetail);
  await act(async () => button(tree, 'driver-earnings-period-week').props.onPress());
  assert.equal(tree.root.findAll(node => node.type === 'Text' && node.props.testID === 'driver-earnings-period-net')[0].props.children, '— kr', 'Missing weekly data must not become a zero-income claim');
  await unmount(tree);
  const CustomerProfile = load('frontend', 'app/(app)/profile.tsx').default;
  user = { id: 'customer-test', role: 'user', fullName: 'Test Customer', phone: '00000000' };
  queryData = { 'me-places': { data: { places: [{ label: 'Hjem', name: 'Saved home' }] } }, 'payment-methods': { data: { payment_methods: [] } } };
  tree = await mount(CustomerProfile); assert.match(text(tree), /Saved home/);
  for (const [id, target] of [['profile-place-home', '/saved-places?label=Hjem'], ['profile-payments', '/payment-methods'], ['profile-accessibility', '/customer-accessibility'], ['profile-settings', '/settings'], ['profile-help', '/support']]) {
    await act(async () => button(tree, id).props.onPress()); assert.equal(navigation.at(-1)[1], target);
  }
  await unmount(tree);

  const CustomerMessages = load('frontend', 'app/(app)/messages.tsx').default;
  queryData = { 'customer-active-trip': { data: { trip_id: 'closed', status: 'completed', driver_id: 'driver' } } };
  tree = await mount(CustomerMessages); assert.match(text(tree), /Ingen aktive samtaler/); await unmount(tree);
  queryData = { 'customer-active-trip': { data: { trip_id: 'searching', status: 'searching', driver_id: null } } };
  tree = await mount(CustomerMessages); assert.match(text(tree), /når en sjåfør er tildelt/); await unmount(tree);
  queryData = {
    'customer-active-trip': { data: { trip_id: 'customer-active', status: 'driver_on_way', driver_id: 'driver', driver: { name: 'Test Driver', plate: 'TEST1' }, dropoff_address: 'Destination' } },
    'customer-trip-messages': { data: { messages: [{ id: 'mine', from_role: 'passenger', text: 'My confirmed message' }, { id: 'theirs', from_role: 'driver', text: 'Driver message' }] } },
  };
  tree = await mount(CustomerMessages);
  const bubbles = tree.root.findAll(node => node.type === 'V10Entrance' && node.props.style?.maxWidth === '78%');
  assert.equal(bubbles[0].props.style.alignSelf, 'flex-end', 'Actual passenger sender role renders as own message');
  assert.equal(bubbles[1].props.style.alignSelf, 'flex-start');
  await act(async () => tree.root.findByProps({ testID: 'customer-message-input' }).props.onChangeText('  Customer draft  '));
  const customerRequest = deferred(); sendResult = () => customerRequest.promise;
  const sentBefore = sent.length;
  await act(async () => { button(tree, 'customer-message-send').props.onPress(); button(tree, 'customer-message-send').props.onPress(); });
  assert.equal(sent.length, sentBefore + 1); assert.deepEqual(sent.at(-1), ['customer-active', 'Customer draft']);
  await act(async () => customerRequest.resolve({ ok: true }));
  assert.equal(tree.root.findByProps({ testID: 'customer-message-input' }).props.value, '');
  await act(async () => tree.root.findByProps({ testID: 'customer-message-input' }).props.onChangeText('Keep this after failure'));
  sendResult = async () => { throw new Error('network'); };
  await act(async () => button(tree, 'customer-message-send').props.onPress());
  assert.equal(tree.root.findByProps({ testID: 'customer-message-input' }).props.value, 'Keep this after failure');
  assert.match(text(tree), /ikke bekreftet sendt/);
  await unmount(tree);
  queryData['customer-active-trip'].isError = true;
  tree = await mount(CustomerMessages); assert.match(text(tree), /Kunne ikke hente reisestatus/); assert.doesNotMatch(text(tree), /My confirmed message/); await unmount(tree);

  const CustomerHistory = load('frontend', 'app/(app)/history.tsx').default;
  // Match GET /api/trips: the production route returns a top-level array.
  queryData = { trips: { data: [{ trip_id: 'finished', status: 'completed', payment_status: 'paid', created_at: new Date().toISOString(), dropoff_address: 'Destination', price: 184 }, { trip_id: 'cancelled', status: 'cancelled', created_at: new Date().toISOString(), price: 999 }, { trip_id: 'hidden-live', status: 'searching', created_at: new Date().toISOString() }] }, 'customer-active-trip': { data: { trip_id: 'live-trip', status: 'in_trip', dropoff_address: 'Live destination' } } };
  tree = await mount(CustomerHistory);
  assert.doesNotMatch(text(tree), /999 kr/);
  assert.match(text(tree), /Destination|184 kr/);
  assert.equal(button(tree, 'trip-hidden-live'), undefined);
  await act(async () => button(tree, 'trip-finished').props.onPress()); assert.equal(navigation.at(-1)[1], '/customer-trip/finished');
  await act(async () => button(tree, 'history-active-trip').props.onPress()); assert.equal(navigation.at(-1)[1], '/booking/live-trip'); await unmount(tree);
  queryData.trips = { isError: true, data: undefined };
  tree = await mount(CustomerHistory); assert.match(text(tree), /Kunne ikke hente turhistorikken/); await unmount(tree);
  queryData.trips = { data: [] };
  tree = await mount(CustomerHistory); assert.match(text(tree), /Ingen turer ennå/); await unmount(tree);

  const {osloWeekStart,thisOsloWeek}=load('frontend','src/lib/osloCalendar.ts');
  assert.equal(osloWeekStart(Date.parse('2026-10-11T22:30:00Z')),'2026-10-12','Oslo has already entered Monday while UTC remains Sunday');
  assert.equal(thisOsloWeek('2026-10-11T22:10:00Z',Date.parse('2026-10-11T22:30:00Z')),true);
  assert.equal(thisOsloWeek('2026-10-11T21:59:00Z',Date.parse('2026-10-11T22:30:00Z')),false);
  assert.equal(thisOsloWeek('invalid'),false);
  currentTripId = 'customer-detail';
  const CustomerTrip = load('frontend', 'app/customer-trip/[tripId].tsx').default;
  queryData = { 'customer-trip-detail': { data: { trip_id: 'customer-detail', status: 'completed', payment_status: 'paid', price: 184, created_at: new Date().toISOString(), driver: { name: 'Test Driver' } } } };
  tree = await mount(CustomerTrip); assert.match(text(tree), /Kartdata er ikke tilgjengelig/);
  await act(async () => button(tree, 'customer-trip-receipt').props.onPress()); assert.equal(navigation.at(-1)[1], '/receipt/customer-detail?view=receipt'); await unmount(tree);
  queryData['customer-trip-detail'].data.status = 'in_trip';
  queryData['customer-trip-detail'].data.payment_status = 'reserved';
  tree = await mount(CustomerTrip);
  await act(async () => button(tree, 'customer-trip-receipt').props.onPress()); assert.equal(navigation.at(-1)[1], '/booking/customer-detail');
  assert.doesNotMatch(text(tree), /Betalt/); await unmount(tree);
  const Hold = load('driver-app', 'src/components/V10HoldAction.tsx').V10HoldAction;
  let confirmations = 0, holdErrors = 0;
  const confirmPending = deferred();
  const holdProps = { label: 'Start', testID: 'hold-test', onConfirm: async () => { confirmations++; return confirmPending.promise; }, onError: () => { holdErrors++; } };
  let holdTree; await act(async () => { holdTree = renderer.create(React.createElement(Hold, holdProps)); });
  await act(async () => button(holdTree, 'hold-test').props.onPressIn()); await tick(899);
  assert.equal(confirmations, 0);
  await act(async () => button(holdTree, 'hold-test').props.onPressOut()); await tick(1);
  assert.equal(confirmations, 0, 'Releasing before 900ms must cancel the action');
  await act(async () => button(holdTree, 'hold-test').props.onPressIn()); await tick(900);
  assert.equal(confirmations, 1);
  await act(async () => { button(holdTree, 'hold-test').props.onPressIn(); button(holdTree, 'hold-test').props.onAccessibilityAction({ nativeEvent: { actionName: 'activate' } }); });
  assert.equal(confirmations, 1, 'Pending confirmation cannot be duplicated');
  await act(async () => confirmPending.resolve()); await unmount(holdTree);
  reduceMotion = true;
  await act(async () => { holdTree = renderer.create(React.createElement(Hold, { ...holdProps, onConfirm: async () => { confirmations++; } })); });
  await act(async () => button(holdTree, 'hold-test').props.onPressIn()); await tick(899); assert.equal(confirmations, 1, 'Reduced motion must retain the safety hold time');
  await unmount(holdTree); await tick(1); assert.equal(confirmations, 1, 'Unmount cancels pending holds');
  reduceMotion = false;

  const Cockpit = load('driver-app', 'src/components/DriverCockpitView.tsx').DriverCockpitView;
  let advances = 0, pickupNavigations = 0;
  const props = { user: { fullName: 'Test Driver', plate: 'TEST' }, online: true, busy: false, error: '', summary: { income: 321, trips: 2, online_minutes: 60 }, current: null, completed: null, offer: null, offerRemaining: null, offerExpired: false, offerDistance: null, offerDuration: null, gpsReady: true, minimized: false, extras: '', onOnline() {}, onAccept() {}, onDecline() {}, onAdvance: async () => { advances++; }, onCancel() {}, onNoShow() {}, onCall() {}, onChat() {}, onNavigate() { pickupNavigations++; }, onEmergency() {}, onMinimize() {}, onContinue() {}, onPause() {}, onError() {} };
  tree = await mount(() => React.createElement(Cockpit, { ...props, online: false, busy: true }));
  assert.match(text(tree), /Venter på bekreftelse fra SNAR/);
  assert.equal(button(tree, 'driver-go-online'), undefined, 'Pending shift view hides the old offline actions');
  assert.doesNotMatch(text(tree), /Du er online/, 'A pending request cannot announce online success');
  await unmount(tree);
  const currentPickup = { trip_id: 'scene-trip', status: 'driver_on_way', customer: { name: 'Test Customer', phone: '00000000' }, pickup_address: 'Pickup', dropoff_address: 'Destination', price: 184 };
  tree = await mount(() => React.createElement(Cockpit, { ...props, current: { ...currentPickup, pickup_waiting_inside: true } }));
  assert.equal(tree.root.findAllByProps({ testID: 'driver-waiting-inside' }).length > 0, true);
  assert.equal(advances, 0, 'Waiting-inside status cannot confirm arrival'); await unmount(tree);
  tree = await mount(() => React.createElement(Cockpit, { ...props, current: { ...currentPickup, pickup_waiting_inside: false, passenger_note: 'Venter i resepsjonen' } }));
  assert.equal(tree.root.findAllByProps({ testID: 'driver-waiting-inside' }).length, 0, 'Explicit server state overrides note inference'); await unmount(tree);
  await act(async () => { tree = renderer.create(React.createElement(Cockpit, { ...props, current: currentPickup })); });
  await act(async () => button(tree, 'driver-pickup-navigation').props.onPress()); assert.equal(pickupNavigations, 1); assert.equal(advances, 0, 'Navigation cannot advance the trip');
  await act(async () => button(tree, 'driver-arrival-review').props.onPress()); assert.equal(advances, 0, 'Arrival review is UI only');
  await act(async () => button(tree, 'driver-advance').props.onPress()); assert.equal(advances, 1); await unmount(tree);
  await act(async () => { tree = renderer.create(React.createElement(Cockpit, { ...props, current: { ...currentPickup, status: 'at_pickup' } })); });
  assert.doesNotMatch(text(tree), /5:00/, 'Missing waiting policy cannot invent free waiting time');
  await act(async () => button(tree, 'driver-passenger-confirm').props.onPress()); assert.equal(advances, 1);
  await act(async () => button(tree, 'driver-advance').props.onPressIn()); await tick(899); assert.equal(advances, 1);
  await tick(1); assert.equal(advances, 2); await unmount(tree);
  await act(async () => { tree = renderer.create(React.createElement(Cockpit, { ...props, current: { ...currentPickup, status: 'in_trip' } })); });
  assert.doesNotMatch(text(tree), /321 kr|184 kr/, 'Active trip does not display financial data');
  await act(async () => button(tree, 'driver-arriving-review').props.onPress());
  await act(async () => button(tree, 'driver-completion-review').props.onPress()); assert.equal(advances, 2);
  await act(async () => button(tree, 'driver-advance').props.onPressIn()); await tick(900); assert.equal(advances, 3); await unmount(tree);
  await act(async () => { tree = renderer.create(React.createElement(Cockpit, { ...props, completed: { payment_status: 'pending', driver_earnings: 999, price: 1000 } })); });
  assert.doesNotMatch(text(tree), /999 kr/); assert.match(text(tree), /Betaling avventer/); await unmount(tree);
  tree = await mount(() => React.createElement(Cockpit, { ...props, completed: { trip_id: 'paid-summary', payment_status: 'paid', driver_earnings: 161.92, price: 184, commission_rate: .12 } }));
  assert.match(text(tree), /161,92/); assert.match(text(tree), /−22,08/); assert.match(text(tree), /184,00/); await unmount(tree);
  tree = await mount(() => React.createElement(Cockpit, { ...props, completed: { trip_id: 'inconsistent-summary', payment_status: 'paid', driver_earnings: 200, price: 184 } }));
  assert.match(text(tree), /Avventer/); assert.doesNotMatch(text(tree), /−0,00/, 'Inconsistent gross/net cannot invent a zero platform fee'); await unmount(tree);
  // Exercise the actual DriverHome wiring, not just the presentation callbacks.
  user = { id: 'integration-driver', role: 'driver', approved: true, legal_accepted: true, identity_verification_status: 'verified' };
  let serverTrip = { ...currentPickup, trip_id: 'integration-trip', pickup_lat: 59.91, pickup_lng: 10.74, dropoff_lat: 59.92, dropoff_lng: 10.75, geometry: { coordinates: [[10.74, 59.91], [10.75, 59.92]] }, pickup_route: { geometry: { coordinates: [[10.73, 59.90], [10.74, 59.91]] } } };
  const mutations = [], saved = new Map(), dialogs = [];
  native.Alert = { alert: (title, body, buttons) => dialogs.push({ title, body, buttons }) };
  stubs['@/src/components/FloatingTabBar'] = { useHideTabBar() {} };
  stubs['@/src/components/ChatSheet'] = { ChatSheet: 'ChatSheet' };
  stubs['@/src/lib/nativeRuntime'] = { notifyPendingTripFromForeground: async () => {} };
  stubs['expo-linear-gradient'] = { LinearGradient: 'Gradient' };
  stubs['@/src/utils/storage'] = { storage: { getItem: async key => saved.get(key) || null, setItem: async (key, value) => saved.set(key, value), removeItem: async key => saved.delete(key) } };
  permissionResult = async () => ({ status: 'granted' });
  const position = { coords: { latitude: 59.91, longitude: 10.74, heading: 0, speed: 0 }, timestamp: Date.now() };
  Object.assign(stubs['expo-location'], { Accuracy: { High: 1, BestForNavigation: 2 }, getCurrentPositionAsync: async () => position, watchPositionAsync: async () => ({ remove() {} }) });
  Object.assign(stubs['@/src/lib/api'].driverApi, {
    current: async () => serverTrip,
    pending: async () => ({ trips: [] }),
    summary: async () => ({ online: true, income: 321, trips: 2, online_minutes: 60 }),
    location: async () => ({ ok: true }), online: async online => ({ online }),
    atPickup: async id => { mutations.push(['atPickup', id]); serverTrip = { ...serverTrip, status: 'at_pickup', at_pickup_at: new Date().toISOString() }; },
    start: async id => { mutations.push(['start', id]); serverTrip = { ...serverTrip, status: 'in_trip' }; },
    arrive: async id => { mutations.push(['arrive', id]); serverTrip = { ...serverTrip, status: 'arrived', payment_status: 'pending', driver_earnings: null }; },
  });
  stubs['@/src/lib/api'].safetyApi = { log: async () => ({}) };
  const Home = load('driver-app', 'app/(driver)/home.tsx').default;
  tree = await mount(Home);
  await act(async()=>tree.root.findByType(Cockpit).props.onChat());
  assert.equal(navigation.at(-1)[1],'/(driver)/messages','Actual trip contact opens the current full Driver messaging screen');
  assert.equal(serverTrip.status,'driver_on_way','Opening messages cannot advance a trip');
  const map = () => tree.root.findAll(node => node.type === 'Map')[0];
  assert.equal(JSON.stringify(map().props.route), JSON.stringify(serverTrip.pickup_route.geometry.coordinates), 'Actual DriverHome uses driver-to-pickup geometry');
  assert.equal(map().props.dropoff, null, 'Pickup view must not duplicate the destination marker at pickup');
  await act(async () => button(tree, 'driver-trip-minimize').props.onPress());
  assert.equal(saved.get('kjapp_driver_minimized_active_trip_v1'), 'integration-trip');
  await act(async () => button(tree, 'driver-trip-reopen').props.onPress());
  assert.equal(saved.has('kjapp_driver_minimized_active_trip_v1'), false);
  await act(async () => button(tree, 'driver-arrival-review').props.onPress());
  const atPickupSuccess = stubs['@/src/lib/api'].driverApi.atPickup;
  stubs['@/src/lib/api'].driverApi.atPickup = async () => { throw { message: 'GPS rejected', response: { status: 409 } }; };
  await act(async () => button(tree, 'driver-advance').props.onPress());
  assert.match(text(tree), /GPS rejected/);
  assert.equal(saved.has('kjapp_driver_queued_trip_action_v1'), false, 'Semantic rejection must not queue automatic replay');
  stubs['@/src/lib/api'].driverApi.atPickup = async () => { throw new Error('network'); };
  await act(async () => button(tree, 'driver-advance').props.onPress());
  assert.equal(JSON.parse(saved.get('kjapp_driver_queued_trip_action_v1')).action, 'at_pickup');
  assert.equal(serverTrip.status, 'driver_on_way', 'Offline failure cannot manufacture arrival');
  stubs['@/src/lib/api'].driverApi.atPickup = atPickupSuccess;
  await act(async () => button(tree, 'driver-advance').props.onPress());
  assert.equal(mutations.at(-1)[0], 'atPickup');
  await act(async () => button(tree, 'driver-passenger-confirm').props.onPress());
  await act(async () => button(tree, 'driver-advance').props.onPressIn()); await tick(900);
  assert.equal(mutations.at(-1)[0], 'start');
  assert.equal(JSON.stringify(map().props.route), JSON.stringify(serverTrip.geometry.coordinates), 'Active ride switches to the actual customer route');
  await act(async () => button(tree, 'driver-arriving-review').props.onPress());
  await act(async () => button(tree, 'driver-completion-review').props.onPress());
  await act(async () => button(tree, 'driver-advance').props.onPressIn()); await tick(900);
  assert.equal(mutations.filter(([name]) => name === 'arrive').length, 0, 'Existing final confirmation remains required');
  const dialog = dialogs.at(-1); assert.equal(dialog.title, 'Fullføre turen?');
  await act(async () => dialog.buttons.find(item => item.text === 'Fullfør turen').onPress());
  assert.equal(mutations.at(-1)[0], 'arrive');
  assert.match(text(tree), /Betaling avventer/);
  await unmount(tree);
  serverTrip = null;
  let serverOffers = [{ ...currentPickup, trip_id: 'offer-test', status: 'searching', pickup_lat: 59.91, pickup_lng: 10.74, dropoff_lat: 59.92, dropoff_lng: 10.75, offer_expires_at: new Date(Date.now() + 30000).toISOString(), pickup_route: { duration_min: 4, distance_km: 1.2 } }];
  stubs['@/src/lib/api'].driverApi.pending = async () => ({ trips: serverOffers });
  let acceptCalls = 0, declineCalls = 0;
  const accepting = deferred();
  stubs['@/src/lib/api'].driverApi.accept = async () => { acceptCalls++; await accepting.promise; serverTrip = { ...serverOffers[0], status: 'driver_on_way' }; serverOffers = []; };
  stubs['@/src/lib/api'].driverApi.decline = async () => { declineCalls++; };
  tree = await mount(Home);
  await act(async () => { button(tree, 'driver-accept-offer-test').props.onPress(); button(tree, 'driver-accept-offer-test').props.onPress(); button(tree, 'driver-decline-offer-test').props.onPress(); });
  assert.equal(acceptCalls, 1); assert.equal(declineCalls, 0, 'Accept and decline cannot race within the same client');
  await act(async () => accepting.resolve()); assert.match(text(tree), /Kjør til henting/); await unmount(tree);
  serverTrip = null; serverOffers = [];
  let shiftOnline = false, shiftCalls = 0, shiftRequest = deferred();
  stubs['@/src/lib/api'].driverApi.summary = async () => ({ online: shiftOnline, income: 321, trips: 2, online_minutes: 60 });
  stubs['@/src/lib/api'].driverApi.online = async next => { shiftCalls++; await shiftRequest.promise; shiftOnline = next; return { online: next }; };
  tree = await mount(Home);
  await act(async () => { const toggle = tree.root.findByType(Cockpit).props.onOnline; toggle(); toggle(); });
  assert.equal(shiftCalls, 1, 'Rapid shift toggles send one request');
  assert.equal(tree.root.findByType(Cockpit).props.online, false, 'Shift stays unconfirmed until the response');
  await act(async () => shiftRequest.resolve());
  assert.equal(tree.root.findByType(Cockpit).props.online, true);
  stubs['@/src/lib/api'].driverApi.online = async () => { throw new Error('Shift offline'); };
  await act(async () => tree.root.findByType(Cockpit).props.onOnline());
  assert.match(text(tree), /Shift offline/); assert.equal(tree.root.findByType(Cockpit).props.online, true);
  stubs['@/src/lib/api'].driverApi.online = async () => ({ online: true });
  await act(async () => tree.root.findByType(Cockpit).props.onOnline());
  assert.match(text(tree), /ikke bekreftet/); assert.equal(tree.root.findByType(Cockpit).props.online, true, 'An opposite acknowledgement cannot change shift state');
  stubs['@/src/lib/api'].driverApi.online = async next => { shiftOnline = next; return { online: next }; };
  await act(async () => tree.root.findByType(Cockpit).props.onOnline());
  assert.equal(tree.root.findByType(Cockpit).props.online, false, 'Retry after a rejected response remains possible');
  await unmount(tree);
  console.log('PASS: Actual Driver shift duplicate lock, pending view, confirmed state, network failure, rejected acknowledgement and retry.');
  stubs['@/src/components/VehicleAsset'] = { VehicleAsset: 'VehicleAsset' };
  const supplyConfigs = [];
  const supplyCars = [{ id:'standard-live',type:'ai-first',lat:59.915,lng:10.748,eta_min:4 },{ id:'suv-live',type:'suv',lat:59.914,lng:10.747,eta_min:7 },{ id:'premium-live',type:'premium',lat:59.913,lng:10.746,eta_min:6 }];
  stubs['@/src/lib/useAvailableCars'] = { useAvailableCars: config => { supplyConfigs.push(config); return { cars:supplyCars,phase:'ready' }; } };
  stubs['@/src/components/AvailabilityStatus'] = { AvailabilityStatus: 'AvailabilityStatus' };
  stubs['@/src/components/ActiveTripCard'] = { ActiveTripCard: 'ActiveTripCard', LIVE_TRIP_STATUSES: ['searching', 'driver_on_way', 'at_pickup', 'in_trip'] };
  stubs['@/src/lib/recentPlaces'] = { recentDestinations: () => [] };
  const card = { id: 'verified-card', label: 'Visa', last4: '4321', verified: true, setup_status: 'succeeded', stripe_payment_method_id: 'pm_verified', created_at: '2026-10-13' };
  const quote = { distance_km: 3.4, duration_min: 11, pricing_version: 7, geometry: { coordinates: [[10.74, 59.91], [10.75, 59.92]] }, options: [{ vehicle_type: 'ai-first', price: 184, waiting_policy: { token: 'waiting-policy', free_minutes: 5, per_minute: 4, max_fee: 40 } }, { vehicle_type: 'suv', price: 240 }, { vehicle_type: 'premium', price: 300 }] };
  let bookingRequests = [], customerActive = null; const requesting = deferred();
  user = { id: 'customer-home', role: 'user', fullName: 'Actual Customer' };
  Object.assign(stubs['expo-location'], { getForegroundPermissionsAsync: async () => ({ status: 'granted' }), hasServicesEnabledAsync: async () => true });
  stubs['@/src/lib/api'].placesApi = { list: async () => ({ places: [] }), reverse: async () => ({ label: 'Actual pickup' }), search: async () => ({ results: [] }) };
  stubs['@/src/lib/api'].mePlacesApi.list = async () => ({ places: [{ label: 'Hjem', name: 'Actual destination', lat: 59.92, lng: 10.75 }] });
  stubs['@/src/lib/api'].paymentApi.list = async () => [card];
  Object.assign(stubs['@/src/lib/api'].tripsApi, { active: async () => customerActive, list: async () => [], estimate: async () => quote, request: async body => { bookingRequests.push(body); return requesting.promise; } });
  const CustomerHome = load('frontend', 'app/(app)/home.tsx').default;
  queryData['customer-active-trip'] = { data: null };
  tree = await mount(CustomerHome);
  assert.equal(supplyConfigs.at(-1).vehicleType,undefined,'Home must show all real vehicle classes instead of only Standard');
  assert.equal(tree.root.findByType('Map').props.cars.length,3);
  await act(async () => button(tree, 'quick-Hjem').props.onPress());
  assert.match(text(tree), /Kjøretid|11 min/);
  assert.equal(tree.root.findAll(node => node.type === 'Map')[0].props.focusMode, 'route');
  await act(async () => button(tree, 'route-choose-vehicle').props.onPress());
  assert.match(text(tree),/4 min unna/);assert.match(text(tree),/7 min unna/);assert.match(text(tree),/6 min unna/);
  assert.equal(tree.root.findAll(node => node.type === 'Pressable' && node.props.accessibilityRole === 'radio' && String(node.props.testID).startsWith('vehicle-')).length,3);
  assert.equal(button(tree,'vehicle-comfort'),undefined);
  await act(async()=>button(tree,'vehicle-premium').props.onPress());assert.match(text(tree),/Bestill Premium · 300 kr/);assert.equal(supplyConfigs.at(-1).vehicleType,'premium');
  assert.equal(tree.root.findAll(node=>node.props.testID==='available-driver-standard-live').length,0);
  assert.ok(tree.root.findAll(node=>node.props.testID==='available-driver-premium-live').length);
  await act(async()=>button(tree,'vehicle-ai-first').props.onPress());
  await act(async () => button(tree, 'booking-payment-row').props.onPress());
  assert.match(text(tree), /4321/);
  assert.doesNotMatch(text(tree), /Equinor|4821/);
  assert.equal(button(tree,'booking-pay-card').props.accessibilityState.checked,true);
  assert.equal(button(tree,'booking-pay-google'),undefined,'iOS cannot show Android wallet choices');
  for (const id of ['apple','business','vipps']) { const choice=button(tree,`booking-pay-${id}`);assert.equal(choice.props.disabled,true);await act(async()=>choice.props.onPress()); }
  assert.ok(button(tree,'booking-payment-done'),'Unavailable provider cannot pretend selection succeeded');
  await act(async () => button(tree, 'booking-payment-done').props.onPress());
  await act(async () => button(tree, 'booking-review').props.onPress());
  assert.equal(button(tree, 'booking-confirm').props.disabled, true, 'Waiting consent is required before request');
  await act(async () => button(tree, 'waiting-policy-consent').props.onPress());
  await act(async () => { button(tree, 'booking-confirm').props.onPress(); button(tree, 'booking-confirm').props.onPress(); });
  assert.equal(bookingRequests.length, 1, 'The actual CustomerHome serializes duplicate booking');
  assert.equal(bookingRequests[0].waiting_policy_token, 'waiting-policy');
  assert.equal(bookingRequests[0].quoted_pricing_version, 7); assert.equal(bookingRequests[0].quoted_price, 184);
  await act(async () => requesting.resolve({ trip_id: 'created-customer-trip' }));
  assert.equal(navigation.at(-1)[1], '/booking/created-customer-trip'); await unmount(tree);
  stubs['./Typography'] = { Text: 'Text', TextInput: 'TextInput' };
  const Status = load('frontend', 'src/components/AvailabilityStatus.tsx').AvailabilityStatus;
  for (const sample of [{phase:'loading',issue:null,cars:[]},{phase:'waiting',issue:'empty',cars:[]},{phase:'available',issue:null,cars:[{id:'real-car'}]},{phase:'loading',issue:null,cars:[{id:'real-car'}]}]) {
    tree = await mount(() => React.createElement(Status,{compact:true,search:{...sample,attempt:3,nextAt:Date.now()+8000,seconds:8,now:Date.now(),retry:()=>{}}}));
    assert.doesNotMatch(text(tree),/Søker|Forsøk|sekunder|Neste/,'Home never presents a dispatch countdown while browsing');
    if(sample.cars.length)assert.match(text(tree),/1 ledig bil/);await unmount(tree);
  }
  tree = await mount(() => React.createElement(Status,{search:{phase:'waiting',issue:'empty',cars:[],attempt:2,now:Date.now(),seconds:10,retry:()=>{}},trip:{search_attempt:2}}));
  assert.match(text(tree),/Forsøk 2 av 3/,'A real dispatched trip keeps canonical progress');await unmount(tree);
  console.log('PASS: quiet home availability across load/empty/live refresh; real booking preserves bounded search progress.');
  const helpers = load('frontend', 'src/components/CustomerBookingView.tsx');
  assert.equal(helpers.confirmedPaymentMethod([{ ...card, verified: false }]), undefined);
  assert.equal(helpers.confirmedPaymentMethod([{ ...card, setup_status: 'processing' }]), undefined);
  assert.equal(helpers.confirmedPaymentMethod([{ ...card, stripe_payment_method_id: null }]), undefined);
  assert.equal(helpers.confirmedPaymentMethod([card, { ...card, id: 'default', is_default: true, created_at: '2026-01-01' }]).id, 'default');
  customerActive = { trip_id: 'existing-trip', status: 'in_trip' };
  queryData['customer-active-trip'] = { data: customerActive };
  tree = await mount(CustomerHome);
  assert.equal(tree.root.findAllByProps({ testID: 'home-where-to' }).length, 0, 'An active trip cannot display a new booking flow'); await unmount(tree);
  // Customer 05/06: full map viewport, dock events and stale private photo/location responses.
  user = { id: 'viewport-customer', role: 'user', legal_accepted: true };
  stubs['@/src/components/FloatingTabBar'] = { ...load('frontend','src/components/FloatingTabBar.tsx') };
  const Tabs = ({children,...props}) => React.createElement('Tabs',props,children);
  Tabs.Screen = 'TabScreen'; stubs['expo-router'].Tabs = Tabs;
  const CustomerTabs = load('frontend','app/(app)/_layout.tsx').default;
  tree = await mount(CustomerTabs);
  const sceneLayout = tree.root.findByType('Tabs').props.screenLayout;
  for (const name of ['home','history','assist','messages','profile']) {
    const scene = sceneLayout({route:{key:name,name},children:'screen-content'});
    assert.equal(scene.props.children,'screen-content','Every scene fills its blur target; scroll clearance belongs inside each screen');
  }
  await unmount(tree);
  const { FloatingTabBar } = stubs['@/src/components/FloatingTabBar'];
  const routes = ['home','history','assist','messages','profile','wallet'].map(name=>({key:name,name}));
  let tabEvents=[], tabNavigations=[], preventTab=false;
  const dockProps = {state:{index:0,routes},descriptors:Object.fromEntries(routes.map(route=>[route.key,{options:{title:route.name}}])),navigation:{emit:event=>{tabEvents.push(event);return{defaultPrevented:preventTab}},navigate:name=>tabNavigations.push(name)}};
  tree = await mount(()=>React.createElement(FloatingTabBar,dockProps));
  assert.equal(tree.root.findAllByType('Pressable').length,5,'Hidden wallet cannot become a sixth dock item');
  await act(async()=>{button(tree,'tab-home').props.onPress();button(tree,'tab-assist').props.onPress()});
  assert.deepEqual(tabNavigations,['assist'],'Focused home emits event without duplicate navigation');
  preventTab=true;await act(async()=>button(tree,'tab-profile').props.onPress());assert.deepEqual(tabNavigations,['assist'],'A prevented router event cannot navigate');
  await unmount(tree);
  const themeStub=stubs['@/src/theme'].useColorTheme;stubs['@/src/theme'].useColorTheme=()=>({mode:'dark',effective:'dark',ready:true});
  tree=await mount(()=>React.createElement(FloatingTabBar,dockProps));assert.equal(tree.root.findByType('BlurView').props.tint,'dark');await unmount(tree);stubs['@/src/theme'].useColorTheme=themeStub;
  let photoRequests=[];stubs['@/src/lib/api'].customerProfileApi={photoSource:version=>{const request=deferred();photoRequests.push({version,...request});return request.promise}};
  const Avatar=load('frontend','src/components/V10CustomerAvatar.tsx').V10CustomerAvatar;
  tree=await mount(()=>React.createElement(Avatar,{initials:'A',version:'older'}));
  await act(async()=>tree.update(React.createElement(Avatar,{initials:'B',version:'newer'})));
  await act(async()=>photoRequests[0].resolve({uri:'private-old-photo'}));assert.equal(tree.root.findAllByType('Image').length,0,'Old profile response cannot expose the previous photo');
  await act(async()=>photoRequests[1].resolve({uri:'private-current-photo'}));assert.equal(tree.root.findByType('Image').props.source.uri,'private-current-photo');
  await act(async()=>tree.root.findByType('Image').props.onError());assert.match(text(tree),/B/);assert.equal(tree.root.findAllByType('Image').length,0);await unmount(tree);
  customerActive=null;const initialReverse=deferred();let reverseCount=0;
  queryData['customer-active-trip'] = { data: null };
  stubs['@/src/lib/api'].placesApi.reverse=async()=>++reverseCount===1?initialReverse.promise:{label:'Newest pickup'};
  tree=await mount(CustomerHome);
  const beforeLocationPrompts=permissionCalls;const locationPrompt=deferred();permissionResult=()=>locationPrompt.promise;
  await act(async()=>{button(tree,'home-recenter').props.onPress();button(tree,'home-recenter').props.onPress()});
  assert.equal(permissionCalls,beforeLocationPrompts+1,'Recenter cannot race multiple OS permission requests');
  await act(async()=>locationPrompt.resolve({status:'granted'}));
  await act(async()=>initialReverse.resolve({label:'Obsolete pickup'}));
  await act(async()=>button(tree,'home-where-to').props.onPress());
  assert.match(text(tree),/Newest pickup/);assert.doesNotMatch(text(tree),/Obsolete pickup/);await unmount(tree);
  stubs['@/src/lib/api'].placesApi.reverse=async()=>({label:'Actual pickup'});
  console.log('PASS: Customer 05/06 full map viewport, dock events/theme, stale private avatar response, serialized recenter and newest location response.');
  // Customer 07/08: bad places cannot book, newer route wins, drawing respects lifecycle/motion.
  const homeExports = load('frontend','app/(app)/home.tsx');
  assert.equal(homeExports.normalizeSearchPlace({name:'bad',lat:91,lng:10}),null);
  assert.equal(homeExports.normalizeSearchPlace({name:'bad',lat:'',lng:10}),null);
  assert.equal(homeExports.normalizeSearchPlace({name:' ',lat:59,lng:10}),null);
  assert.equal(homeExports.normalizeSearchPlace({name:' Actual place ',lat:'59.91',lng:'10.75'}).name,'Actual place');
  assert.equal(helpers.arrivalTime(11,Date.parse('2026-10-14T09:51:00Z')),'12:02','Arrival uses actual duration and Oslo timezone');
  assert.equal(helpers.arrivalTime(null,Date.now()),'—');assert.equal(helpers.arrivalTime(11,null),'—');assert.equal(helpers.arrivalTime(-2,Date.now()),'—');
  let routeRequests=[];stubs['@/src/lib/api'].tripsApi.estimate=()=>{const request=deferred();routeRequests.push(request);return request.promise};
  stubs['@/src/lib/api'].placesApi.search=async()=>({results:[{name:'Bad location',lat:91,lng:10},{name:'Newest destination',address:'Actual address',lat:60.39,lng:5.32}]});
  tree=await mount(CustomerHome);
  await act(async()=>button(tree,'quick-Hjem').props.onPress());assert.equal(routeRequests.length,1);assert.equal(button(tree,'route-choose-vehicle').props.disabled,true);
  await act(async()=>button(tree,'booking-change-dest').props.onPress());
  await act(async()=>tree.root.findByProps({testID:'search-input'}).props.onChangeText('Bergen'));await tick(350);
  assert.doesNotMatch(text(tree),/Bad location/);
  await act(async()=>button(tree,'search-result-0').props.onPress());assert.equal(routeRequests.length,2);
  await act(async()=>routeRequests[1].resolve({...quote,duration_min:21,geometry:{coordinates:[[10.74,59.91],[5.32,60.39]]}}));
  await act(async()=>routeRequests[0].resolve(quote));
  assert.match(text(tree),/21 min/);assert.doesNotMatch(text(tree),/11 min/);assert.equal(Boolean(button(tree,'route-choose-vehicle').props.disabled),false);await unmount(tree);
  stubs['@/src/lib/api'].tripsApi.estimate=async()=>quote;
  const routeReveal=load('frontend','src/components/useRouteReveal.ts');
  const line=[[10,59],[10.02,59],[10.02,59.01]];
  assert.equal(routeReveal.routePrefix(line,0).length,0);assert.equal(routeReveal.routePrefix(line,1),line);assert.equal(routeReveal.routePrefix([[200,59],[10,59]],.5).length,0);
  let routeAnimations=[],routeStops=0;const priorTiming=native.Animated.timing;
  native.Animated.timing=(value,config)=>{routeAnimations.push({value,config});return{start(){},stop(){routeStops++}}};
  const RouteFrame=({route,enabled=true})=>React.createElement('RouteFrame',{route:routeReveal.useRouteReveal(route,enabled)});
  await act(async()=>{tree=renderer.create(React.createElement(RouteFrame,{route:line}))});assert.equal(routeAnimations.length,1);assert.equal(routeAnimations[0].config.duration,900);
  assert.equal(tree.root.findByType('RouteFrame').props.route.length,0);
  await act(async()=>routeAnimations[0].value.setValue(.5));
  const halfway=tree.root.findByType('RouteFrame').props.route;assert.equal(halfway.length,2);assert.ok(halfway[1][0]>10&&halfway[1][0]<10.02,'Drawing remains on the actual first route segment');
  await act(async()=>tree.update(React.createElement(RouteFrame,{route:line.map(point=>[...point])})));
  assert.equal(routeAnimations.length,1,'An identical server geometry cannot restart drawing');
  await act(async()=>tree.update(React.createElement(RouteFrame,{route:[[10,59],[10.04,59.03]]})));
  assert.equal(routeAnimations.length,2);assert.equal(routeStops,1);assert.equal(tree.root.findByType('RouteFrame').props.route.length,0,'New destination cannot flash the old route');
  await unmount(tree);assert.equal(routeStops,2);assert.equal(routeAnimations[0].value.listeners.size,0,'Unmount removes the JS line listener');
  reduceMotion=true;tree=await mount(()=>React.createElement(RouteFrame,{route:line}));assert.equal(JSON.stringify(tree.root.findByType('RouteFrame').props.route),JSON.stringify(line));assert.equal(routeAnimations.length,2);await unmount(tree);
  native.Animated.timing=priorTiming;reduceMotion=false;
  console.log('PASS: Customer 07/08 invalid places hidden, quote race/pending guard, actual Oslo arrival, server-route-only 900ms drawing, identical-route stability, cleanup and reduced motion.');
  // Customer 09/10: exact class names, invalid prices, canonical reservation and artwork fallback.
  assert.equal(helpers.validVehiclePrice(NaN),false);assert.equal(helpers.validVehiclePrice(-1),false);assert.equal(helpers.validVehiclePrice('184'),false);assert.equal(helpers.validVehiclePrice(184),true);
  assert.equal(helpers.cardExpiryLabel({exp_month:8,exp_year:2028}),'Utløper 08/28');assert.equal(helpers.cardExpiryLabel({exp_month:13,exp_year:2028}),null);
  customerActive={trip_id:'real-search',status:'searching',vehicle_type:'premium',pickup_lat:59.91,pickup_lng:10.74};queryData['customer-active-trip']={data:customerActive};tree=await mount(CustomerHome);assert.equal(supplyConfigs.at(-1).vehicleType,'premium','A real booked search retains its canonical class');await unmount(tree);customerActive=null;queryData['customer-active-trip']={data:null};
  stubs['expo-image']={Image:'CategoryImage'};
  const CategoryImage=load('frontend','src/components/V10CategoryImage.tsx').V10CategoryImage;
  tree=await mount(()=>React.createElement(CategoryImage,{kind:'ai-first',selected:true}));
  assert.match(tree.root.findByType('CategoryImage').props.source.uri,/standard-3d.webp/);assert.equal(tree.root.findByType('CategoryImage').props.contentFit,'contain');await unmount(tree);
  for(const [kind,asset] of [['premium','premium-3d.webp'],['suv','suv-category.png']]) { tree=await mount(()=>React.createElement(CategoryImage,{kind,selected:false}));assert.ok(tree.root.findByType('CategoryImage').props.source.uri.endsWith(asset));await unmount(tree); }
  console.log('PASS: Customer 09/10 all-class home supply, three categories, immediate quoted prices, selected-category drivers, canonical card and distinct bundled illustrations.');
  // Customer 11/12: canonical consent contract and server-owned matching lifecycle.
  assert.equal(helpers.confirmedWaitingPolicy({token:' ',free_minutes:5,per_minute:4,max_fee:40}),false);
  assert.equal(helpers.confirmedWaitingPolicy({token:'valid',free_minutes:5,per_minute:-1,max_fee:40}),false);
  assert.equal(helpers.confirmedPaymentMethod([null,{verified:true}]),undefined);
  stubs['@/src/lib/api'].tripsApi.estimate=async()=>({...quote,options:[{...quote.options[0],waiting_policy:{free_minutes:5,per_minute:4,max_fee:40}}]});
  tree=await mount(CustomerHome);await act(async()=>button(tree,'quick-Hjem').props.onPress());await act(async()=>button(tree,'route-choose-vehicle').props.onPress());await act(async()=>button(tree,'booking-review').props.onPress());
  assert.equal(button(tree,'waiting-policy-consent'),undefined);assert.equal(button(tree,'booking-confirm').props.disabled,true);
  const requestsBeforeInvalidPolicy=bookingRequests.length;await act(async()=>button(tree,'booking-confirm').props.onPress());assert.equal(bookingRequests.length,requestsBeforeInvalidPolicy,'Missing policy token must never reach reservation');
  stubs['@/src/lib/api'].tripsApi.estimate=async()=>quote;await act(async()=>button(tree,'booking-refresh-quote').props.onPress());
  assert.match(text(tree),/Bekreft tur/);assert.equal(button(tree,'waiting-policy-consent').props.accessibilityState.checked,false,'Refreshing keeps review but requires new consent');await unmount(tree);
  const originalTripRequest=stubs['@/src/lib/api'].tripsApi.request;
  stubs['@/src/lib/api'].tripsApi.request=async body=>{bookingRequests.push(body);return{ok:true}};
  tree=await mount(CustomerHome);await act(async()=>button(tree,'quick-Hjem').props.onPress());await act(async()=>button(tree,'route-choose-vehicle').props.onPress());await act(async()=>button(tree,'booking-review').props.onPress());await act(async()=>button(tree,'waiting-policy-consent').props.onPress());
  const beforeUnconfirmedNavigation=navigation.length;await act(async()=>button(tree,'booking-confirm').props.onPress());
  assert.equal(navigation.length,beforeUnconfirmedNavigation,'An unconfirmed response cannot navigate to an invented trip');assert.match(text(tree),/Bestillingen ble ikke bekreftet/);await unmount(tree);stubs['@/src/lib/api'].tripsApi.request=originalTripRequest;
  stubs['@/src/components/AvailabilityStatus'].AvailabilityStatus=Status;
  const TripPresentation=load('frontend','src/components/CustomerTripView.tsx').CustomerTripView;
  let matchingCallbacks=[];const matchingProps={trip:{trip_id:'matching-test',status:'searching',search_attempt:2,search_next_attempt_at:new Date(Date.now()+30000).toISOString(),search_deadline_at:new Date(Date.now()+90000).toISOString(),pickup_address:'Actual pickup',dropoff_address:'Actual destination'},driverPhoto:null,eta:null,distance:null,offline:false,gpsFresh:false,available:{cars:[],phase:'waiting',issue:'empty',attempt:2,now:Date.now(),seconds:30,retry:()=>matchingCallbacks.push('retry')},insideBusy:false,readyBusy:false,authorizationBusy:false,cancelBusy:false,canCancel:true,onInside(){},onCall(){},onChat(){},onShare(){},onSafety(){},onCancel:()=>matchingCallbacks.push('cancel'),onMinimize(){},onHome:()=>matchingCallbacks.push('home'),onWalk(){},onReady(){},onAuthorize(){},onPhotoError(){},onSheetLayout(){}};
  const oldMatchingTiming=native.Animated.timing;let matchingAnimations=[],matchingStops=0;
  native.Animated.timing=(value,config)=>{matchingAnimations.push({value,config});return{start(){},stop(){matchingStops++}}};
  await act(async()=>{tree=renderer.create(React.createElement(TripPresentation,matchingProps))});
  assert.match(text(tree),/Finner sjåfør/);assert.match(text(tree),/Forsøk 2 av 3/);assert.match(text(tree),/Actual destination/);assert.doesNotMatch(text(tree),/Spør 3 biler|Majorstuen/);
  assert.equal(matchingAnimations.length,2);assert.deepEqual(matchingAnimations.map(animation=>animation.config.duration),[1400,1500]);
  await act(async()=>matchingAnimations.forEach(animation=>animation.value.setValue(1)));assert.equal(matchingCallbacks.length,0,'Activity animation cannot retry, book, assign or navigate');
  await act(async()=>tree.update(React.createElement(TripPresentation,{...matchingProps,trip:{...matchingProps.trip,status:'cancelled',cancel_reason:'no_driver_available'}})));
  assert.equal(matchingStops,2,'Server terminal state stops both decorative loops');assert.ok(button(tree,'booking-home'));assert.equal(matchingCallbacks.length,0,'No-driver result waits for explicit retry');await unmount(tree);
  reduceMotion=true;tree=await mount(()=>React.createElement(TripPresentation,matchingProps));assert.equal(matchingAnimations.length,2,'Reduced motion does not schedule matching activity');await unmount(tree);reduceMotion=false;native.Animated.timing=oldMatchingTiming;
  console.log('PASS: Customer 11/12 invalid policy blocks booking, refreshed offer retains review/requires consent, source activity durations/cleanup/reduced motion, real dispatch progress and explicit no-driver recovery.');
  // Customer 13/14: actual fresh road proximity, stable assignment and ETA safety.
  const {driverApproaching}=load('frontend','src/lib/tripPresence.ts');
  const freshDriverTrip={...matchingProps.trip,status:'driver_on_way',driver_id:'real-driver',driver:{name:'Actual Driver',car:'Actual car',plate:'ACTUAL1',rating:4.9,phone:'test'},driver_lat:59.91,driver_lng:10.75,driver_location_at:new Date().toISOString(),driver_distance_to_pickup_km:.2};
  assert.equal(driverApproaching(freshDriverTrip),true);
  assert.equal(driverApproaching({...freshDriverTrip,driver_location_at:new Date(Date.now()-31000).toISOString()}),false);
  for(const distance of [undefined,-1,NaN,.5])assert.equal(driverApproaching({...freshDriverTrip,driver_distance_to_pickup_km:distance}),false);
  const beforeDriverHaptics=hapticCalls.length;
  await act(async()=>{tree=renderer.create(React.createElement(TripPresentation,{...matchingProps,trip:freshDriverTrip,eta:2,gpsFresh:true}))});
  assert.match(text(tree),/Ankommer hentestedet/);assert.match(text(tree),/ACTUAL1/);assert.equal(hapticCalls.length,beforeDriverHaptics+1);assert.equal(hapticCalls.at(-1),'medium');
  await act(async()=>tree.update(React.createElement(TripPresentation,{...matchingProps,trip:{...freshDriverTrip,driver_location_at:new Date().toISOString()},eta:1,gpsFresh:true})));
  assert.equal(hapticCalls.length,beforeDriverHaptics+1,'Repeated server polls cannot replay driver-found haptics');
  await act(async()=>tree.update(React.createElement(TripPresentation,{...matchingProps,trip:freshDriverTrip,eta:2,gpsFresh:false,offline:true})));
  assert.doesNotMatch(text(tree),/Ankommer hentestedet/);assert.match(text(tree),/Venter på oppdatert turstatus/);
  const etaTexts=tree.root.findAllByProps({testID:'driver-arrival-eta'})[0];assert.ok(etaTexts.findAllByType('Text').some(node=>Array.isArray(node.props.children)&&node.props.children[0]==='—'),'Stale ETA is suppressed even if old numeric props remain');
  await unmount(tree);
  console.log('PASS: Customer 13/14 fresh road-only approach, invalid/stale proximity suppression, canonical driver/card, medium assignment feedback once per view and stale numeric ETA suppression.');
  const {pickupFreeWait}=load('frontend','src/lib/tripPresence.ts');
  const arrivalClock=Date.parse('2026-10-14T09:00:42Z');const waitingTrip={status:'at_pickup',at_pickup_at:'2026-10-14T09:00:00Z',waiting_policy:{free_minutes:5}};
  assert.equal(pickupFreeWait(waitingTrip,arrivalClock),'4:18');assert.equal(pickupFreeWait(waitingTrip,arrivalClock+400000),'0:00');
  for(const partial of [{status:'in_trip'},{at_pickup_at:'invalid'},{at_pickup_at:'2026-10-14T10:00:00Z'},{waiting_policy:{free_minutes:-1}}])assert.equal(pickupFreeWait({...waitingTrip,...partial},arrivalClock),null);
  const beforeArrivalFeedback=hapticCalls.length;
  tree=await mount(()=>React.createElement(TripPresentation,{...matchingProps,trip:{...freshDriverTrip,status:'at_pickup',at_pickup_at:new Date(Date.now()-42000).toISOString(),waiting_policy:{free_minutes:5,per_minute:4,max_fee:40}},gpsFresh:true,readySent:true}));
  assert.ok(tree.root.findAllByProps({testID:'pickup-identity'})[0].props.pop);assert.equal(button(tree,'customer-in-car').props.disabled,true);assert.match(text(tree),/Sjåføren er varslet/);assert.equal(hapticCalls.length,beforeArrivalFeedback+1);await unmount(tree);
  console.log('PASS: Customer 15/16 real pickup guidance, confirmed readiness/no repeat/start, server-timestamp wait estimate, unknown/future/ended clock suppression and arrival feedback.');
  const {V10TripDock}=load('frontend','src/components/V10TripDock.tsx');let tripDockActions=[];
  const tripDockProps={onDriver:()=>tripDockActions.push('driver'),onMessage:()=>tripDockActions.push('message'),onSafety:()=>tripDockActions.push('safety'),onTrip:()=>tripDockActions.push('trip')};
  tree=await mount(()=>React.createElement(V10TripDock,tripDockProps));assert.equal(tree.root.findAllByType('Pressable').length,4);
  for(const id of ['driver','message','safety','trip'])await act(async()=>button(tree,'trip-dock-'+id).props.onPress());assert.deepEqual(tripDockActions,['driver','message','safety','trip']);await unmount(tree);
  const Island=load('frontend','src/components/ActiveTripCard.tsx').ActiveTripCard;
  let islandOpens=0;tree=await mount(()=>React.createElement(Island,{trip:{...freshDriverTrip,status:'in_trip',eta_min:4},onOpen:()=>islandOpens++}));
  assert.equal(tree.root.findAllByType('Text').some(node=>node.props.children===' min'),false,'Pickup ETA cannot be relabelled as destination ETA on a live ride');assert.equal(button(tree,'active-trip-reopen').props.style({pressed:false}).minHeight,60);await act(async()=>button(tree,'active-trip-reopen').props.onPress());assert.equal(islandOpens,1);await unmount(tree);
  assert.equal(homeExports.normalizeSearchPlace({name:'bad',lat:true,lng:10}),null);
  const Handle=load('frontend','src/components/V10MinimizeHandle.tsx').V10MinimizeHandle;let handleMinimizes=0;
  tree=await mount(()=>React.createElement(Handle,{onMinimize:()=>handleMinimizes++}));const handle=tree.root.findByType('View');
  await act(async()=>{handle.props.onPanResponderRelease(null,{dy:-50,dx:0});handle.props.onPanResponderRelease(null,{dy:40,dx:70});handle.props.onPanResponderRelease(null,{dy:40,dx:2});handle.props.onAccessibilityAction({nativeEvent:{actionName:'activate'}})});
  assert.equal(handleMinimizes,2,'Only deliberate downward gesture and accessible activation minimize; upward/horizontal gestures do not');await unmount(tree);
  console.log('PASS: Customer 17/18 real four-action trip dock, active island/reopen, no invented destination ETA and retained safe emergency/report/share flows.');
  const nearingTrip={...freshDriverTrip,status:'in_trip',dropoff_lat:59.911,dropoff_lng:10.751,driver_location_at:new Date().toISOString()};
  const destinationHaptics=hapticCalls.length;
  await act(async()=>{tree=renderer.create(React.createElement(TripPresentation,{...matchingProps,trip:nearingTrip,gpsFresh:true}))});
  assert.equal(tree.root.findAllByProps({testID:'customer-arriving-view'}).length,1);
  assert.equal(button(tree,'customer-arrival-driver-authority').props.disabled,true,'GPS proximity cannot complete a ride');
  assert.equal(hapticCalls.length,destinationHaptics+1);
  await act(async()=>tree.update(React.createElement(TripPresentation,{...matchingProps,trip:{...nearingTrip,driver_lat:59.9111},gpsFresh:true})));
  assert.equal(hapticCalls.length,destinationHaptics+1,'Arrival feedback is emitted once per trip');
  await act(async()=>tree.update(React.createElement(TripPresentation,{...matchingProps,trip:nearingTrip,gpsFresh:true,offline:true})));
  assert.equal(tree.root.findAllByProps({testID:'customer-arriving-view'}).length,0,'Offline data cannot trigger arrival presentation');await unmount(tree);
  stubs['./carAvailability']=load('frontend','src/lib/carAvailability.ts');
  const {mapFocusPoints}=load('frontend','src/lib/mapFocus.ts');
  const arrivalFocus=mapFocusPoints({pickup:{lat:60,lng:11},dropoff:{lat:59.911,lng:10.751},activeCar:{lat:59.912,lng:10.752},focusMode:'destination',focusRoute:[[11,60],[10.751,59.911]]});
  assert.equal(arrivalFocus.length,2);assert.ok(arrivalFocus.every(p=>p.lat<59.92),'Arrival excludes departed pickup/full route from camera bounds');
  console.log('PASS: Customer 19 actual destination camera bounds, fresh-only proximity, once-per-trip feedback and server-owned completion.');
  const CountUp=load('frontend','src/components/V10CountUp.tsx').V10CountUp;
  const countTiming=native.Animated.timing;let countAnimation,countStops=0;
  native.Animated.timing=(value,config)=>{countAnimation={value,config};return {start(){},stop(){countStops++;}}};
  tree=await mount(()=>React.createElement(CountUp,{value:184,format:n=>Math.round(n)+' kr'}));
  assert.equal(countAnimation.config.duration,700);await act(async()=>countAnimation.value.setValue(.5));assert.match(text(tree),/92 kr/);
  await act(async()=>countAnimation.value.setValue(1));assert.match(text(tree),/184 kr/);await unmount(tree);assert.equal(countStops,1);assert.equal(countAnimation.value.listeners.size,0);
  const latestCount=countAnimation;reduceMotion=true;tree=await mount(()=>React.createElement(CountUp,{value:184,format:n=>Math.round(n)+' kr'}));assert.equal(countAnimation,latestCount);assert.match(text(tree),/184 kr/);await unmount(tree);
  tree=await mount(()=>React.createElement(CountUp,{value:NaN,format:n=>String(n)}));assert.doesNotMatch(text(tree),/NaN/);assert.match(text(tree),/Ikke tilgjengelig/);await unmount(tree);reduceMotion=false;native.Animated.timing=countTiming;


  // Actual settings controllers: OS permission, confirmed save and synchronous locks.
  let pushAllowed = false, notificationWrites = 0, notificationResult;
  stubs['@/src/lib/nativeRuntime'] = { registerNativePush: async () => pushAllowed };
  user = { id: 'settings-customer', role: 'user' };
  queryData = { 'customer-notification-settings': { data: { notifications: false, trip_updates: true } }, 'customer-notification-trip': { data: null } };
  stubs['@/src/lib/api'].settingsApi.update = async value => { notificationWrites++; return notificationResult(value); };
  const CustomerNotifications = load('frontend', 'app/customer-notifications.tsx').default;
  tree = await mount(CustomerNotifications);
  await act(async()=>button(tree,'notification-settings-group').props.onPress());assert.equal(button(tree,'notification-settings-group').props.accessibilityState.expanded,false);
  await act(async()=>button(tree,'notification-settings-group').props.onPress());assert.equal(button(tree,'notification-settings-group').props.accessibilityState.expanded,true);
  await act(async () => button(tree, 'setting-notifications').props.onPress());
  assert.equal(notificationWrites, 0, 'Denied OS registration cannot enable server notifications');
  pushAllowed = true; const settingRequest = deferred(); notificationResult = () => settingRequest.promise;
  await act(async () => { button(tree, 'setting-notifications').props.onPress(); button(tree, 'setting-notifications').props.onPress(); });
  assert.equal(notificationWrites, 1);
  assert.equal(button(tree, 'setting-notifications').props.accessibilityState.checked, false);
  await act(async () => settingRequest.resolve({ notifications: true }));
  assert.equal(button(tree, 'setting-notifications').props.accessibilityState.checked, true);
  notificationResult = async () => ({ notifications: false, trip_updates: true });
  await act(async () => button(tree, 'setting-trip_updates').props.onPress());
  assert.equal(button(tree, 'setting-trip_updates').props.accessibilityState.checked, true, 'Unconfirmed update retains previous value');
  assert.match(text(tree), /Varselvalget ble ikke bekreftet/); await unmount(tree);
  queryData['customer-notification-trip']={data:{trip_id:'ended',status:'completed',payment_status:'paid'}};
  queryData['customer-notification-history']={data:{trips:[{trip_id:'real-receipt',status:'completed',payment_status:'paid',price:184,dropoff_address:'Actual destination'}]}};
  tree=await mount(CustomerNotifications);assert.equal(button(tree,'notifications-active-trip'),undefined,'Ended trip must not appear active in notifications');
  await act(async()=>button(tree,'notification-receipt-real-receipt').props.onPress());assert.equal(navigation.at(-1)[1],'/receipt/real-receipt?view=receipt');await unmount(tree);
  const CompactSettings = load('frontend', 'app/settings.tsx').default;
  tree = await mount(CompactSettings); await act(async () => button(tree, 'settings-data').props.onPress()); assert.equal(navigation.at(-1)[1], '/customer-data'); await unmount(tree);
  user = { id: 'settings-driver', role: 'driver' };
  queryData = { 'driver-v10-settings': { data: { req_sound: true } } };
  notificationResult = async () => ({ req_sound: true });
  const DriverSettings = load('driver-app', 'app/driver-settings.tsx').default;
  tree = await mount(DriverSettings); const cacheValueBeforeSettings = saved.get('driver_req_sound');
  await act(async () => button(tree, 'driver-setting-req_sound').props.onPress());
  assert.equal(button(tree, 'driver-setting-req_sound').props.accessibilityState.checked, true);
  assert.equal(saved.get('driver_req_sound'), cacheValueBeforeSettings, 'Unconfirmed server preference cannot change native cache');
  const soundSetting = deferred(); notificationResult = () => soundSetting.promise;
  const writesBefore = notificationWrites;
  await act(async () => { button(tree, 'driver-setting-req_sound').props.onPress(); button(tree, 'driver-setting-req_sound').props.onPress(); });
  assert.equal(notificationWrites, writesBefore + 1);
  await act(async () => soundSetting.resolve({ req_sound: false }));
  assert.equal(button(tree, 'driver-setting-req_sound').props.accessibilityState.checked, false);
  assert.equal(saved.get('driver_req_sound'), 'false'); await unmount(tree);
  console.log('PASS: Actual Customer notification permission/confirmed write/duplicates/rejection, compact data routing and Driver sound server/native-cache confirmation.');
  // Actual approval and selfie routes: registered documents are not invented approvals.
  const Approval = load('driver-app', 'app/driver-approval.tsx').default;
  user = { id: 'identity-driver', role: 'driver', approved: true, legal_accepted: true, fullName: 'Actual Driver' };
  queryData = { 'driver-approval-account': { data: { ...user, drivers_license_path: 'stored-file' } }, 'driver-approval-identity': { data: { status: 'pending_review' } } };
  tree = await mount(Approval);
  assert.equal(button(tree, 'driver-approval-continue'), undefined, 'Pending selfie cannot enter cockpit');
  assert.match(text(tree), /Registrert/); assert.match(text(tree), /Dokument mangler/);
  const documentRows = tree.root.findAll(node => node.type === 'Pressable' && String(node.props.testID).includes('license_path'));
  assert.equal(documentRows[0].props.testID, 'driver-approval-taxi_license_path', 'Missing document appears first');
  await unmount(tree);
  queryData['driver-approval-identity'] = { data: { status: 'verified' } };
  tree = await mount(Approval); await act(async () => button(tree, 'driver-approval-continue').props.onPress()); assert.equal(navigation.at(-1)[1], '/'); await unmount(tree);
  queryData['driver-approval-account'] = { data: { ...user, identity_recheck_required: true } };
  tree = await mount(Approval); assert.equal(button(tree, 'driver-approval-continue'), undefined); await unmount(tree);
  let cameraPermission = { granted: false, canAskAgain: true }, cameraPermissionResult, cameraPermissionCalls = 0, captures = 0, captureResult, selfieCalls = 0, selfieResult, identityStatus = { status: 'not_submitted' };
  stubs['expo-camera'] = { useCameraPermissions: () => [cameraPermission, async () => { cameraPermissionCalls++; return cameraPermissionResult(); }], CameraView: React.forwardRef((props, ref) => { React.useImperativeHandle(ref, () => ({ takePictureAsync: async () => { captures++; return captureResult(); } })); return React.createElement('CameraView', props); }) };
  Object.assign(stubs['@/src/lib/api'].driverApi, { identityVerification: async () => identityStatus, submitIdentitySelfie: async () => { selfieCalls++; return selfieResult(); } });
  const Identity = load('driver-app', 'app/driver-identity.tsx').default;
  cameraPermissionResult = async () => ({ granted: false });
  tree = await mount(Identity); await act(async () => button(tree, 'driver-identity-camera').props.onPress());
  assert.match(text(tree), /Kameratilgang må være aktivert/); assert.equal(tree.root.findAllByType('CameraView').length, 0);
  const permissionRequest = deferred(); cameraPermissionResult = () => permissionRequest.promise;
  await act(async () => { button(tree, 'driver-identity-camera').props.onPress(); button(tree, 'driver-identity-camera').props.onPress(); });
  assert.equal(cameraPermissionCalls, 2, 'Only one permission request may run after previous denial');
  await act(async () => permissionRequest.resolve({ granted: true }));
  assert.equal(button(tree, 'driver-selfie-capture').props.disabled, true);
  await act(async () => button(tree, 'driver-selfie-capture').props.onPress()); assert.equal(captures, 0, 'Camera readiness is required');
  await act(async () => tree.root.findByType('CameraView').props.onCameraReady());
  const captureRequest = deferred(); captureResult = () => captureRequest.promise;
  await act(async () => { button(tree, 'driver-selfie-capture').props.onPress(); button(tree, 'driver-selfie-capture').props.onPress(); }); assert.equal(captures, 1);
  await act(async () => captureRequest.resolve({ uri: 'file://actual-selfie' }));
  selfieResult = async () => ({});
  await act(async () => button(tree, 'driver-selfie-submit').props.onPress()); assert.match(text(tree), /Innsendingen ble ikke bekreftet/); assert.ok(button(tree, 'driver-selfie-submit'));
  const selfieRequest = deferred(); selfieResult = () => selfieRequest.promise;
  await act(async () => { button(tree, 'driver-selfie-submit').props.onPress(); button(tree, 'driver-selfie-submit').props.onPress(); }); assert.equal(selfieCalls, 2, 'Submission serializes double taps and retains failed photo for retry');
  await act(async () => selfieRequest.resolve({ id: 'actual-verification', status: 'pending_review', submitted_at: '2026-10-13T10:00:00Z' }));
  assert.match(text(tree), /Til kontroll/); assert.equal(button(tree, 'driver-identity-continue'), undefined, 'Uploaded selfie is not verified identity'); await unmount(tree);
  identityStatus = { status: 'verified' };
  tree = await mount(Identity); assert.ok(button(tree, 'driver-identity-continue')); await unmount(tree);
  user = { ...user, identity_recheck_required: true };
  tree = await mount(Identity); assert.equal(button(tree, 'driver-identity-continue'), undefined); await unmount(tree);
  console.log('PASS: Actual Driver approval missing-first/truthful document state and identity/recheck gates; camera permission/readiness/capture/submission serialization, rejected upload retains photo and confirmed upload stays pending manual review.');
  // Real receipt route: provider return alone is not payment; rating is explicit and confirmed.
  stubs['expo-web-browser'] = { openBrowserAsync: async () => {} };
  stubs['expo-linear-gradient'] = { LinearGradient: 'LinearGradient' };
  let receiptTrip = { trip_id: 'receipt-fixture', status: 'arrived', payment_status: 'pending', payment_flow: 'reservation', price: 184, duration_min: 12, distance_km: 3.4, pickup_address: 'Actual pickup', dropoff_address: 'Actual destination', driver: { name: 'Actual Driver' } };
  currentTripId = receiptTrip.trip_id;
  stubs['expo-router'].useLocalSearchParams = () => ({ tripId: currentTripId });
  let nativePayCalls = 0, nativePayResult, ratingCalls = [], rateResult;
  stubs['@/src/lib/nativePayment'] = { payNative: async () => { nativePayCalls++; return nativePayResult(); } };
  Object.assign(stubs['@/src/lib/api'].tripsApi, { get: async () => receiptTrip, complete: async () => ({ ok: true }), rate: async (...args) => { ratingCalls.push(args); return rateResult(); } });
  const Receipt = load('frontend', 'app/receipt/[tripId].tsx').default;
  const PaymentCheck=load('frontend','src/components/V10PaymentCheck.tsx').V10PaymentCheck;
  const checkTiming=native.Animated.timing;let checkAnimation,checkStops=0;
  native.Animated.timing=(value,config)=>{checkAnimation={value,config};return {start(){},stop(){checkStops++;}}};
  tree=await mount(PaymentCheck);assert.equal(checkAnimation.config.duration,420);assert.equal(checkAnimation.config.delay,160);
  await act(async()=>checkAnimation.value.setValue(1));assert.equal(tree.root.findAllByProps({testID:'payment-check-path'})[0].props.strokeDashoffset,0);await unmount(tree);assert.equal(checkStops,1);assert.equal(checkAnimation.value.listeners.size,0);
  reduceMotion=true;tree=await mount(PaymentCheck);assert.equal(tree.root.findAllByProps({testID:'payment-check-path'})[0].props.strokeDashoffset,0);await unmount(tree);reduceMotion=false;native.Animated.timing=checkTiming;

  tree = await mount(Receipt);
  assert.equal(button(tree, 'receipt-pay'), undefined, 'Reserved ride cannot expose a second charge');
  assert.equal(tree.root.findAllByProps({ testID: 'customer-paid-screen' }).length, 0);
  assert.equal(button(tree, 'rate-star-5'), undefined, 'Unpaid rides cannot be rated');
  await unmount(tree);
  receiptTrip = { ...receiptTrip, payment_flow: 'checkout' };
  const nativePay = deferred(); nativePayResult = () => nativePay.promise;
  tree = await mount(Receipt);
  await act(async () => { button(tree, 'receipt-pay').props.onPress(); button(tree, 'receipt-pay').props.onPress(); });
  assert.equal(nativePayCalls, 1);
  await act(async () => nativePay.resolve(false));
  assert.equal(tree.root.findAllByProps({ testID: 'customer-paid-screen' }).length, 0, 'Unconfirmed native payment cannot show paid');
  receiptTrip = { ...receiptTrip, status: 'completed', payment_status: 'paid', receipt_id: 'ACTUAL-ID' };
  await act(async () => button(tree, 'receipt-check-payment').props.onPress());
  assert.equal(tree.root.findAllByProps({ testID: 'customer-paid-screen' }).length, 1);
  await act(async () => button(tree, 'receipt-view').props.onPress());
  assert.match(text(tree), /ACTUAL-ID/); assert.doesNotMatch(text(tree), /88213|ingrid@lie|Servicegebyr|Herav mva|kvittering sendt/);
  assert.equal(button(tree, 'receipt-pdf-unavailable').props.disabled, true);
  await unmount(tree);
  tree = await mount(Receipt);
  assert.ok(button(tree, 'receipt-confirm-paid'), 'A ride already paid on arrival still shows its completion summary first');
  await act(async () => button(tree, 'receipt-confirm-paid').props.onPress());
  await act(async () => button(tree, 'receipt-done').props.onPress());
  await act(async () => button(tree, 'rate-star-5').props.onPress());
  assert.equal(ratingCalls.length, 0, 'Selecting stars cannot submit the rating');
  assert.ok(button(tree, 'receipt-skip-rating'), 'Skip remains available after choosing stars');
  await act(async () => button(tree, 'rating-feedback-Ren bil').props.onPress());
  const ratingSubmission = deferred(); rateResult = () => ratingSubmission.promise;
  await act(async () => { button(tree, 'receipt-submit-rating').props.onPress(); button(tree, 'receipt-submit-rating').props.onPress(); });
  assert.equal(ratingCalls.length, 1); assert.equal(ratingCalls[0][1].rating, 5); assert.equal(ratingCalls[0][1].feedback, 'Ren bil');
  await act(async () => ratingSubmission.reject(new Error('Network failed')));
  assert.match(text(tree), /Vurderingen ble ikke lagret/); assert.doesNotMatch(text(tree), /Takk for vurderingen/);
  assert.equal(button(tree, 'rate-star-5').props.accessibilityState.checked, true, 'Failed rating preserves selection for retry');
  rateResult = async () => ({ ok: true });
  await act(async () => button(tree, 'receipt-submit-rating').props.onPress());
  assert.match(text(tree), /Takk for vurderingen/); await unmount(tree);
  // Payment instruments must be canonically verified; setup/remove share one synchronous lock.
  user = { id: 'customer-payments' };
  queryData = { 'payment-methods': { data: [card, { ...card, id: 'fake-card', last4: '9999', verified: false }] }, 'native-payment-config': { data: { enabled: false } } };
  let setupCalls = 0, removeCalls = 0, setupResult, removeResult;
  stubs['@/src/lib/nativePayment'] = { nativeWalletAvailability: async () => null,
    setupNativePaymentMethod: async () => { setupCalls++; return setupResult(); } };
  Object.assign(stubs['@/src/lib/api'].paymentApi, { nativeConfig: async () => ({}), cardSetup: async () => { setupCalls++; return setupResult(); }, cardSetupStatus: async () => ({ ready: true, verified: false }), remove: async () => { removeCalls++; return removeResult(); } });
  const PaymentMethods = load('frontend', 'app/payment-methods.tsx').default;
  tree = await mount(PaymentMethods);
  assert.match(text(tree), /4321/); assert.match(text(tree), /Ikke verifisert/); assert.doesNotMatch(text(tree), /Equinor|INGRID|4821/);
  const setupRequest = deferred(); setupResult = () => setupRequest.promise;
  await act(async () => { button(tree, 'pm-stripe').props.onPress(); button(tree, 'pm-stripe').props.onPress(); button(tree, 'pm-remove-verified-card').props.onPress(); });
  assert.equal(setupCalls, 1); assert.equal(removeCalls, 0);
  await act(async () => setupRequest.reject(new Error('Stripe har ikke bekreftet kortet ennå.')));
  assert.match(text(tree), /ikke bekreftet kortet/);
  const removing = deferred(); removeResult = () => removing.promise;
  const invalidationsBeforeRemove = invalidated.length;
  await act(async () => { button(tree, 'pm-remove-verified-card').props.onPress(); button(tree, 'pm-remove-verified-card').props.onPress(); });
  assert.equal(removeCalls, 1);
  await act(async () => removing.resolve({ ok: false }));
  assert.equal(invalidated.length, invalidationsBeforeRemove, 'Unconfirmed removal cannot pretend the card was removed');
  assert.match(text(tree), /Kortet ble ikke bekreftet fjernet/);
  removeResult = async () => ({ deleted: true });
  await act(async () => button(tree, 'pm-remove-verified-card').props.onPress());
  assert.equal(invalidated.length, invalidationsBeforeRemove + 1, 'Actual backend deleted confirmation refreshes the card list');
  await unmount(tree);
  queryData['payment-methods'] = { isError: true, data: [card] };
  tree = await mount(PaymentMethods); assert.equal(tree.root.findAllByProps({ testID: 'payment-primary-card' }).length, 0, 'Fetch failure hides stale card'); await unmount(tree);
  stubs['./Motion'] = { useReducedMotion: () => reduceMotion };
  const Entrance = load('frontend','src/components/V10Entrance.tsx').V10Entrance;
  const originalTiming = native.Animated.timing; let entrances = [], stoppedEntrances = 0;
  native.Animated.timing = (value, config) => { entrances.push(config); return { start() {}, stop() { stoppedEntrances++; } }; };
  reduceMotion = false;
  tree = await mount(() => React.createElement(Entrance,{sheet:true},React.createElement('Text',null,'Permission content')));
  assert.equal(entrances.length,0,'A measured sheet must not animate before its actual height is known');
  await act(async () => tree.root.findByType('AnimatedView').props.onLayout({nativeEvent:{layout:{height:320}}}));
  assert.equal(entrances.length,1);assert.equal(entrances[0].duration,280);
  await act(async () => tree.root.findByType('AnimatedView').props.onLayout({nativeEvent:{layout:{height:370}}}));
  assert.equal(entrances.length,1,'An error growing the permission sheet must not replay entry motion');
  await unmount(tree);assert.equal(stoppedEntrances,1,'Unmount cancels the pending entry animation');
  reduceMotion = true;tree = await mount(() => React.createElement(Entrance,{delay:120},React.createElement('Text',null,'Benefit')));
  assert.equal(entrances.length,1,'Reduced motion does not schedule entry movement');await unmount(tree);
  reduceMotion=false;tree=await mount(()=>React.createElement(Entrance,{pop:true},React.createElement('Text',null,'Plate')));
  assert.equal(entrances.length,2);assert.equal(entrances[1].duration,320);assert.deepEqual(Array.from(tree.root.findByType('AnimatedView').props.style[1].transform[0].scale.outputRange),[.94,1]);await unmount(tree);
  reduceMotion=true;tree=await mount(()=>React.createElement(Entrance,{pop:true},React.createElement('Text',null,'Plate')));assert.equal(entrances.length,2);await unmount(tree);
  native.Animated.timing = originalTiming;reduceMotion = false;
  console.log('PASS: V10 measured-sheet entry waits for layout, does not replay on errors, cancels on unmount and respects reduced motion.');
  console.log('PASS: Actual receipt reservation/no-double-charge, native/payment status gate, explicit rating submit/feedback/retry/serialization, truthful receipt fields, canonical cards, serialized setup/remove and failed-card refresh.');
  console.log('PASS: Actual CustomerHome route/vehicle/payment/confirmation flow, route camera, real canonical card, waiting consent, duplicate booking lock, quoted-price token and active-trip exclusion.');
  console.log('PASS: Actual DriverHome minimize/reopen persistence, semantic versus network rejection, queued recovery and serialized offer acceptance/decline.');
  console.log('PASS: Actual DriverHome pickup-route map, arrival API, held start API, live-route switch, preserved final confirmation, completion API and pending-payment summary wiring.');
  console.log('PASS: Driver real 900ms hold/release/unmount/reduced-motion/duplicate guards, arrival/start/completion review states, missing waiting policy, hidden in-trip finances and pending-payment summary.');
  console.log('PASS: Customer compact profile routes/saved data, active-trip-only chat, correct passenger bubbles, duplicate sends, failure preserves draft, status errors hide stale conversation, active/history/detail/receipt routing and absent-map handling.');
  console.log('PASS: Driver overview/detail income comes from authoritative summaries, excludes unconfirmed trip income, hides errored totals, does not invent payout dates and does not turn missing weekly data into zero.');
  console.log('PASS: Driver assigned/busy/parked vehicle selection, server confirmation, duplicate taps, paid-only trip income, Oslo date grouping, history/detail routing and privacy-limited trip detail.');
  console.log('PASS: Driver login empty/offline/duplicate attempts, role/approval/2FA/legal/selfie gates; compact profile routes and truthful verification/rating counts.');
  console.log('PASS: manual location, permission grant/denial/error, legal/session routing, duplicate permission taps, confirmed navigation save, rejected navigation response, concurrent navigation taps, closed-trip messaging, active-trip messages, duplicate quick replies and send failure.');
})().catch(error => { console.error(error); process.exitCode = 1; });
