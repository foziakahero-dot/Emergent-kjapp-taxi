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
let posted = [], deleted = 0, initial = { status: 'not_submitted', eligible: false };
const stubs = {
  react: React, 'react/jsx-runtime': req('react/jsx-runtime'),
  'react-native': { ActivityIndicator: host('ActivityIndicator'), Pressable: host('Pressable'), ScrollView: host('ScrollView'), View: host('View'), Platform: { OS: 'android' } },
  'expo-router': { useRouter: () => ({ back() {} }) },
  'expo-image-picker': { launchImageLibraryAsync: async () => ({ canceled: false, assets: [{ uri: 'file://fixture.jpg', fileName: 'fixture.jpg', mimeType: 'image/jpeg', fileSize: 100 }] }) },
  'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
  '@/src/components/Typography': { Text: host('Text'), TextInput: host('TextInput') },
  '@/src/theme': { colors: {}, useColorTheme() {} },
  '@/src/lib/format': { apiError: e => e.message },
  '@/src/lib/api': { api: {
    get: async () => ({ data: initial }),
    post: async (_url, body) => { posted.push(body); return { data: { status: 'pending', eligible: false } }; },
    delete: async () => { deleted++; },
  } },
};
const moduleFixture = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'frontend/app/student.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, { module: moduleFixture, exports: moduleFixture.exports, require: name => {
  if (!stubs[name]) throw new Error('Unstubbed ' + name); return stubs[name];
}, FormData: class { constructor() { this.fields = []; } append(...args) { this.fields.push(args); } }, console });
const Student = moduleFixture.exports.default;
const hostBy = (tree, type, predicate) => tree.root.findAll(node => node.type === type && predicate(node.props))[0];
const button = (tree, label) => hostBy(tree, 'Pressable', props => props.children?.props?.children === label);

test('student submission requires proof and consent; duplicate taps send one pending application', async () => {
  posted = []; initial = { status: 'not_submitted', eligible: false };
  let tree;
  await renderer.act(async () => { tree = renderer.create(React.createElement(Student)); });
  const submit = () => hostBy(tree, 'Pressable', p => p.testID === 'student-submit');
  assert.equal(submit().props.disabled, true);
  await renderer.act(async () => hostBy(tree, 'TextInput', p => p.accessibilityLabel === 'Studiested').props.onChangeText('Fixture University'));
  await renderer.act(async () => hostBy(tree, 'TextInput', p => p.accessibilityLabel.startsWith('Gyldig')).props.onChangeText('2027-01-01'));
  await renderer.act(async () => button(tree, 'Velg bilde av studentbevis').props.onPress());
  assert.equal(submit().props.disabled, true);
  await renderer.act(async () => hostBy(tree, 'Pressable', p => p.accessibilityRole === 'checkbox').props.onPress());
  assert.equal(submit().props.disabled, false);
  await renderer.act(async () => { const handler = submit().props.onPress; handler(); handler(); });
  assert.equal(posted.length, 1);
  assert.equal(posted[0].fields.find(x => x[0] === 'consent')[1], 'true');
  assert.equal(submit(), undefined, 'A pending request cannot be repeatedly uploaded');
  assert.ok(tree.root.findAllByType('Text').some(n => n.props.children === 'Venter på kontroll'));
  await renderer.act(async () => tree.unmount());
});

test('verified student can withdraw; the screen makes no active discount claim', async () => {
  deleted = 0; initial = { status: 'verified', eligible: true, valid_until: '2027-01-01' };
  let tree;
  await renderer.act(async () => { tree = renderer.create(React.createElement(Student)); });
  assert.equal(hostBy(tree, 'Pressable', p => p.testID === 'student-submit'), undefined);
  assert.ok(tree.root.findAllByType('Text').some(n => String(n.props.children).includes('foreløpig ingen rabatt')));
  await renderer.act(async () => button(tree, 'Trekk tilbake og slett studentstatus').props.onPress());
  assert.equal(deleted, 1);
  assert.ok(hostBy(tree, 'Pressable', p => p.testID === 'student-submit'));
  await renderer.act(async () => tree.unmount());
});
