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
stubs.set('@/src/utils/storage', { storage: { getItem: async () => null, setItem: async () => {} } });
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
    if (app === 'frontend' && name === './api' && absolute.endsWith(path.join('frontend', 'src', 'lib', 'useAvailableCars.ts'))) {
      return { carsApi: { nearby: async () => ({ cars: [] }) } };
    }
    if (name === '@/src/components/VehicleAsset') return { VehicleAsset: 'VehicleAsset' };
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
  vm.runInNewContext(compiled, { require: localRequire, module: result, exports: result.exports, console, process: { env: {} },
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
  const { monthToDateTrips } = load('driver-app', 'src/lib/earnings.ts');
  const monthStart = new Date(2026, 1, 1).toISOString();
  const previousMonth = new Date(new Date(monthStart).getTime() - 1).toISOString();
  const februaryTrips = [
    { trip_id: 'previous-month', created_at: previousMonth, payment_status: 'paid', driver_earnings: 150 },
    { trip_id: 'paid-this-month', created_at: monthStart, payment_status: 'paid', driver_earnings: 175 },
    { trip_id: 'unpaid-this-month', created_at: new Date(2026, 1, 10, 12).toISOString(), payment_status: 'pending', driver_earnings: null },
    { trip_id: 'missing-earnings', created_at: new Date(2026, 1, 11, 12).toISOString(), payment_status: 'paid', driver_earnings: null },
  ];
  assert.deepEqual(
    monthToDateTrips(februaryTrips, new Date(2026, 1, 12, 12)).map(trip => trip.trip_id),
    ['paid-this-month', 'unpaid-this-month', 'missing-earnings'],
    'Driver month-to-date history excludes trips before the current calendar month',
  );
  for (const app of ['frontend', 'driver-app']) {
    const { font, FONT_ASSETS } = load(app, 'src/theme.ts');
    const { resolveFont, Text } = load(app, 'src/components/Typography.tsx');
    for (const [weight, family] of [[300, font.light], [400, font.body], [500, font.medium], [600, font.semibold], [700, font.bold], [800, font.extraBold]]) {
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
  // Actual accessibility screen changes typography/motion across mounted components after persistence.
  stubs.set('expo-router', { useRouter: () => ({ back() {} }) });
  const AccessibleScreen = load('frontend', 'app/customer-accessibility.tsx').default;
  const AccessibleText = load('frontend', 'src/components/Typography.tsx').Text;
  const useAccessibleMotion = load('frontend', 'src/components/Motion.tsx').useReducedMotion;
  let observedMotion, preferencesWrites = 0, resolvePreferenceWrite;
  const preferenceStorage = stubs.get('@/src/utils/storage').storage;
  const originalPreferenceWrite = preferenceStorage.setItem;
  function MotionProbe() { observedMotion = useAccessibleMotion(); return null; }
  let accessible;
  await act(async () => { accessible = renderer.create(React.createElement(React.Fragment, null, React.createElement(AccessibleScreen), React.createElement(AccessibleText, { testID: 'scale-parent', style: { fontSize: 14 } }, React.createElement(AccessibleText, { testID: 'scale-child' }, 'Nested')), React.createElement(MotionProbe))); });
  const accessibleSwitch = id => accessible.root.findAll(node => node.type === 'Pressable' && node.props.testID === id)[0];
  preferenceStorage.setItem = async () => { preferencesWrites++; return new Promise(resolve => { resolvePreferenceWrite = resolve; }); };
  await act(async () => { accessibleSwitch('accessibility-large-text').props.onPress(); accessibleSwitch('accessibility-large-text').props.onPress(); });
  assert.equal(preferencesWrites, 1);
  assert.equal(accessibleSwitch('accessibility-large-text').props.accessibilityState.checked, false, 'Text setting waits for persisted acknowledgement');
  await act(async () => resolvePreferenceWrite());
  for (const id of ['scale-parent', 'scale-child']) assert.equal(native.StyleSheet.flatten(accessible.root.findAll(node => node.type === 'NativeText' && node.props.testID === id)[0].props.style).fontSize, 14 * 1.15, 'Nested text scales once, not twice');
  preferenceStorage.setItem = async () => { throw new Error('Disk unavailable'); };
  await act(async () => accessibleSwitch('accessibility-reduced-motion').props.onPress());
  assert.equal(observedMotion, false); assert.equal(accessibleSwitch('accessibility-reduced-motion').props.accessibilityState.checked, false);
  assert.equal(accessible.root.findAllByProps({ testID: 'accessibility-save-error' }).length > 0, true);
  preferenceStorage.setItem = originalPreferenceWrite;
  await act(async () => accessibleSwitch('accessibility-reduced-motion').props.onPress()); assert.equal(observedMotion, true);
  const preferenceModule = load('frontend', 'src/lib/accessibilityPreferences.ts');
  await act(async () => { for (const listener of accessibility) listener(true); await preferenceModule.saveAccessibilityPreference('reduceMotion', false); });
  assert.equal(observedMotion, true, 'Local preference cannot override OS reduced motion');
  await act(async () => { for (const listener of accessibility) listener(false); await preferenceModule.saveAccessibilityPreference('largeText', false); });
  assert.equal(observedMotion, false);
  await act(async () => accessible.unmount());
  const DriverText = load('driver-app', 'src/components/Typography.tsx').Text;
  const DriverPreferences = load('driver-app', 'src/lib/accessibilityPreferences.ts');
  const useDriverMotion = load('driver-app', 'src/components/Motion.tsx').useReducedMotion;
  let driverMotion;
  function DriverMotionProbe() { driverMotion = useDriverMotion(); return null; }
  await act(async () => { accessible = renderer.create(React.createElement(React.Fragment, null, React.createElement(DriverText, { testID: 'driver-scale-parent', style: { fontSize: 20 } }, React.createElement(DriverText, { testID: 'driver-scale-child' }, 'Driver nested')), React.createElement(DriverMotionProbe))); });
  await act(async () => DriverPreferences.saveAccessibilityPreference('largeText', true));
  for (const id of ['driver-scale-parent', 'driver-scale-child']) assert.equal(native.StyleSheet.flatten(accessible.root.findAll(node => node.type === 'NativeText' && node.props.testID === id)[0].props.style).fontSize, 23);
  await act(async () => DriverPreferences.saveAccessibilityPreference('reduceMotion', true)); assert.equal(driverMotion, true);
  await act(async () => { await DriverPreferences.saveAccessibilityPreference('largeText', false); await DriverPreferences.saveAccessibilityPreference('reduceMotion', false); accessible.unmount(); });
  console.log('PASS: Actual accessibility persistence/duplicates/failure, global text scaling with nested inheritance, local reduced motion and OS preference priority.');
  stubs.set('expo-blur', { BlurTargetView: 'BlurTargetView', BlurView: 'BlurView' });
  const { FloatingTabBar, TabBarVisibilityProvider, useHideTabBar } = load('frontend', 'src/components/FloatingTabBar.tsx');
  const tabRoutes = ['home', 'history', 'assist', 'messages', 'profile', 'wallet'].map(name => ({ name, key: `route-${name}` }));
  const tabCalls = [];
  const tabProps = {
    state: { index: 0, routes: tabRoutes },
    descriptors: Object.fromEntries(tabRoutes.map(route => [route.key, { options: { title: route.name } }])),
    navigation: {
      emit: event => { tabCalls.push(event); return { defaultPrevented: false }; },
      navigate: (...args) => tabCalls.push(args),
    },
  };
  let tabBar;
  await act(async () => { tabBar = renderer.create(React.createElement(FloatingTabBar, tabProps)); });
  assert.equal(tabBar.root.findAllByProps({ accessibilityRole: 'tab' }).length, 5, 'Customer dock must expose the five approved routes');
  assert.equal(tabBar.root.findAllByProps({ testID: 'tab-wallet' }).length, 0, 'Wallet remains reachable through its supported route, not a dock item');
  const assistantTab = tabBar.root.findByProps({ testID: 'tab-assist' });
  assert.equal(assistantTab.findByType('View').props.style.width, 52, 'SNAR AI uses the approved inverse 52px dock tile');
  assert.equal(assistantTab.findAllByType('NativeText').length, 0, 'SNAR AI tile is icon-only like the approved dock');
  await act(async () => tabBar.root.findByProps({ testID: 'tab-messages' }).props.onPress());
  assert.ok(tabCalls.some(call => Array.isArray(call) && call[0] === 'messages'), 'Messages dock item navigates to its supported route');
  await act(async () => tabBar.unmount());
  function HideCustomerTabBar() { useHideTabBar(true); return null; }
  let hiddenTabBar;
  await act(async () => {
    hiddenTabBar = renderer.create(React.createElement(TabBarVisibilityProvider, null,
      React.createElement(React.Fragment, null, React.createElement(HideCustomerTabBar), React.createElement(FloatingTabBar, tabProps))));
  });
  assert.equal(hiddenTabBar.root.findAllByProps({ accessibilityRole: 'tab' }).length, 0, 'A screen requesting a hidden dock must not leave the dock visible');
  await act(async () => hiddenTabBar.unmount());
  native.Modal = 'Modal';
  const profileRoutes = [];
  stubs.set('@/src/components/CustomerPhoto', { CustomerPhoto: 'CustomerPhoto' });
  stubs.set('@/src/components/FigmaGradient', { FigmaGradient: 'Gradient' });
  stubs.set('@/src/components/CustomerSupport', { CustomerSupport: 'CustomerSupport' });
  stubs.set('@/src/components/CustomerProfileDetails', { CustomerProfileDetails: 'CustomerProfileDetails' });
  stubs.set('@/src/context/AuthContext', { useAuth: () => ({ user: { id: 'customer-1', fullName: 'Test Customer', email: 'test@example.test' }, logout: async () => {}, refresh: async () => {} }) });
  stubs.set('expo-router', { useRouter: () => ({ push: route => profileRoutes.push(route), replace: () => {}, back: () => {} }) });
  stubs.set('@/src/lib/socialSignIn', { googleIdentity: async () => null });
  stubs.set('@/src/lib/api', { authApi: { nativeConfig: async () => ({}), linkGoogle: async () => {} }, gdprApi: { delete: async () => {} } });
  stubs.set('@tanstack/react-query', { useQuery: () => ({ data: null, isPending: true }) });
  stubs.set('@/src/lib/api', { mePlacesApi: { list() {} }, paymentApi: { list() {} } });
  const CustomerProfile = load('frontend', 'app/(app)/profile.tsx').default;
  let customerProfile;
  await act(async () => { customerProfile = renderer.create(React.createElement(CustomerProfile)); });
  await act(async () => customerProfile.root.findByProps({ testID: 'profile-settings' }).props.onPress());
  assert.deepEqual(profileRoutes, ['/settings'], 'Customer Profile must expose the existing account settings route');
  await act(async () => customerProfile.unmount());
  const onboardingRoutes = [];
  stubs.set('@/src/components/SplashArt', { SplashBackground: 'SplashBackground', SplashBrand: 'SplashBrand' });
  stubs.set('@/src/components/KjappMark', { KjappMark: 'KjappMark' });
  stubs.set('@/src/components/Icon', { Icon: 'Icon' });
  stubs.set('@/src/context/AuthContext', { useAuth: () => ({ user: null, logout: async () => {} }) });
  stubs.set('expo-router', { useRouter: () => ({ push: route => onboardingRoutes.push(route), replace: () => {}, back: () => {} }) });
  const CustomerIndex = load('frontend', 'app/index.tsx').default;
  let onboarding;
  await act(async () => { onboarding = renderer.create(React.createElement(CustomerIndex)); });
  await act(async () => onboarding.root.findByProps({ testID: 'onboarding-next' }).props.onPress());
  await act(async () => onboarding.root.findByProps({ testID: 'onboarding-login' }).props.onPress());
  assert.deepEqual(onboardingRoutes, ['/permissions', '/login'], 'Customer onboarding preserves permission requests and existing login');
  await act(async () => onboarding.unmount());
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
  const DriverProfile = load('driver-app', 'app/driver-account.tsx').default;
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
  const dialogs = [], callsToDialer = [];
  native.Share = { share: async () => ({}) }; native.Alert = { alert: (...args) => dialogs.push(args) };
  native.Linking = { openURL: async url => { callsToDialer.push(url); } };
  let serverTrip = { trip_id: 'unit-trip', status: 'driver_on_way', pickup_lat: 59.9, pickup_lng: 10.7, dropoff_lat: 59.91, dropoff_lng: 10.71, dropoff_address: 'Fixture destination', driver: { name: 'Fixture', car: 'Fixture vehicle', plate: 'FIXTURE' } };
  const navigations = [];
  const bookingRouter = { replace: url => navigations.push(url) };
  stubs.set('expo-router', {
    useLocalSearchParams: () => ({ tripId: 'unit-trip' }),
    useRouter: () => bookingRouter,
    useFocusEffect: effect => React.useEffect(effect, [effect]),
  });
  let preferenceCalls = 0, preferenceResult, readyCalls = 0, readyResult, authorizationCalls = 0;
  let cancelRequests = 0, previews = 0, cancellationMode = 'reject', shareRequests = 0, safetyMode = 'reject';
  stubs.set('@/src/lib/api', {
    messagesApi: { send: async () => { readyCalls++; return readyResult(); } },
    tripsApi: { get: async () => serverTrip, pickupPreference: async () => { preferenceCalls++; return preferenceResult(); }, authorize: async () => { authorizationCalls++; return serverTrip; }, cancelPreview: async () => { previews++; return { cancellation_fee: 0 }; },
      cancel: async () => { cancelRequests++; if (cancellationMode === 'lost-response') serverTrip = { ...serverTrip, status: 'cancelled' }; throw new Error('Network failed'); } },
    safetyApi: { shareLink: async () => { shareRequests++; throw new Error('Network failed'); },
      log: () => safetyMode === 'never-resolve' ? new Promise(() => {}) : Promise.reject(new Error('Network failed')) },
    tripDriverPhotoSource: async () => ({ uri: 'fixture' }),
  });
  stubs.set('@/src/components/Map', { Map: 'Map' });
  stubs.set('@/src/components/AvailabilityStatus', { AvailabilityStatus: 'AvailabilityStatus' });
  stubs.set('@/src/components/ChatSheet', { ChatSheet: 'ChatSheet' });
  const Booking = load('frontend', 'app/booking/[tripId].tsx').default;
  let booking;
  await act(async () => { booking = renderer.create(React.createElement(Booking)); });
  await act(async () => booking.root.findByProps({ testID: 'active-trip-minimize' }).props.onPress());
  assert.equal(booking.root.findAllByProps({ testID: 'active-trip-reopen' }).length, 1);
  assert.ok(booking.root.findAllByType('NativeText').some(node => node.props.children === 'Venter på oppdatert sjåførposisjon'), 'Stale GPS must remain distinct from a failed trip-status request');
  assert.equal(booking.root.findAllByProps({ testID: 'driver-arrival-eta' }).length, 0);
  await act(async () => booking.root.findByProps({ testID: 'active-trip-reopen' }).props.onPress());
  assert.equal(booking.root.findAllByProps({ testID: 'driver-arrival-eta' }).length, 1);
  await act(async () => booking.unmount());
  // Actual Customer trip wiring: preferences are confirmed, serialized and never start a ride.
  let resolvePreference;
  preferenceResult = () => new Promise(resolve => { resolvePreference = resolve; });
  serverTrip = { ...serverTrip, pickup_waiting_inside: false, driver_lat: 59.9, driver_lng: 10.7, driver_location_at: new Date().toISOString(), driver_pickup_geometry: { coordinates: [[10.7, 59.9], [10.71, 59.91]] } };
  await act(async () => { booking = renderer.create(React.createElement(Booking)); });
  assert.deepEqual(booking.root.findByType('Map').props.route, serverTrip.driver_pickup_geometry.coordinates);
  assert.equal(booking.root.findByType('Map').props.dropoff, null);
  await act(async () => { const change = booking.root.findAll(node => node.type === 'Pressable' && node.props.testID === 'customer-waiting-inside')[0].props.onPress; change(); change(); });
  assert.equal(preferenceCalls, 1, 'Inside instructions must serialize rapid taps');
  assert.equal(booking.root.findAll(node => node.type === 'Pressable' && node.props.testID === 'customer-waiting-inside')[0].props.accessibilityState.checked, false, 'Preference cannot be shown as saved before server confirmation');
  await act(async () => resolvePreference({ ok: true, waiting_inside: true }));
  assert.equal(booking.root.findAll(node => node.type === 'Pressable' && node.props.testID === 'customer-waiting-inside')[0].props.accessibilityState.checked, true);
  preferenceResult = async () => ({ ok: false });
  await act(async () => booking.root.findAll(node => node.type === 'Pressable' && node.props.testID === 'customer-waiting-inside')[0].props.onPress());
  assert.equal(booking.root.findAll(node => node.type === 'Pressable' && node.props.testID === 'customer-waiting-inside')[0].props.accessibilityState.checked, true, 'Unconfirmed write preserves last confirmed preference');
  await act(async () => booking.root.findByProps({ testID: 'customer-pickup-guide' }).props.onPress());
  await act(async () => booking.root.findByProps({ testID: 'pickup-walking-directions' }).props.onPress());
  assert.ok(callsToDialer.at(-1).includes('travelmode=walking'));
  await act(async () => booking.unmount());
  serverTrip = { ...serverTrip, status: 'at_pickup' };
  let resolveReady;
  readyResult = () => new Promise(resolve => { resolveReady = resolve; });
  await act(async () => { booking = renderer.create(React.createElement(Booking)); });
  await act(async () => { const ready = booking.root.findByProps({ testID: 'customer-in-car' }).props.onPress; ready(); ready(); });
  assert.equal(readyCalls, 1);
  await act(async () => resolveReady({ id: 'confirmed-message' }));
  assert.equal(serverTrip.status, 'at_pickup', 'Customer readiness does not manufacture driver start');
  assert.ok(JSON.stringify(booking.toJSON()).includes('Sjåføren er varslet'));
  await act(async () => booking.unmount());
  serverTrip = { ...serverTrip, status: 'payment_authorizing' };
  await act(async () => { booking = renderer.create(React.createElement(Booking)); });
  await act(async () => { const authorize = booking.root.findByProps({ testID: 'booking-authorize' }).props.onPress; authorize(); authorize(); });
  assert.equal(authorizationCalls, 1);
  assert.equal(serverTrip.status, 'payment_authorizing', 'Unchanged bank status cannot be displayed as successful authorization');
  await act(async () => booking.unmount());
  serverTrip = { ...serverTrip, status: 'driver_on_way' };
  console.log('PASS: Actual Customer pickup geometry, confirmed/failed inside instructions, walking link, serialized readiness message and bank-state authorization.');
  // Failed cancellation cannot exit; duplicate confirmation must not submit twice.
  await act(async () => { booking = renderer.create(React.createElement(Booking)); });
  await act(async () => { const cancel = booking.root.findByProps({ testID: 'assigned-trip-cancel' }).props.onPress; cancel(); cancel(); });
  assert.equal(previews, 1);
  await act(async () => { const confirm = dialogs.at(-1)[2][1].onPress; confirm(); confirm(); });
  assert.equal(cancelRequests, 1);
  assert.equal(navigations.length, 0, 'A rejected/unconfirmed cancellation must retain the trip');
  assert.equal(booking.root.findAllByType('NativeText').filter(node => node.props.testID === 'booking-action-error').length, 1);
  await act(async () => booking.unmount());
  // A lost response is reconciled from actual backend status before returning home.
  cancellationMode = 'lost-response';
  await act(async () => { booking = renderer.create(React.createElement(Booking)); });
  await act(async () => booking.root.findByProps({ testID: 'assigned-trip-cancel' }).props.onPress());
  await act(async () => dialogs.at(-1)[2][1].onPress());
  assert.ok(navigations.includes('/(app)/home'));
  await act(async () => booking.unmount());
  // Sharing/report errors stay visible; double taps issue one request.
  serverTrip = { ...serverTrip, status: 'in_trip' };
  await act(async () => { booking = renderer.create(React.createElement(Booking)); });
  assert.ok(booking.root.findAllByType('NativeText').some(node => node.props.children === 'Fixture destination'), 'Active trip banner must use the server destination');
  assert.equal(booking.root.findAllByProps({ testID: 'driver-arrival-eta' }).length, 0, 'Active trip destination banner must replace pickup-arrival status');
  await act(async () => { const share = booking.root.findByProps({ testID: 'ontrip-share' }).props.onPress; share(); share(); });
  assert.equal(shareRequests, 1);
  assert.equal(booking.root.findAllByType('NativeText').filter(node => node.props.testID === 'booking-action-error').length, 1);
  await act(async () => booking.root.findByProps({ testID: 'ontrip-safety' }).props.onPress());
  await act(async () => booking.root.findByProps({ testID: 'safety-report' }).props.onPress());
  assert.equal(booking.root.findAllByType('NativeText').filter(node => node.props.testID === 'safety-action-error').length, 1);
  assert.equal(booking.root.findByType('Modal').props.visible, true);
  safetyMode = 'never-resolve';
  await act(async () => booking.root.findByProps({ testID: 'safety-call-112' }).props.onPress());
  assert.ok(callsToDialer.includes('tel:112'), 'Emergency dialer must not wait for backend logging');
  await act(async () => booking.unmount());
  // Missing/invalid/old/future GPS never produces a current ETA.
  const { driverPresence } = load('frontend', 'src/lib/tripPresence.ts');
  const now = Date.now(), position = { driver_lat: 59.9, driver_lng: 10.7 };
  assert.equal(driverPresence({ ...position, driver_location_at: new Date(now).toISOString() }, now).fresh, true);
  for (const stamp of [undefined, 'invalid', new Date(now - 31000).toISOString(), new Date(now + 6000).toISOString()]) {
    const result = driverPresence({ ...position, driver_location_at: stamp }, now);
    assert.equal(result.hasPosition, true); assert.equal(result.fresh, false);
  }
  assert.equal(driverPresence({ driver_lat: null, driver_lng: null }, now).hasPosition, false);
  assert.equal(driverPresence({ driver_lat: 91, driver_lng: 10.7 }, now).hasPosition, false);
  serverTrip = { ...serverTrip, status: 'completed' };
  await act(async () => { booking = renderer.create(React.createElement(Booking)); });
  assert.ok(navigations.includes('/receipt/unit-trip'));
  await act(async () => booking.unmount());
  // Real AuthProvider: stale refresh responses cannot resurrect or revoke another session.
  let savedToken = 'old-token', pendingMe, latestAuth, unblockPush;
  const revokedTokens = [], unregisteredTokens = [];
  const customer = { id: 'fresh-customer', email: 'fresh@example.test', role: 'user' };
  const memoryStorage = { getItem: async () => savedToken, setItem: async (_key, value) => { savedToken = value; }, removeItem: async () => { savedToken = null; } };
  stubs.set('@/src/utils/storage', { storage: memoryStorage });
  stubs.set('@/src/lib/api', { TOKEN_KEY: 'test-token-key', authApi: {
    me: () => new Promise((resolve, reject) => { pendingMe = { resolve, reject }; }),
    login: async () => ({ token: 'fresh-token', user: customer }),
    logout: async token => { revokedTokens.push(token); },
  } });
  stubs.set('@/src/lib/nativeRuntime', { unregisterNativePush: token => { unregisteredTokens.push(token); return new Promise(resolve => { unblockPush = resolve; }); } });
  stubs.set('@/src/lib/socialSignIn', { googleIdentity: async () => null, appleIdentity: async () => null });
  const authModule = load('frontend', 'src/context/AuthContext.tsx');
  function SessionProbe() { latestAuth = authModule.useAuth(); return React.createElement('Session', { user: latestAuth.user }); }
  let authTree;
  await act(async () => { authTree = renderer.create(React.createElement(authModule.AuthProvider, {}, React.createElement(SessionProbe))); });
  const staleMe = pendingMe;
  await act(async () => latestAuth.logout());
  assert.equal(savedToken, null); assert.equal(latestAuth.user, null, 'Local logout cannot wait for a hung remote push request');
  await act(async () => latestAuth.login('fresh@example.test', 'fixture-password'));
  await act(async () => staleMe.resolve({ id: 'old-customer', role: 'user' }));
  assert.equal(latestAuth.user.id, customer.id, 'Old refresh must not restore the signed-out user');
  assert.equal(savedToken, 'fresh-token');
  await act(async () => unblockPush());
  assert.deepEqual(unregisteredTokens, ['old-token']); assert.deepEqual(revokedTokens, ['old-token']);
  await act(async () => authTree.unmount());
  savedToken = 'old-token';
  await act(async () => { authTree = renderer.create(React.createElement(authModule.AuthProvider, {}, React.createElement(SessionProbe))); });
  const staleFailure = pendingMe;
  await act(async () => latestAuth.login('fresh@example.test', 'fixture-password'));
  await act(async () => staleFailure.reject({ response: { status: 401 } }));
  assert.equal(savedToken, 'fresh-token', '401 for an old request cannot erase a newer login');
  assert.equal(latestAuth.user.id, customer.id);
  await act(async () => authTree.unmount());
  savedToken = 'offline-token';
  await act(async () => { authTree = renderer.create(React.createElement(authModule.AuthProvider, {}, React.createElement(SessionProbe))); });
  await act(async () => pendingMe.reject(new Error('Network failed')));
  assert.equal(savedToken, 'offline-token'); assert.equal(latestAuth.user, undefined); assert.ok(latestAuth.sessionError);
  await act(async () => { void latestAuth.refresh(); });
  await act(async () => pendingMe.resolve(customer));
  assert.equal(latestAuth.user.id, customer.id); assert.equal(latestAuth.sessionError, '');
  await act(async () => authTree.unmount());
  // The actual axios interceptor must preserve cleanup's explicit old-token header.
  let requestInterceptor, logoutRequest;
  stubs.set('axios', { __esModule: true, default: { create: () => ({
    interceptors: { request: { use: callback => { requestInterceptor = callback; } } },
    post: async (...args) => { logoutRequest = args; return { data: { ok: true } }; },
  }) } });
  const actualApi = load('frontend', 'src/lib/api.ts');
  savedToken = 'fresh-token';
  const explicit = { headers: { Authorization: 'Bearer old-token' } };
  assert.equal((await requestInterceptor(explicit)).headers.Authorization, 'Bearer old-token');
  assert.equal((await requestInterceptor({ headers: {} })).headers.Authorization, 'Bearer fresh-token');
  await actualApi.authApi.logout('old-token');
  assert.equal(logoutRequest[0], '/auth/logout'); assert.equal(logoutRequest[2].headers.Authorization, 'Bearer old-token');
  // Actual destination search ignores stale responses and distinguishes outages from zero matches.
  const searchRequests = [];
  stubs.set('expo-location', {});
  stubs.set('@/src/context/AuthContext', { useAuth: () => ({ user: null }) });
  stubs.set('@/src/components/FloatingTabBar', { useHideTabBar() {} });
  stubs.set('@/src/components/VehicleGlyph', { VehicleGlyph: 'VehicleGlyph' });
  stubs.set('@/src/lib/api', { placesApi: { search: query => new Promise((resolve, reject) => searchRequests.push({ query, resolve, reject })) } });
  const { SearchSheet } = load('frontend', 'app/(app)/home.tsx');
  let search;
  const searchProps = { onClose() {}, onSelect() {}, onVoice() {}, featured: [], insets: { top: 0, bottom: 0 } };
  await act(async () => { search = renderer.create(React.createElement(SearchSheet, searchProps)); });
  await act(async () => search.root.findByProps({ testID: 'search-input' }).props.onChangeText('Oslo'));
  await act(async () => advance(350));
  await act(async () => search.root.findByProps({ testID: 'search-input' }).props.onChangeText('Bergen'));
  await act(async () => advance(350));
  assert.deepEqual(searchRequests.map(x => x.query), ['Oslo', 'Bergen']);
  await act(async () => searchRequests[1].resolve({ results: [{ name: 'Bergen fixture', lat: 60.39, lng: 5.32 }] }));
  await act(async () => searchRequests[0].resolve({ results: [{ name: 'Oslo old fixture', lat: 59.91, lng: 10.75 }] }));
  assert.ok(search.root.findAllByType('NativeText').some(node => node.props.children === 'Bergen fixture'));
  assert.equal(search.root.findAllByType('NativeText').some(node => node.props.children === 'Oslo old fixture'), false);
  await act(async () => search.root.findByProps({ testID: 'search-input' }).props.onChangeText('Outage'));
  await act(async () => advance(350));
  await act(async () => searchRequests[2].reject(new Error('Network failed')));
  assert.equal(search.root.findAllByType('NativeText').filter(node => node.props.testID === 'search-network-error').length, 1);
  assert.equal(search.root.findAllByType('NativeText').some(node => node.props.children === 'Fant ingen steder'), false);
  await act(async () => search.root.findByProps({ testID: 'search-retry' }).props.onPress());
  await act(async () => advance(350));
  await act(async () => searchRequests[3].resolve({ results: [] }));
  assert.ok(search.root.findAllByType('NativeText').some(node => node.props.children === 'Fant ingen steder'));
  await act(async () => search.root.findByProps({ testID: 'search-input' }).props.onChangeText('Unmount'));
  await act(async () => search.unmount());
  await act(async () => advance(350));
  assert.equal(searchRequests.length, 4, 'Unmount must cancel an unsent search');
  const { recentDestinations } = load('frontend', 'src/lib/recentPlaces.ts');
  const finished = { trip_id: 'fixture-trip', status: 'completed', dropoff_address: 'Actual destination', dropoff_lat: 59.91, dropoff_lng: 10.75 };
  const recent = recentDestinations([null, finished, { ...finished, trip_id: 'duplicate' }, { ...finished, status: 'cancelled', dropoff_address: 'Not reached' }, { ...finished, dropoff_lat: NaN }, { ...finished, dropoff_address: '' }]);
  assert.equal(recent.length, 1); assert.equal(recent[0].name, 'Actual destination'); assert.equal(recent[0].icon, 'clock');
  assert.equal(timers.size, 0);
  assert.equal(nativeListeners, 0);
  console.log('PASS: Customer search race/offline/retry, actual trip-history recents, session race protection, immediate logout/old-token cleanup, cancellation reconciliation, duplicate guards, safety/network errors, immediate emergency dialer, GPS freshness, minimize/reopen/completion; fonts, nested inheritance, CSS gradient angles, reduced motion/toggles, single delayed trip action, support server replies/ticket IDs, privacy export, permission-gated server-confirmed Driver alerts, month-to-date paid-trip earnings, unmount cancellation, error recovery and address edit identity.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { console.error = originalError; });
