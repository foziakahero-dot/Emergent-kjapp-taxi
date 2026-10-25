// Behavioral checks of actual components with native adapters; no live accounts/API writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const React = require(root + '/node_modules/react');
const renderer = require(root + '/node_modules/react-test-renderer');
const ts = require(root + '/node_modules/typescript');
const { act } = renderer;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const previousError = console.error;
console.error = (...args) => { if (!String(args[0]).includes('react-test-renderer is deprecated')) previousError(...args); };
let dismissed = 0;
class Value { setValue() {} interpolate() { return 0; } }
const native = {
  View: 'View', Text: 'Text', TextInput: 'TextInput', Pressable: 'Pressable', ScrollView: 'ScrollView', ActivityIndicator: 'ActivityIndicator',
  useWindowDimensions: () => ({ width: 390, height: 844 }), Keyboard: { dismiss: () => dismissed++ },
  PanResponder: { create: config => ({ panHandlers: config }) }, Platform: { OS: 'android' },
  StyleSheet: { create: value => value, absoluteFill: {}, hairlineWidth: 1 },
  Animated: { Value, View: 'AnimatedView', timing: () => ({ start() {}, stop() {} }) }, Easing: { bezier() {} },
};
const identity = { get: () => async () => ({}) };
const stubs = {
  react: React, 'react/jsx-runtime': require(root + '/node_modules/react/jsx-runtime'), 'react-native': native,
  'expo-image': { Image: 'BundledImage' }, 'expo-blur': { BlurTargetView: 'BlurTargetView' }, 'expo-haptics': {}, 'expo-location': {},
  'expo-router': { useRouter: () => ({}), useLocalSearchParams: () => ({}), useFocusEffect() {} },
  'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 48, bottom: 24 }) },
  '@/src/theme': { colors: { text: '#0b1a2c', textSecondary: '#586779', textMuted: '#7e8792', surface: '#fff', line: '#ddd', online: '#087e47', accent: '#f00' },
    font: {}, useColorTheme: () => ({}), themedStyles: factory => factory() },
  '@/src/components/Typography': { Text: 'Text', TextInput: 'TextInput' }, './Typography': { Text: 'Text', TextInput: 'TextInput' },
  '@/src/components/V10Icon': { V10Icon: 'Icon' },
  '@/src/components/V10Entrance': { V10Entrance: 'Entrance' }, './V10Entrance': { V10Entrance: 'Entrance' },
  './V10Glass': { V10Glass: 'Glass' }, './V10CustomerAvatar': { V10CustomerAvatar: 'Avatar' },
  '@/src/components/V10UI': { v10: {}, V10Action: props => React.createElement('Pressable', { ...props, testID: props.testID }, props.label) },
  '@/src/components/BookingPrimitives': { CustomerJourney: 'Journey', confirmedPaymentMethod: () => null, finiteMetric: value => String(value || '—'), paymentLabel: () => 'Kort' },
  '@/src/components/Motion': { useReducedMotion: () => true }, './V10VehicleMarker': { V10VehicleMarker: 'MapCar' },
  '@/src/components/useRouteReveal': { useRouteReveal: value => value },
  '@/src/lib/format': { kr: value => value == null ? '—' : `${value} kr`, apiError: error => error.message },
  '@/src/lib/api': { placesApi: { search: async () => ({ results: [{ name: 'Oslo S', lat: 59.91, lng: 10.75 }] }) },
    tripsApi: new Proxy({}, identity), paymentApi: new Proxy({}, identity), mePlacesApi: new Proxy({}, identity), promoApi: new Proxy({}, identity) },
  '@/src/context/AuthContext': { useAuth: () => ({}) }, '@/src/lib/useAvailableCars': { useAvailableCars() {} },
  '@/src/components/FloatingTabBar': { useHideTabBar() {} },
  '@/src/components/ActiveTripCard': { ActiveTripCard: 'ActiveTripCard', LIVE_TRIP_STATUSES: [] },
  '@/src/components/Map': { Map: 'Map' },
};
const cache = new Map();
function load(file) {
  let resolved = path.resolve(root, file);
  if (!path.extname(resolved)) resolved += fs.existsSync(resolved + '.tsx') ? '.tsx' : '.ts';
  if (cache.has(resolved)) return cache.get(resolved);
  if (resolved.endsWith('.png')) { assert(fs.existsSync(resolved)); return { uri: resolved }; }
  const mod = { exports: {} };
  const compiled = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const localRequire = name => {
    if (stubs[name]) return stubs[name];
    if (name.startsWith('@/')) return load(name.slice(2));
    if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(resolved), name)));
    throw Error('Unmocked dependency: ' + name);
  };
  vm.runInNewContext(compiled, { require: localRequire, module: mod, exports: mod.exports, console, process: { env: {} }, Date, Set, Math, setTimeout, clearTimeout }, { filename: resolved });
  cache.set(resolved, mod.exports); return mod.exports;
}
const control = (tree, id) => tree.root.findAll(node => node.type === 'Pressable' && node.props.testID === id)[0];
const contents = tree => JSON.stringify(tree.toJSON());
async function mount(Component, props) { let tree; await act(async () => { tree = renderer.create(React.createElement(Component, props)); }); return tree; }
async function close(tree) { await act(async () => tree.unmount()); }

(async () => {
  const { nearbyDrivers, distanceKm } = load('src/lib/nearbyDrivers');
  const pickup = { lat: 59.9139, lng: 10.7522 }, now = Date.parse('2026-10-25T17:00:00Z');
  const fresh = { id: 'online', ...pickup, updated_at: new Date(now - 3000).toISOString() };
  const result = { server_time: new Date(now).toISOString(), gps_fresh_seconds: 60, cars: [fresh,
    { ...fresh }, { ...fresh, id: 'offline', online: false }, { ...fresh, id: 'busy', available: false },
    { ...fresh, id: 'stale', updated_at: new Date(now - 61000).toISOString() },
    { ...fresh, id: 'missing', updated_at: null }, { ...fresh, id: 'bad', lat: NaN },
    { ...fresh, id: 'distant', lat: pickup.lat + .06 }, { ...fresh, id: 'future', updated_at: new Date(now + 10000).toISOString() }] };
  assert(distanceKm(pickup, result.cars[7]) > 5);
  assert.equal(nearbyDrivers(result, pickup, now + 600000).map(car => car.id).join(','), 'online', 'Use the server clock and exclude stale, offline, duplicate, distant and invalid supply');
  assert.equal(nearbyDrivers({ cars: [] }, pickup).length, 0);
  assert.equal(nearbyDrivers({ ...result, cars: [{ ...fresh, type: 'ai-first' }, { ...fresh, id: 'enkelt-driver', type: 'enkelt' }] }, pickup, now, 'enkelt').map(car => car.id).join(','), 'enkelt-driver', 'All-class supply must never leak a different class into booked Enkelt search');
  console.log('PASS fresh GPS, five-kilometre radius, clock skew, duplicates, offline/busy and invalid data');

  const { DriverAvailabilityBadge } = load('src/components/DriverAvailabilityBadge');
  for (const [ready, cars, issue, expected] of [[true, [fresh], null, true], [true, [fresh], 'offline', false], [true, [], 'empty', false], [false, [fresh], null, false]]) {
    const tree = await mount(DriverAvailabilityBadge, { ready, search: { cars, issue, phase: 'available' } });
    assert.equal(contents(tree).includes('· Live'), expected); await close(tree);
  }
  const { PositionDot, AvailableDriverMarker } = load('src/components/MapMarkers');
  let tree = await mount(PositionDot); assert(!/LEDIG|Live|AnimatedView/.test(contents(tree))); await close(tree);
  tree = await mount(AvailableDriverMarker, { eta: 2.2 }); assert.match(contents(tree), /LEDIG|Ledig sjåfør/); assert.match(contents(tree), /3 min/); await close(tree);
  console.log('PASS live status belongs to available drivers; customer location has no live badge');

  const { CollapsibleMapPanel } = load('src/components/CollapsibleMapPanel');
  let measured;
  tree = await mount(CollapsibleMapPanel, { id: 'test-panel', title: 'Søk', summary: 'Oslo S', heightFraction: .3, bottomOffset: 82,
    onHeight: height => measured = height, children: React.createElement('Content') });
  assert.equal(tree.root.findAll(node => node.type === 'View' && node.props.testID === 'test-panel')[0].props.style.maxHeight, 253);
  await act(async () => control(tree, 'test-panel-toggle').props.onPress());
  assert.equal(control(tree, 'test-panel-toggle').props.accessibilityState.expanded, false);
  assert.equal(tree.root.findAllByType('Content').length, 0);
  assert.equal(dismissed, 1);
  const handle = () => tree.root.findAll(node => node.type === 'View' && node.props.testID === 'test-panel-handle')[0];
  await act(async () => handle().props.onPanResponderRelease(null, { dy: -40, dx: 0 }));
  assert.equal(control(tree, 'test-panel-toggle').props.accessibilityState.expanded, true);
  await act(async () => handle().props.onPanResponderRelease(null, { dy: 40, dx: 0 }));
  assert.equal(control(tree, 'test-panel-toggle').props.accessibilityState.expanded, false);
  tree.root.findAll(node => node.type === 'View' && node.props.testID === 'test-panel')[0].props.onLayout({ nativeEvent: { layout: { height: 72 } } });
  assert.equal(measured, 154); await close(tree);
  console.log('PASS tap and vertical-drag collapse/expand, accessibility, keyboard dismiss, measured map inset and 30% search limit');

  const { CustomerBookingView } = load('src/components/CustomerBookingView');
  const quote = { duration_min: 10, distance_km: 3, options: ['ai-first', 'enkelt', 'trygg', 'premium'].map((vehicle_type, i) => ({ vehicle_type, price: 150 + i * 50 })) };
  const props = { stage: 'vehicles', reviewing: false, pickup: 'Hentested', destination: { name: 'Oslo S' }, estimate: quote,
    vehicle: 'ai-first', price: 150, nearest: 3, vehicleEtas: {}, places: [], stops: [], methods: [],
    firstName: 'Test', initials: 'T', locationReady: true, onHeight() {}, onReview() {}, onStage() {}, onVehicle() {}, onSearch() {}, onLocate() {},
    onPlace() {}, onVoice() {}, onProfile() {}, onPlaces() {}, onRetryPlaces() {}, onPayment() {}, onConsent() {}, onBook() {}, onBack() {} };
  function BookingHarness(p) { const [vehicle, onVehicle] = React.useState('ai-first'); return React.createElement(CustomerBookingView, { ...props, ...p, vehicle, onVehicle }); }
  for (const state of [{ destination: null }, { stage: 'route' }, { stage: 'vehicles' }, { stage: 'payment' }, { reviewing: true }]) {
    tree = await mount(BookingHarness, state);
    const id = !state.destination && state.destination === null ? 'home-browse-sheet' : state.reviewing ? 'booking-review-screen' : 'home-ride-sheet';
    if (state.stage === 'vehicles') {
      const images = tree.root.findAllByType('BundledImage'); assert.equal(images.length, 4);
      assert(images.every(image => !/^https?:/.test(image.props.source.uri)));
      assert.equal(control(tree, 'vehicle-enkelt').props.disabled, false);
      await act(async () => control(tree, 'vehicle-enkelt').props.onPress());
      assert.equal(control(tree, 'vehicle-enkelt').props.accessibilityState.checked, true);
    }
    await act(async () => control(tree, id + '-toggle').props.onPress());
    await act(async () => control(tree, id + '-toggle').props.onPress());
    if (state.stage === 'vehicles') assert.equal(control(tree, 'vehicle-enkelt').props.accessibilityState.checked, true, 'Selection survives minimize/restore');
    await close(tree);
  }
  tree = await mount(BookingHarness, { estimate: { options: [] } });
  assert.equal(control(tree, 'vehicle-enkelt').props.disabled, true); await close(tree);
  console.log('PASS all five booking panels minimize/restore; four local 3D assets, canonical quotes, selected class survives and missing fares disable booking');

  const { SearchSheet } = load('app/(app)/home');
  tree = await mount(SearchSheet, { insets: { top: 48, bottom: 24 }, featured: [], quickPlaces: [], onClose() {}, onVoice() {}, onSelect() {}, onPickup() {}, onDestination() {} });
  const input = () => tree.root.findAll(node => node.type === 'TextInput' && node.props.testID === 'search-input')[0];
  await act(async () => input().props.onChangeText('Oslo S'));
  await act(async () => control(tree, 'search-sheet-toggle').props.onPress());
  await act(async () => control(tree, 'search-sheet-toggle').props.onPress());
  assert.equal(input().props.value, 'Oslo S'); await close(tree);
  console.log('PASS actual search panel preserves the typed address when minimized and reopened');
})().catch(error => { console.error(error); process.exitCode = 1; });
