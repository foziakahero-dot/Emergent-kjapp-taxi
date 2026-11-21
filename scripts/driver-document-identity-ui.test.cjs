const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const driverRoot = path.join(__dirname, '../driver-app');
const appRequire = createRequire(path.join(driverRoot, 'package.json'));
const React = appRequire('react');
const renderer = appRequire('react-test-renderer');
const ts = appRequire('typescript');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function renderDriverIdentity(driverApi) {
  const listeners = new Map();
  const opened = [];
  const timers = new Set();
  const components = ['V10Action', 'V10Badge', 'V10Group', 'V10Header', 'V10Row', 'V10Screen', 'V10State'];
  const dependencies = {
    react: React, 'react/jsx-runtime': appRequire('react/jsx-runtime'),
    'react-native': {
      AppState: { currentState: 'active', addEventListener(event, callback) {
        listeners.set(event, callback);
        return { remove: () => listeners.delete(event) };
      } },
      Linking: { openURL: async url => opened.push(url) }, View: 'View', Image: 'Image', Pressable: 'Pressable'
    },
    'expo-camera': { CameraView: 'Camera', useCameraPermissions: () => [{ granted: false, canAskAgain: true }, async () => ({ granted: false })] },
    'expo-status-bar': { StatusBar: 'StatusBar' },
    'expo-router': { useRouter: () => ({}), useFocusEffect: callback => React.useEffect(callback, [callback]) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    'react-native-svg': { default: 'Svg', Ellipse: 'Ellipse' },
    '@/src/theme': { colors: {}, useColorTheme: () => {} },
    '@/src/components/V10UI': { ...Object.fromEntries(components.map(name => [name, name])), v10: {} },
    '@/src/components/V10Icon': { V10Icon: 'Icon' },
    '@/src/components/Typography': { Text: 'Text' },
    '@/src/components/ui': { Loader: 'Loader' },
    '@/src/components/V10Entrance': { V10Entrance: 'Entrance' },
    '@/src/context/AuthContext': { useAuth: () => ({ user: { role: 'driver', approved: false }, refresh: async () => {} }) },
    '@/src/lib/api': { driverApi, apiError: error => error.message }
  };
  const source = readFileSync(path.join(driverRoot, 'app/driver-identity.tsx'), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true
  } });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports, URL,
    require(name) {
      if (!(name in dependencies)) throw new Error('Unexpected screen dependency ' + name);
      return dependencies[name];
    },
    setTimeout(callback) { timers.add(callback); return callback; },
    clearTimeout(callback) { timers.delete(callback); }
  });
  return { Screen: exports.default, listeners, opened, timers };
}

for (const [decision, text] of [
  ['matched', 'Bildesamsvar bekreftet i testmodus.'],
  ['manual_review', 'Bildene trenger manuell vurdering hos SNAR.']
]) {
  test('pending driver receives ' + decision + ' after consent and a provider return', async () => {
    const confirmed = [];
    let proof = null;
    const hosted = 'https://verify.stripe.com/';
    const screen = renderDriverIdentity({
      identityVerification: async () => ({ status: 'not_submitted', document_available: true,
        profile_match_available: true, document_mode: 'test', document_identity: proof }),
      startDocumentIdentity: async consent => {
        confirmed.push(consent);
        proof = { mode: 'test', status: 'requires_input' };
        return { proof, verification_url: hosted };
      }
    });
    let tree;
    try {
      await renderer.act(async () => { tree = renderer.create(React.createElement(screen.Screen)); });
      const byId = id => tree.root.findByProps({ testID: id });
      assert.equal(byId('driver-identity-camera').props.label, 'Bruk manuell ID-kontroll');
      assert.equal(byId('driver-document-id-start').props.label, 'Samtykk og fortsett');
      await renderer.act(async () => byId('driver-document-id-start').props.onPress());
      assert.deepEqual(confirmed, [true]);
      assert.deepEqual(screen.opened, [hosted]);
      proof = { mode: 'test', status: 'processing' };
      await renderer.act(async () => screen.listeners.get('change')('active'));
      assert.match(JSON.stringify(tree.toJSON()), /Stripe behandler dokumentene/);
      proof = { mode: 'test', status: 'verified', profile_match: decision };
      const poll = [...screen.timers][0];
      assert.equal(typeof poll, 'function');
      await renderer.act(async () => poll());
      assert.ok(JSON.stringify(tree.toJSON()).includes(text));
      assert.equal(tree.root.findAllByProps({ testID: 'driver-identity-continue' }).length, 0);
    } finally {
      if (tree) await renderer.act(async () => tree.unmount());
    }
  });
}
