const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const req = createRequire(path.join(root, 'frontend/package.json'));
const React = req('react'), renderer = req('react-test-renderer'), ts = req('typescript');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const host = name => ({ children, ...props }) => React.createElement(name, props, children);
const noop = () => {};
const colors = new Proxy({}, { get: () => '#123456' });
let signupEnabled = true, starts = [], verifications = [], routes = [];
const stubs = {
  react: React, 'react/jsx-runtime': req('react/jsx-runtime'),
  'react-native': { View: host('View'), ScrollView: host('ScrollView'), Pressable: host('Pressable'),
    KeyboardAvoidingView: host('KeyboardAvoidingView'), StyleSheet: { create: x => x },
    Platform: { OS: 'android' }, Linking: { openURL: async () => {} } },
  'expo-router': { useRouter: () => ({ replace: route => routes.push(route), push: noop }) },
  'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 0 }) },
  '@/src/theme': { colors, font: {}, useColorTheme: () => ({ effective: 'light' }) },
  '@/src/components/Typography': { Text: host('Text'), TextInput: host('TextInput') },
  './Typography': { Text: host('Text'), TextInput: host('TextInput') },
  '@/src/components/V10UI': { V10Action: host('Action'), V10Header: host('Header'), v10: {} },
  '@/src/components/Icon': { Icon: host('Icon') },
  '@/src/components/AppleSignInButton': { AppleSignInButton: host('AppleSignInButton') },
  '@/src/components/SnarWordmark': { SnarWordmark: host('Wordmark') },
  '@/src/components/V10Entrance': { V10Entrance: host('Entrance') },
  '@/src/lib/format': { apiError: e => e.message },
  '@/src/context/AuthContext': { useAuth: () => ({ login: noop, logout: noop, signInWithGoogle: noop, signInWithApple: noop,
    loginWithOtp: async (...args) => { verifications.push(args); return { id: 'new-customer', role: 'user', legal_accepted: true }; } }) },
  '@/src/lib/api': { authApi: {
    otpConfig: async () => ({ enabled: true, signup_enabled: signupEnabled, legal_version: '2026-09' }),
    nativeConfig: async () => ({}),
    otpStart: async (...args) => { starts.push(args); return { challenge_id: 'isolated-challenge' }; },
  } },
};
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => {
    if (name === '@/src/components/PhoneSignupFields') return load('frontend/src/components/PhoneSignupFields.tsx');
    if (stubs[name]) return stubs[name];
    throw new Error(`Unstubbed ${name}`);
  }, console, Date, setInterval, clearInterval });
  cache.set(file, module.exports); return module.exports;
}
const Login = load('frontend/app/login.tsx').default;
const byId = (tree, id) => tree.root.findAll(n => typeof n.type === 'string' && n.props.testID === id)[0];
const change = (tree, id, value) => renderer.act(async () => byId(tree, id).props.onChangeText(value));

test('new phone registration requires details, explicit consent and a verified code', async () => {
  starts = []; verifications = []; routes = []; signupEnabled = true;
  let tree;
  await renderer.act(async () => { tree = renderer.create(React.createElement(Login)); });
  await change(tree, 'login-phone', '92234567');
  await renderer.act(async () => byId(tree, 'login-phone-signup-toggle').props.onPress());
  assert.equal(byId(tree, 'login-phone-submit').props.disabled, true);
  await change(tree, 'phone-signup-name', 'Ny Kunde');
  await change(tree, 'phone-signup-email', 'new@example.test');
  await renderer.act(async () => byId(tree, 'login-phone').props.onSubmitEditing());
  assert.equal(starts.length, 0, 'Keyboard submit cannot bypass consent');
  await renderer.act(async () => byId(tree, 'phone-signup-consent').props.onPress());
  assert.equal(byId(tree, 'login-phone-submit').props.disabled, false);
  await renderer.act(async () => byId(tree, 'login-phone-submit').props.onPress());
  assert.deepEqual(starts[0][0], '92234567');
  assert.deepEqual(JSON.parse(JSON.stringify(starts[0][1])), {
    fullName: 'Ny Kunde', email: 'new@example.test', accepted_terms: true, legal_version: '2026-09',
  });
  assert.equal(routes.length, 0, 'Requesting SMS must not enter the app');
  await change(tree, 'login-otp', '123456');
  await renderer.act(async () => byId(tree, 'login-phone-submit').props.onPress());
  assert.deepEqual(verifications[0], ['92234567', '123456', 'isolated-challenge']);
  assert.deepEqual(routes, ['/(app)/home']);
  await renderer.act(async () => tree.unmount());
});

test('server can disable signup while keeping legacy customer phone login', async () => {
  starts = []; signupEnabled = false;
  let tree;
  await renderer.act(async () => { tree = renderer.create(React.createElement(Login)); });
  assert.equal(byId(tree, 'login-phone-signup-toggle'), undefined);
  await change(tree, 'login-phone', '91234567');
  await renderer.act(async () => byId(tree, 'login-phone-submit').props.onPress());
  assert.equal(starts[0][0], '91234567'); assert.equal(starts[0][1], undefined);
  await renderer.act(async () => tree.unmount());
});
