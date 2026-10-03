/** Component behavior checks. Native rendering and pixel comparison still require devices. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const customerRequire = createRequire(path.join(root, 'frontend/package.json'));
const React = customerRequire('react');
const renderer = customerRequire('react-test-renderer');
const ts = customerRequire('typescript');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const originalError = console.error;
console.error = (...args) => { if (!String(args[0]).includes('react-test-renderer is deprecated')) originalError(...args); };
let clock = 0, timerId = 0, nativeListeners = 0;
const timers = new Map(), accessibility = new Set(), cache = new Map();
const timingCalls = [];
const stubs = new Map();
class Value {
  constructor(value) { this.value = value; }
  setValue(value) { this.value = value; }
  interpolate(config) { return { value: this.value, ...config }; }
  stopAnimation() {}
}
const animation = () => ({ start() {}, stop() {} });
const native = {
  Text: 'NativeText', TextInput: 'NativeTextInput', View: 'View', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator', ScrollView: 'ScrollView', KeyboardAvoidingView: 'KeyboardAvoidingView', Platform: { OS: 'ios' },
  StyleSheet: { create: value => value, absoluteFill: { position: 'absolute', inset: 0 }, flatten: value => Array.isArray(value) ? Object.assign({}, ...value.filter(Boolean).map(native.StyleSheet.flatten)) : value },
  AccessibilityInfo: {
    isReduceMotionEnabled: () => Promise.resolve(false),
    addEventListener: (_event, callback) => { nativeListeners++; accessibility.add(callback); return { remove: () => { nativeListeners--; accessibility.delete(callback); } }; },
  },
  Animated: { Value, View: 'AnimatedView', timing: (_value, config) => { timingCalls.push(config); return animation(); }, sequence: animation, loop: animation },
  Easing: { linear: value => value, bezier: (...values) => values },
};
function load(app, file) {
  const absolute = path.join(root, app, file);
  if (cache.has(absolute)) return cache.get(absolute);
  const result = { exports: {} };
  cache.set(absolute, result.exports);
  const compiled = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const localRequire = name => {
    if (stubs.has(name)) return stubs.get(name);
    if (name === 'react') return React;
    if (name.startsWith('./')) { const target = path.relative(path.join(root, app), path.resolve(path.dirname(absolute), name)); return load(app, fs.existsSync(path.join(root, app, target + '.tsx')) ? target + '.tsx' : target + '.ts'); }
    if (name === 'react/jsx-runtime') return customerRequire(name);
    if (name === 'react-native') return native;
    if (name === 'expo-linear-gradient') return { LinearGradient: 'Gradient' };
    if (name === 'react-native-svg') return new Proxy({ __esModule: true, default: 'Svg' }, { get: (target, key) => target[key] ?? String(key) });
    if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
    if (name.startsWith('@expo-google-fonts/')) return new Proxy({}, { get: (_target, key) => key === '__esModule' ? true : `asset:${String(key)}` });
    if (name.endsWith('.ttf')) return name;
    if (name.startsWith('@/')) {
      const relative = name.slice(2);
      const target = ['.tsx', '.ts'].map(extension => relative + extension).find(candidate => fs.existsSync(path.join(root, app, candidate)));
      return load(app, target);
    }
    throw new Error(`Unexpected dependency in component check: ${name}`);
  };
  vm.runInNewContext(compiled, { require: localRequire, module: result, exports: result.exports, console,
    setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, at: clock + delay }); return id; },
    clearTimeout: id => timers.delete(id),
    setInterval: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, at: Infinity }); return id; },
    clearInterval: id => timers.delete(id),
  }, { filename: absolute });
  cache.set(absolute, result.exports);
  return result.exports;
}
function advance(ms) {
  clock += ms;
  for (const [id, timer] of [...timers]) if (timer.at <= clock) { timers.delete(id); timer.callback(); }
}
const act = renderer.act;
(async () => {
  for (const app of ['frontend', 'driver-app']) {
    const { font, FONT_ASSETS } = load(app, 'src/theme.ts');
    const { resolveFont, Text } = load(app, 'src/components/Typography.tsx');
    for (const [weight, family] of [[300, 'Inter_300Light'], [400, font.body], [500, font.medium], [600, font.semibold], [700, font.bold], [800, font.extraBold]]) {
      assert.equal(resolveFont({ fontWeight: String(weight) }).fontFamily, family);
      assert.ok(FONT_ASSETS[family], `${app} must load ${family}`);
    }
    assert.equal(resolveFont({ fontFamily: font.mono, fontWeight: '500' }).fontFamily, font.monoMedium);
    assert.equal(resolveFont({}, font.bold).fontFamily, font.bold);
    assert.equal(resolveFont({ fontFamily: 'Custom', fontWeight: '700' }).fontFamily, 'Custom');
    let tree;
    await act(async () => { tree = renderer.create(React.createElement(Text, { style: { color: '#FFFFFF', fontWeight: '700' } }, React.createElement(Text, { style: { fontSize: 12 } }, 'kr'))); });
    const nested = tree.root.findAllByType('NativeText')[1];
    const nestedStyle = native.StyleSheet.flatten(nested.props.style);
    assert.equal(nestedStyle.color, '#FFFFFF');
    assert.equal(nestedStyle.fontFamily, font.bold);
    assert.equal(nestedStyle.lineHeight, 16);
    await act(async () => tree.unmount());
    const { gradientPoints } = load(app, 'src/components/FigmaGradient.tsx');
    for (const [angle, width, height] of [[120, 320, 52], [145, 104, 104], [180, 390, 844], [135, 334, 160]]) {
      const { start, end } = gradientPoints(angle, width, height);
      assert.ok(Math.abs(start.x + end.x - 1) < 1e-12);
      assert.ok(Math.abs(start.y + end.y - 1) < 1e-12);
      const dx = (end.x - start.x) * width, dy = (end.y - start.y) * height;
      assert.ok(Math.abs(dx * -Math.cos(angle * Math.PI / 180) - dy * Math.sin(angle * Math.PI / 180)) < 1e-9, 'CSS gradient angle must survive non-square layouts');
    }
  }
  const motion = load('driver-app', 'src/components/Motion.tsx');
  function Preference() { return React.createElement('Preference', { reduced: motion.useReducedMotion() }); }
  let preferences;
  await act(async () => { preferences = renderer.create(React.createElement(React.Fragment, {}, React.createElement(Preference), React.createElement(Preference))); });
  assert.equal(nativeListeners, 1, 'Preference listeners must be shared');
  assert.ok(preferences.root.findAllByType('Preference').every(node => !node.props.reduced));
  await act(async () => accessibility.forEach(callback => callback(true)));
  assert.ok(preferences.root.findAllByType('Preference').every(node => node.props.reduced));
  await act(async () => preferences.unmount());
  assert.equal(nativeListeners, 0, 'Preference listener must be removed');
  for (const app of ['frontend', 'driver-app']) {
    const { DesignToggle } = load(app, 'src/components/DesignToggle.tsx');
    function ToggleHarness() {
      const [value, setValue] = React.useState(false);
      return React.createElement(DesignToggle, { value, onChange: setValue, label: 'Varsler' });
    }
    let toggle;
    await act(async () => { toggle = renderer.create(React.createElement(ToggleHarness)); });
    await act(async () => accessibility.forEach(callback => callback(true)));
    const count = timingCalls.length;
    await act(async () => toggle.root.findByType('Pressable').props.onPress());
    assert.equal(toggle.root.findByType('Pressable').props.accessibilityState.checked, true);
    assert.equal(timingCalls.length, count, 'Reduced motion must apply toggle state without a duration-zero animation');
    await act(async () => accessibility.forEach(callback => callback(false)));
    assert.equal(timingCalls.at(-1).duration, 150);
    await act(async () => toggle.unmount());
  }
  const { SlideConfirm } = load('driver-app', 'src/components/SlideConfirm.tsx');
  let calls = 0, release;
  const errors = [];
  let slide;
  await act(async () => { slide = renderer.create(React.createElement(SlideConfirm, { label: 'Start tur', onConfirm: () => { calls++; return new Promise(resolve => { release = resolve; }); }, onError: error => errors.push(error) })); });
  await act(async () => { const press = slide.root.findByType('Pressable').props.onPress; press(); press(); });
  await act(async () => advance(349));
  assert.equal(calls, 0, 'Trip action must wait for the confirmation animation');
  await act(async () => advance(1));
  assert.equal(calls, 1, 'Repeated presses must call the backend action once');
  assert.equal(slide.root.findByType('Pressable').props.disabled, true);
  await act(async () => release());
  assert.equal(slide.root.findByType('Pressable').props.disabled, false);
  await act(async () => slide.unmount());
  await act(async () => { slide = renderer.create(React.createElement(SlideConfirm, { label: 'Avslutt tur', onConfirm: () => { calls++; }, onError: error => errors.push(error) })); });
  await act(async () => slide.root.findByType('Pressable').props.onPress());
  await act(async () => slide.unmount());
  await act(async () => advance(350));
  assert.equal(calls, 1, 'Unmounted trip controls must never send stale actions');
  const failure = new Error('Network failed');
  await act(async () => { slide = renderer.create(React.createElement(SlideConfirm, { label: 'Start tur', onConfirm: async () => { throw failure; }, onError: error => errors.push(error) })); });
  await act(async () => slide.root.findByType('Pressable').props.onPress());
  await act(async () => advance(350));
  assert.deepEqual(errors, [failure], 'Backend action errors must reach the screen');
  assert.equal(slide.root.findByType('Pressable').props.disabled, false);
  await act(async () => slide.unmount());
  // Support must use server replies/IDs, suppress duplicate submission and leave failures visible.
  const user = { id: 'customer-1', fullName: 'Test Kunde', email: 'test@example.com' };
  let chats = 0, tickets = 0, resolveChat, resolveTicket;
  const supportApi = {
    aiApi: { chat: () => { chats++; return new Promise(resolve => { resolveChat = resolve; }); } },
    api: { post: (route, body) => { assert.equal(route, '/support/public'); assert.equal(body.contact, user.email); assert.ok(body.message.length >= 10); tickets++; return new Promise(resolve => { resolveTicket = resolve; }); } },
  };
  stubs.set('@/src/context/AuthContext', { useAuth: () => ({ user }) });
  stubs.set('@/src/lib/api', supportApi);
  const { CustomerSupport } = load('frontend', 'src/components/CustomerSupport.tsx');
  let support;
  await act(async () => { support = renderer.create(React.createElement(CustomerSupport, { onBack() {} })); });
  await act(async () => support.root.findByProps({ testID: 'support-message-input' }).props.onChangeText('Jeg trenger hjelp med en tur'));
  await act(async () => { const send = support.root.findByProps({ testID: 'support-send' }).props.onPress; send(); send(); });
  assert.equal(chats, 1);
  await act(async () => resolveChat({ reply: 'Et ekte svar fra API-et' }));
  assert.ok(support.root.findAllByType('NativeText').some(node => node.props.children === 'Et ekte svar fra API-et'));
  await act(async () => { const escalate = support.root.findByProps({ testID: 'support-escalate' }).props.onPress; escalate(); escalate(); });
  assert.equal(tickets, 1);
  await act(async () => resolveTicket({ data: { ok: true, ticket_id: 'server-ticket-007' } }));
  assert.ok(support.root.findAllByType('NativeText').some(node => String(node.props.children).includes('server-ticket-007')));
  await act(async () => support.root.findByProps({ testID: 'support-escalate' }).props.onPress());
  await act(async () => resolveTicket({ data: {} }));
  assert.ok(support.root.findAllByType('NativeText').some(node => node.props.accessibilityRole === 'alert'));
  assert.equal(support.root.findAllByType('NativeText').filter(node => String(node.props.children).includes('Saksnummer:')).length, 1, 'An unconfirmed ticket must not produce a success message');
  await act(async () => support.root.findByProps({ testID: 'support-message-input' }).props.onChangeText('Ny henvendelse etter unmount'));
  await act(async () => support.root.findByProps({ testID: 'support-send' }).props.onPress());
  await act(async () => support.unmount());
  await act(async () => resolveChat({ reply: 'Et sent svar' }));
  // Privacy export shares real server data once and never opens a share sheet after leaving.
  let exports = 0, resolveExport;
  const shared = [];
  native.Share = { share: async value => shared.push(value) };
  native.Linking = { openSettings: async () => {}, openURL: async () => {} };
  stubs.set('@/src/lib/api', { gdprApi: { export: () => { exports++; return new Promise(resolve => { resolveExport = resolve; }); } } });
  const { CustomerProfileDetails } = load('frontend', 'src/components/CustomerProfileDetails.tsx');
  let details;
  await act(async () => { details = renderer.create(React.createElement(CustomerProfileDetails, { view: 'privacy', onBack() {}, onDelete() {}, onSupport() {} })); });
  await act(async () => { const press = details.root.findByProps({ testID: 'privacy-export' }).props.onPress; press(); press(); });
  assert.equal(exports, 1);
  const exported = { user: { id: user.id }, trips: [{ id: 'real-trip' }] };
  await act(async () => resolveExport(exported));
  assert.deepEqual(JSON.parse(shared[0].message), exported);
  await act(async () => details.root.findByProps({ testID: 'privacy-export' }).props.onPress());
  await act(async () => details.unmount());
  await act(async () => resolveExport({ user: { id: 'late' } }));
  assert.equal(shared.length, 1, 'Leaving privacy must cancel the late share-sheet action');
  // Driver offer alerts persist the real backend preference, gated by OS permission.
  const driverUser = { id: 'driver-1', fullName: 'Test Sjåfør' };
  let permissionGranted = true, settingsData = { notif_requests: true }, updates = 0, resolveUpdate;
  const confirmedSettings = [], cachedPreferences = [];
  native.Image = 'Image';
  native.AppState = { addEventListener: () => ({ remove() {} }) };
  stubs.set('expo-notifications', { getPermissionsAsync: async () => ({ granted: permissionGranted }), requestPermissionsAsync: async () => ({ granted: permissionGranted }) });
  stubs.set('expo-router', { useRouter: () => ({ push() {} }) });
  stubs.set('@/src/context/AuthContext', { useAuth: () => ({ user: driverUser, logout() {}, refresh: async () => {} }) });
  stubs.set('@/src/utils/storage', { storage: { setItem: async (key, value) => cachedPreferences.push({ key, value }) } });
  stubs.set('@/src/lib/api', {
    authApi: { me() {} }, authenticatedFileSource() {},
    driverApi: { ratings() {}, vehicles() {}, summary() {}, payouts() {} },
    settingsApi: { get() {}, update: body => { updates++; assert.equal(typeof body.notif_requests, 'boolean'); return new Promise(resolve => { resolveUpdate = resolve; }); } },
    apiError: error => error.message,
  });
  stubs.set('@tanstack/react-query', {
    useQuery: ({ queryKey }) => ({ data: queryKey[0] === 'driver-notification-settings' ? settingsData : undefined }),
    useQueryClient: () => ({ setQueryData: (key, data) => { confirmedSettings.push({ key, data }); settingsData = data; } }),
  });
  const DriverProfile = load('driver-app', 'app/(driver)/profile.tsx').default;
  let profile;
  await act(async () => { profile = renderer.create(React.createElement(DriverProfile)); });
  await act(async () => { const press = profile.root.findByProps({ testID: 'profile-push-toggle' }).findByType('Pressable').props.onPress; press(); press(); });
  assert.equal(updates, 1);
  await act(async () => resolveUpdate({ notif_requests: false }));
  assert.equal(confirmedSettings.length, 1);
  assert.deepEqual(cachedPreferences, [{ key: 'driver_notif_requests', value: 'false' }]);
  await act(async () => profile.root.findByProps({ testID: 'profile-push-toggle' }).findByType('Pressable').props.onPress());
  await act(async () => resolveUpdate({}));
  assert.equal(confirmedSettings.length, 1, 'Unconfirmed settings must not update the cache or toggle');
  assert.equal(cachedPreferences.length, 1);
  await act(async () => profile.root.findByProps({ testID: 'profile-push-toggle' }).findByType('Pressable').props.onPress());
  await act(async () => profile.unmount());
  await act(async () => resolveUpdate({ notif_requests: true }));
  assert.equal(confirmedSettings.length, 1, 'Unmounted profiles must not apply a late preference response');
  permissionGranted = false;
  await act(async () => { profile = renderer.create(React.createElement(DriverProfile)); });
  const beforeDenied = updates;
  await act(async () => profile.root.findByProps({ testID: 'profile-push-toggle' }).findByType('Pressable').props.onPress());
  assert.equal(updates, beforeDenied, 'Denied OS notification permission must not enable backend offer alerts');
  await act(async () => profile.unmount());
  // Address edits preserve the chosen record and label, including an initial Home shortcut.
  const records = [{ id: 'home-1', label: 'Hjem', name: 'Hjemme', icon: 'home' }, { id: 'work-1', label: 'Jobb', name: 'Kontoret', icon: 'briefcase' }];
  const writes = [];
  let addressQueryFailed = false;
  const placeApi = { mePlacesApi: { list() {}, add: async value => writes.push({ type: 'add', value }), update: async (id, value) => writes.push({ type: 'update', id, value }), remove: async () => {} }, placesApi: { search: async () => ({ results: [{ name: 'Ny adresse', lat: 59.9, lng: 10.7 }] }) } };
  stubs.set('@/src/lib/api', placeApi);
  stubs.set('expo-router', { useRouter: () => ({ back() {} }), useLocalSearchParams: () => ({ label: 'Hjem' }) });
  stubs.set('@tanstack/react-query', { useQuery: () => addressQueryFailed ? ({ data: undefined, isLoading: false, isError: true, refetch: async () => {} }) : ({ data: { places: records }, isLoading: false }), useQueryClient: () => ({ invalidateQueries: async () => {} }) });
  const SavedPlaces = load('frontend', 'app/saved-places.tsx').default;
  let saved;
  await act(async () => { saved = renderer.create(React.createElement(SavedPlaces)); });
  await act(async () => saved.root.findByProps({ testID: 'place-edit-work-1' }).props.onPress());
  await act(async () => saved.root.findByProps({ testID: 'places-search-input' }).props.onChangeText('Ny adresse'));
  await act(async () => advance(350));
  await act(async () => saved.root.findByProps({ testID: 'places-result-0' }).props.onPress());
  assert.equal(saved.root.findAllByProps({ testID: 'places-label-Hjem' }).length, 0, 'Editing Work must not inherit the Home shortcut label');
  await act(async () => { const save = saved.root.findByProps({ testID: 'places-label-Jobb' }).props.onPress; save(); save(); });
  assert.deepEqual(writes.map(item => ({ type: item.type, id: item.id, label: item.value.label })), [{ type: 'update', id: 'work-1', label: 'Jobb' }]);
  await act(async () => saved.unmount());
  addressQueryFailed = true;
  await act(async () => { saved = renderer.create(React.createElement(SavedPlaces)); });
  assert.equal(saved.root.findAllByProps({ testID: 'places-search-input' }).length, 0, 'Failed address fetch must not open a create form for a potentially existing Home address');
  assert.equal(saved.root.findAllByProps({ testID: 'places-retry' }).length, 1);
  await act(async () => saved.unmount());
  // Customer active trip: minimize/reopen retains canonical server state; completion exits.
  native.Image = 'Image'; native.Modal = 'Modal';
  native.AppState = { currentState: 'active', addEventListener: () => ({ remove() {} }) };
  native.Share = { share: async () => ({}) }; native.Alert = { alert() {} };
  let serverTrip = { trip_id: 'unit-trip', status: 'driver_on_way', pickup_lat: 59.9, pickup_lng: 10.7, dropoff_lat: 59.91, dropoff_lng: 10.71, driver: { name: 'Fixture', car: 'Fixture vehicle', plate: 'FIXTURE' } };
  const navigations = [];
  stubs.set('expo-router', { useLocalSearchParams: () => ({ tripId: 'unit-trip' }), useRouter: () => ({ replace: url => navigations.push(url) }) });
  stubs.set('@/src/lib/api', { tripsApi: { get: async () => serverTrip }, tripDriverPhotoSource: async () => ({ uri: 'fixture' }) });
  stubs.set('@/src/components/Map', { Map: 'Map' });
  stubs.set('@/src/components/ChatSheet', { ChatSheet: 'ChatSheet' });
  const Booking = load('frontend', 'app/booking/[tripId].tsx').default;
  let booking;
  await act(async () => { booking = renderer.create(React.createElement(Booking)); });
  await act(async () => booking.root.findByProps({ testID: 'active-trip-minimize' }).props.onPress());
  assert.equal(booking.root.findAllByProps({ testID: 'active-trip-reopen' }).length, 1);
  assert.equal(booking.root.findAllByProps({ testID: 'driver-arrival-eta' }).length, 0);
  await act(async () => booking.root.findByProps({ testID: 'active-trip-reopen' }).props.onPress());
  assert.equal(booking.root.findAllByProps({ testID: 'driver-arrival-eta' }).length, 1);
  await act(async () => booking.unmount());
  serverTrip = { ...serverTrip, status: 'completed' };
  await act(async () => { booking = renderer.create(React.createElement(Booking)); });
  assert.ok(navigations.includes('/receipt/unit-trip'));
  await act(async () => booking.unmount());
  assert.equal(timers.size, 0);
  assert.equal(nativeListeners, 0);
  console.log('PASS: Customer minimize/reopen/completion; fonts, nested inheritance, CSS gradient angles, reduced motion/toggles, single delayed trip action, support server replies/ticket IDs, duplicate guards, privacy export, permission-gated server-confirmed Driver alerts, unmount cancellation, error recovery and address edit identity.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { console.error = originalError; });
