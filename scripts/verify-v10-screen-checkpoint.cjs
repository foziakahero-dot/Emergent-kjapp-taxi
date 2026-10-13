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
const originalError = console.error;
console.error = (...args) => { if (!String(args[0]).includes('react-test-renderer is deprecated')) originalError(...args); };
let user = null, navigation = [], permissionCalls = 0, permissionResult;
let loginResult, loginCalls = 0, logoutCalls = 0, vehicleResult, vehicleCalls = 0, currentTripId = 'trip-paid';
let queryData = {}, updates = [], storageWrites = [], sent = [], invalidated = [], updateResult, sendResult;
const router = Object.fromEntries(['push', 'replace', 'navigate', 'back'].map(method => [method, target => navigation.push([method, target])]));
const native = {
  View: 'View', Text: 'Text', TextInput: 'TextInput', Image: 'Image', KeyboardAvoidingView: 'KeyboardAvoidingView', ScrollView: 'ScrollView', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator',
  FlatList: ({ data, renderItem, ListEmptyComponent }) => React.createElement('FlatList', null, data.length ? data.map((item, index) => React.createElement(React.Fragment, { key: index }, renderItem({ item, index }))) : ListEmptyComponent),
  AppState: { addEventListener: () => ({ remove() {} }) }, Platform: { OS: 'ios' }, Linking: { openURL: async () => {} },
  StyleSheet: { create: value => value, hairlineWidth: 1, absoluteFill: { position: 'absolute', inset: 0 } },
};
const queryClient = { setQueryData: (key, data) => { const value = typeof data === 'function' ? data(queryData[key[0]]?.data) : data; updates.push([key, value]); queryData[key[0]] = { ...queryData[key[0]], data: value }; }, invalidateQueries: async x => invalidated.push(x.queryKey) };
const stubs = {
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
  '@/src/theme': { colors: {}, font: {} },
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
  vm.runInNewContext(compiled, { require: localRequire, module, exports: module.exports, console, Set }, { filename: absolute });
  cache.set(absolute, module.exports);
  return module.exports;
}
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const text = tree => JSON.stringify(tree.toJSON());
const button = (tree, id) => tree.root.findAll(node => node.type === 'Pressable' && node.props.testID === id)[0];
async function mount(Component) { let tree; await act(async () => { tree = renderer.create(React.createElement(Component)); }); return tree; }
async function unmount(tree) { await act(async () => tree.unmount()); }
(async () => {
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
  tree = await mount(Messages);
  assert.match(text(tree), /Test incoming message/);
  const quickButtons = () => tree.root.findAll(node => node.type === 'Pressable' && node.props.accessibilityState && 'disabled' in node.props.accessibilityState);
  await act(async () => { quickButtons()[0].props.onPress(); quickButtons()[1].props.onPress(); });
  assert.equal(sent.length, 1, 'Only one quick reply may be in flight');
  assert.deepEqual(sent[0], ['active', 'Jeg er fremme']);
  await act(async () => sending.resolve({ ok: true }));
  assert.equal(invalidated.at(-1)[1], 'active');
  sendResult = async () => { throw new Error('network'); };
  await act(async () => quickButtons()[0].props.onPress());
  assert.match(text(tree), /ikke bekreftet sendt/);
  await unmount(tree);
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
    [{ role: 'driver', approved: true, legal_accepted: true, identity_verification_status: 'pending_review' }, '/driver-identity', false],
    [{ role: 'driver', approved: true, legal_accepted: true, identity_verification_status: 'verified', identity_recheck_required: true }, '/driver-identity', false],
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
  const bubbles = tree.root.findAll(node => node.type === 'View' && node.props.style?.maxWidth === '78%');
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
  queryData = { trips: { data: { trips: [{ trip_id: 'finished', status: 'completed', payment_status: 'paid', created_at: new Date().toISOString(), dropoff_address: 'Destination', price: 184 }, { trip_id: 'cancelled', status: 'cancelled', created_at: new Date().toISOString(), price: 999 }] } }, 'customer-active-trip': { data: { trip_id: 'live-trip', status: 'in_trip', dropoff_address: 'Live destination' } } };
  tree = await mount(CustomerHistory);
  assert.doesNotMatch(text(tree), /999 kr/);
  await act(async () => button(tree, 'trip-finished').props.onPress()); assert.equal(navigation.at(-1)[1], '/customer-trip/finished');
  await act(async () => button(tree, 'history-active-trip').props.onPress()); assert.equal(navigation.at(-1)[1], '/booking/live-trip'); await unmount(tree);
  const CustomerTrip = load('frontend', 'app/customer-trip/[tripId].tsx').default;
  queryData = { 'customer-trip-detail': { data: { trip_id: 'customer-detail', status: 'completed', payment_status: 'paid', price: 184, created_at: new Date().toISOString(), driver: { name: 'Test Driver' } } } };
  tree = await mount(CustomerTrip); assert.match(text(tree), /Kartdata er ikke tilgjengelig/);
  await act(async () => button(tree, 'customer-trip-receipt').props.onPress()); assert.equal(navigation.at(-1)[1], '/receipt/customer-detail'); await unmount(tree);
  queryData['customer-trip-detail'].data.status = 'in_trip';
  queryData['customer-trip-detail'].data.payment_status = 'reserved';
  tree = await mount(CustomerTrip);
  await act(async () => button(tree, 'customer-trip-receipt').props.onPress()); assert.equal(navigation.at(-1)[1], '/booking/customer-detail');
  assert.doesNotMatch(text(tree), /Betalt/); await unmount(tree);
  console.log('PASS: Customer compact profile routes/saved data, active-trip-only chat, correct passenger bubbles, duplicate sends, failure preserves draft, status errors hide stale conversation, active/history/detail/receipt routing and absent-map handling.');
  console.log('PASS: Driver overview/detail income comes from authoritative summaries, excludes unconfirmed trip income, hides errored totals, does not invent payout dates and does not turn missing weekly data into zero.');
  console.log('PASS: Driver assigned/busy/parked vehicle selection, server confirmation, duplicate taps, paid-only trip income, Oslo date grouping, history/detail routing and privacy-limited trip detail.');
  console.log('PASS: Driver login empty/offline/duplicate attempts, role/approval/2FA/legal/selfie gates; compact profile routes and truthful verification/rating counts.');
  console.log('PASS: manual location, permission grant/denial/error, legal/session routing, duplicate permission taps, confirmed navigation save, rejected navigation response, concurrent navigation taps, closed-trip messaging, active-trip messages, duplicate quick replies and send failure.');
})().catch(error => { console.error(error); process.exitCode = 1; });
