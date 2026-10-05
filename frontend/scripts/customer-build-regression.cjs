const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const Module = require('node:module');
const ts = require(root + '/node_modules/typescript');
const React = require(root + '/node_modules/react');
const renderer = require(root + '/node_modules/react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
for (const extension of ['.ts', '.tsx']) require.extensions[extension] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, file);

const estimates = [];
let activeTrip = null;
let tripFixture = { trip_id: 'unit-trip', status: 'searching', pickup_lat: 59.9, pickup_lng: 10.7, dropoff_lat: 59.95, dropoff_lng: 10.8, geometry: { coordinates: [[10.7, 59.9], [10.8, 59.95]] } };
let stripeConfig = { enabled: true, test_mode: true, publishable_key: 'pk_test_unit' };
let intentCalls = 0;
let paymentResult = {};
let settled = true;
let setupReady = true;
let urlListener;
const urls = [];
const paymentSheetOptions = [];

const api = {
  post: async (route) => {
    assert.equal(route, '/payments/native/setup-intent');
    return { data: { setup_intent_id: 'seti_unit', client_secret: 'seti_secret_unit' } };
  },
  get: async (route) => {
    assert.equal(route, '/payments/native/setup-intent/seti_unit');
    return { data: setupReady ? { ready: true, verified: true } : { ready: false, verified: false } };
  },
  tripsApi: {
    get: async () => tripFixture,
    active: async () => activeTrip,
    list: async () => [],
    estimate: async data => { estimates.push(data); return { geometry: { coordinates: [[10.76, 59.92], [10.80, 59.94]] }, options: [{ vehicle_type: 'ai-first', price: 100 }] }; },
  },
  carsApi: { nearby: async () => ({ cars: [{ id: 'real-car-1', lat: 59.915, lng: 10.755, heading: 90, eta_min: 3 }] }) },
  mePlacesApi: { list: async () => ({ places: [] }) },
  placesApi: { list: async () => ({ places: [] }), reverse: async () => ({ label: 'GPS address' }), search: async () => ({ results: [] }) },
  paymentApi: {
    list: async () => [{ id: 'test-method', is_default: true, verified: true, setup_status: 'succeeded', label: 'Visa', last4: '4242' }],
    nativeConfig: async () => stripeConfig,
    nativeIntent: async () => { intentCalls++; return { payment_intent_id: 'pi_unit', client_secret: 'unit' }; },
    nativeStatus: async () => ({ payment_status: settled ? 'paid' : 'unpaid' }),
  },
};

const stripe = {
  StripeProvider: ({ children, ...props }) => React.createElement('StripeProvider', props, children),
  handleURLCallback: async url => urls.push(url),
  initStripe: async () => {},
  initPaymentSheet: async options => { paymentSheetOptions.push(options); return {}; },
  presentPaymentSheet: async () => paymentResult,
};
const color = new Proxy({}, { get: () => '#000000' });
const navigations = [];
const testRouter = { push(p) { navigations.push(p); }, replace(p) { navigations.push(p); }, back() { navigations.push('back'); } };
const old = Module._load;
Module._load = function (id, parent, isMain) {
  if (id === 'react' || id === 'react/jsx-runtime') return old.call(this, root + '/node_modules/' + id, parent, isMain);
  if (id === '@stripe/stripe-react-native') return stripe;
  if (id === './api' || id === '@/src/lib/api') return api;
  if (id === 'react-native') return {
    Platform: { OS: 'android' }, View: 'View', Text: 'Text', TextInput: 'TextInput', Pressable: 'Pressable', ScrollView: 'ScrollView', ActivityIndicator: 'ActivityIndicator', Modal: 'Modal', Image: 'Image',
    Alert: { alert() {} }, Share: { share: async () => {} }, Easing: { linear: x => x },
    Animated: { View: 'AnimatedView', Value: class { stopAnimation() {} setValue() {} interpolate() { return 0; } }, loop: () => ({ start() {}, stop() {} }), timing: () => ({}) },
    StyleSheet: { create: s => s, absoluteFill: {} }, AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
    Linking: { getInitialURL: async () => 'kjapp://payment-methods?setup=success', addEventListener: (_, cb) => { urlListener = cb; return { remove() { urlListener = null; } }; }, openURL: async () => {}, openSettings: async () => {} },
  };
  if (id === 'expo-router') return { useLocalSearchParams: () => ({ tripId: 'unit-trip' }), useRouter: () => testRouter, useFocusEffect: cb => React.useEffect(cb, [cb]) };
  if (id === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) };
  if (id === 'expo-location') return { requestForegroundPermissionsAsync: async () => ({ status: 'granted' }), getCurrentPositionAsync: async () => ({ coords: { latitude: 59.91, longitude: 10.75 } }), Accuracy: { High: 1 } };
  if (id === '@/src/lib/tripPresence') return old.call(this, root + '/src/lib/tripPresence.ts', parent, isMain);
  if (id === '@/src/theme') return { colors: color, font: {}, makeStyles: factory => () => factory(color) };
  if (id === '@/src/lib/format') return { apiError: e => e?.message || 'unit error', kr: v => String(v), VEHICLES: [{ type: 'ai-first' }] };
  if (id === '@/src/lib/recentPlaces') return { recentDestinations: () => [] };
  if (id === '@/src/components/ActiveTripCard') return { ActiveTripCard: 'ActiveTripCard', LIVE_TRIP_STATUSES: ['searching', 'booking', 'driver_on_way', 'at_pickup', 'in_trip'] };
  if (id.startsWith('@/src/components/')) return new Proxy({}, { get: (_, key) => key === 'useHideTabBar' ? () => {} : key === 'useReducedMotion' ? () => false : String(key) });
  return old.call(this, id, parent, isMain);
};

(async () => {
  const { default: Home, SearchSheet } = require(root + '/app/(app)/home.tsx');
  let app;
  await renderer.act(async () => { app = renderer.create(React.createElement(Home)); });
  const find = id => app.root.find(n => n.props.testID === id && typeof n.type === 'string');
  const map = () => find('home-map');
  assert.equal(map().props.cars.length, 1, 'real nearby car must be visible on idle map');
  await renderer.act(async () => find('home-where-to').props.onPress());
  assert.equal(app.root.findAllByType(SearchSheet).length, 1);
  await renderer.act(async () => find('search-pickup').props.onPress());
  assert.equal(find('search-input').props.placeholder, 'Hvor skal du hentes?');
  await renderer.act(async () => app.root.findByType(SearchSheet).props.onSelect({ name: 'Chosen pickup', lat: 59.92, lng: 10.76 }));
  await renderer.act(async () => find('home-search-expand').props.onPress());
  await renderer.act(async () => find('home-where-to').props.onPress());
  await renderer.act(async () => app.root.findByType(SearchSheet).props.onSelect({ name: 'Chosen destination', lat: 59.94, lng: 10.80 }));
  assert.equal(estimates.at(-1).pickup_lat, 59.92);
  assert.equal(estimates.at(-1).dropoff_lat, 59.94);
  assert.equal(map().props.cars.length, 1, 'selecting destination must not hide real nearby cars');
  find('booking-review');
  await renderer.act(async () => app.unmount());
  console.log('PASS: real nearby cars survive destination selection; verified card enables booking review');

  const BookingFlow = require(root + '/app/booking/[tripId].tsx').default;
  await renderer.act(async () => { app = renderer.create(React.createElement(BookingFlow)); });
  const bookingMap = find('booking-map');
  assert.equal(bookingMap.props.dropoff, null, 'destination must stay hidden before ride starts');
  assert.equal(bookingMap.props.route, null, 'destination route must stay hidden before ride starts');
  await renderer.act(async () => find('active-trip-minimize').props.onPress());
  assert.equal(navigations.at(-1), '/(app)/home');
  await renderer.act(async () => app.unmount());
  console.log('PASS: active trip minimize returns directly home; pre-start booking map does not expose destination route');

  const { payNative, setupNativeCard } = require(root + '/src/lib/nativePayment.native.ts');
  stripeConfig.test_mode = false;
  await assert.rejects(payNative('unit'), /bare testbetaling/);
  assert.equal(intentCalls, 0);
  stripeConfig.test_mode = true;
  stripeConfig.enabled = false;
  await assert.rejects(payNative('unit'), /Testbetaling/);
  assert.equal(intentCalls, 0);
  stripeConfig.enabled = true;
  paymentResult = { error: { code: 'Canceled' } };
  assert.equal(await payNative('unit'), false);
  paymentResult = {};
  settled = false;
  assert.equal(await payNative('unit'), false);
  settled = true;
  assert.equal(await payNative('unit'), true);
  assert.equal(paymentSheetOptions.at(-1).returnURL, 'kjapp://receipt/unit');

  paymentResult = {};
  setupReady = true;
  assert.equal(await setupNativeCard(), true);
  assert.equal(paymentSheetOptions.at(-1).setupIntentClientSecret, 'seti_secret_unit');
  assert.equal(paymentSheetOptions.at(-1).returnURL, 'kjapp://payment-methods?setup=success');
  paymentResult = { error: { code: 'Canceled' } };
  assert.equal(await setupNativeCard(), false);
  paymentResult = {};
  setupReady = false;
  await assert.rejects(setupNativeCard(), /ikke bekreftet/);
  console.log('PASS: Stripe test mode fails closed; native card SetupIntent returns to app and requires server verification');

  const paymentScreenSource = fs.readFileSync(root + '/app/payment-methods.tsx', 'utf8');
  assert.match(paymentScreenSource, /Platform\.OS\s*!==\s*['"]web['"]/);
  assert.match(paymentScreenSource, /setupNativeCard\(\)/);
  assert.doesNotMatch(paymentScreenSource, /expo-web-browser/);
  const homeSource = fs.readFileSync(root + '/app/(app)/home.tsx', 'utf8');
  assert.doesNotMatch(homeSource, /cars=\{activeTrip\s*\|\|\s*dropoff\s*\?\s*\[\]\s*:\s*cars\}/);
  assert.match(homeSource, /verified\s*===\s*true\s*&&\s*m\?\.setup_status\s*===\s*['"]succeeded['"]/);
  const workflowSource = fs.readFileSync(path.resolve(root, '../.github/workflows/customer-apk.yml'), 'utf8');
  assert.match(workflowSource, /workflow_dispatch:/);
  assert.doesNotMatch(workflowSource, /^\s*push:/m);
  console.log('PASS: source guards block browser card regression, unverified booking, hidden cars and automatic APK-on-push');

  const { NativePaymentProvider } = require(root + '/src/components/NativePaymentProvider.native.tsx');
  let provider;
  await renderer.act(async () => { provider = renderer.create(React.createElement(NativePaymentProvider, null, React.createElement('Child'))); });
  assert.equal(provider.root.findByType('StripeProvider').props.publishableKey, 'pk_test_unit');
  await renderer.act(async () => urlListener({ url: 'kjapp://payment-methods?setup=success' }));
  assert.equal(urls.length, 2);
  await renderer.act(async () => provider.unmount());
  assert.equal(urlListener, null);
  console.log('PASS: StripeProvider initializes with test key; initial/foreground app callbacks are handled and cleaned up');
})().catch(e => { console.error(e); process.exitCode = 1; });
