const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..'), React = require(root + '/node_modules/react'), renderer = require(root + '/node_modules/react-test-renderer'), ts = require(root + '/node_modules/typescript');
const { act } = renderer; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const original = console.error; console.error = (...args) => { if (!String(args[0]).includes('react-test-renderer is deprecated')) original(...args); };
let kind = 'car', permitted = true, canceled = false, save, carCalls = 0, profileCalls = 0, back = 0;
const stubs = {
  react: React, 'react/jsx-runtime': require(root + '/node_modules/react/jsx-runtime'),
  'react-native': { View: 'View', Image: 'Image', Pressable: 'Pressable', ScrollView: 'ScrollView' },
  '@/src/components/Typography': { Text: 'Text' },
  'expo-camera': { CameraView: 'CameraView', useCameraPermissions: () => [{ granted: true }, async () => ({ granted: true })] },
  'expo-image-picker': { requestMediaLibraryPermissionsAsync: async () => ({ granted: permitted }), launchImageLibraryAsync: async () => ({ canceled, assets: canceled ? [] : [{ uri: 'file:///synthetic-car.jpg' }] }) },
  'expo-router': { useRouter: () => ({ back: () => back++ }), useLocalSearchParams: () => ({ kind }) },
  'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
  '@tanstack/react-query': { useQueryClient: () => ({ invalidateQueries: async () => {} }) },
  '@/src/theme': { colors: {}, font: {}, useColorTheme() {}, makeStyles: () => () => ({}) },
  '@/src/components/Icon': { Icon: 'Icon' }, '@/src/components/ui': { Button: 'Button' },
  '@/src/lib/api': { apiError: e => e.message, driverApi: { updateCarIcon: async uri => { assert.match(uri, /synthetic-car/); carCalls++; return save(); }, updateProfilePhoto: async () => { profileCalls++; return save(); } } },
  '@/src/context/AuthContext': { useAuth: () => ({ refresh: async () => {} }) },
};
const mod = { exports: {} }, code = ts.transpileModule(fs.readFileSync(path.join(root, '../driver-app/app/driver-profile-photo.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
vm.runInNewContext('(function(require,module,exports){' + code + '\n})', {})(name => stubs[name], mod, mod.exports);
const Page = mod.exports.default;
const button = (tree, re) => tree.root.findAll(node => node.type === 'Button' && re.test(node.props.label))[0];
(async () => {
  let tree; await act(async () => { tree = renderer.create(React.createElement(Page)); });
  await act(async () => button(tree, /Velg fra bilder/).props.onPress());
  let resolve; save = () => new Promise(r => resolve = r);
  await act(async () => { const action = button(tree, /Bruk dette bilikonet/).props.onPress; action(); action(); });
  assert.equal(carCalls, 1); assert.equal(profileCalls, 0); assert.equal(back, 0);
  await act(async () => resolve()); assert.equal(back, 1); await act(async () => tree.unmount());
  kind = undefined; save = async () => { throw Error('Upload rejected'); };
  await act(async () => { tree = renderer.create(React.createElement(Page)); });
  await act(async () => button(tree, /Velg fra bilder/).props.onPress());
  await act(async () => button(tree, /Bruk dette profilbildet/).props.onPress());
  assert.equal(profileCalls, 1); assert.ok(button(tree, /Bruk dette profilbildet/)); assert.match(JSON.stringify(tree.toJSON()), /Upload rejected/);
  await act(async () => tree.unmount()); permitted = false;
  await act(async () => { tree = renderer.create(React.createElement(Page)); });
  await act(async () => button(tree, /Velg fra bilder/).props.onPress()); assert.match(JSON.stringify(tree.toJSON()), /Gi tilgang/);
  await act(async () => tree.unmount());
  console.log('PASS: actual Driver gallery/car-icon/profile flows, serialized save, failure preserves image and permission denial');
})().catch(e => { console.error(e); process.exitCode = 1; });
