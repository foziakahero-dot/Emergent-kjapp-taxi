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
let loginResult, loginCalls = 0, logoutCalls = 0;
let queryData = {}, updates = [], storageWrites = [], sent = [], invalidated = [], updateResult, sendResult;
const router = Object.fromEntries(['push', 'replace', 'navigate', 'back'].map(method => [method, target => navigation.push([method, target])]));
const native = {
  View: 'View', Text: 'Text', TextInput: 'TextInput', Image: 'Image', KeyboardAvoidingView: 'KeyboardAvoidingView', ScrollView: 'ScrollView', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator',
  FlatList: ({ data, renderItem, ListEmptyComponent }) => React.createElement('FlatList', null, data.length ? data.map((item, index) => React.createElement(React.Fragment, { key: index }, renderItem({ item, index }))) : ListEmptyComponent),
  Platform: { OS: 'ios' }, Linking: { openURL: async () => {} },
  StyleSheet: { create: value => value, hairlineWidth: 1, absoluteFill: { position: 'absolute', inset: 0 } },
};
const queryClient = { setQueryData: (key, data) => updates.push([key, data]), invalidateQueries: async x => invalidated.push(x.queryKey) };
const stubs = {
  'react': React, 'react/jsx-runtime': appRequire('react/jsx-runtime'), 'react-native': native,
  'expo-router': { useRouter: () => router, useFocusEffect: callback => React.useEffect(callback, [callback]) },
  'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 48, bottom: 34 }) },
  'expo-location': { requestForegroundPermissionsAsync: () => { permissionCalls++; return permissionResult(); } },
  '@/src/context/AuthContext': { useAuth: () => ({ user, login: async (...args) => { loginCalls++; return loginResult(...args); }, logout: async () => { logoutCalls++; } }) },
  '@/src/components/Typography': { Text: 'Text', TextInput: 'TextInput' },
  '@/src/components/Map': { Map: 'Map' },
  '@/src/components/V10Icon': { V10Icon: 'Icon' },
  '@/src/components/Icon': { Icon: 'Icon' },
  '@/src/components/ui': { Loader: 'Loader' },
  '@/src/theme': { colors: {}, font: {} },
  '@/src/lib/format': { apiError: error => error.message },
  '@/src/utils/storage': { storage: { setItem: async (...args) => storageWrites.push(args) } },
  '@tanstack/react-query': {
    useQueryClient: () => queryClient,
    useQuery: ({ queryKey }) => ({ isPending: false, isError: false, refetch: async () => {}, ...queryData[queryKey[0]] }),
  },
  '@/src/lib/api': {
    authApi: { me: async () => ({}) }, authenticatedFileSource: async () => null,
    driverApi: { ratings: async () => ({}), current: async () => ({}), identityVerification: async () => ({}) },
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
  console.log('PASS: Driver login empty/offline/duplicate attempts, role/approval/2FA/legal/selfie gates; compact profile routes and truthful verification/rating counts.');
  console.log('PASS: manual location, permission grant/denial/error, legal/session routing, duplicate permission taps, confirmed navigation save, rejected navigation response, concurrent navigation taps, closed-trip messaging, active-trip messages, duplicate quick replies and send failure.');
})().catch(error => { console.error(error); process.exitCode = 1; });
