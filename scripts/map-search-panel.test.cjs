const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const req = createRequire(path.resolve(__dirname, '../frontend/package.json'));
const React = req('react');
const renderer = req('react-test-renderer');
const ts = req('typescript');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let dimensions = { height: 800, width: 400 };
const host = name => ({ children, ...props }) => React.createElement(name, props, children);
const noop = () => {};
const native = { View: host('View'), ScrollView: host('ScrollView'), Pressable: host('Pressable'), ActivityIndicator: host('ActivityIndicator'), Platform: { OS: 'android' }, useWindowDimensions: () => dimensions };
const stubs = {
  'react': React, 'react/jsx-runtime': req('react/jsx-runtime'), 'react-native': native,
  '@/src/components/V10Entrance': { V10Entrance: host('Entrance') },
  '@/src/components/Typography': { Text: host('Text'), TextInput: host('Input') },
  '@/src/components/V10Icon': { V10Icon: host('Icon') }, '@/src/components/V10UI': { v10: {} },
  '@/src/theme': { useColorTheme: noop, colors: {}, font: {} },
  '@/src/lib/carAvailability': { validPosition: p => Number.isFinite(p.lat) && Number.isFinite(p.lng) },
  '@/src/lib/api': { placesApi: { search: async () => ({ results: [] }) } },
};
const result = { exports: {} };
const file = path.resolve(__dirname, '../frontend/app/(app)/home.tsx');
const code = ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
vm.runInNewContext(code, { exports: result.exports, module: result, require: name => stubs[name] || new Proxy({}, { get: () => noop }), setTimeout, clearTimeout, console });
const { SearchSheet } = result.exports;
test('search is capped at 30%, minimizes and keeps the typed query when reopened', async () => {
  let panel, minimized = 0;
  const props = { visible: true, onClose: () => minimized++, onSelect: noop, onVoice: noop, featured: [], insets: { top: 24, bottom: 0 } };
  await renderer.act(async () => { panel = renderer.create(React.createElement(SearchSheet, props)); });
  let entrance = panel.root.findByType('Entrance');
  assert.equal(entrance.props.style.height, 240);
  assert.equal(entrance.props.style.maxHeight, '30%');
  await renderer.act(async () => panel.root.findByType('Input').props.onChangeText('Oslo'));
  await renderer.act(async () => panel.root.findAllByType('Pressable').find(x => x.props.testID === 'search-close').props.onPress());
  assert.equal(minimized, 1);
  await renderer.act(async () => panel.update(React.createElement(SearchSheet, { ...props, visible: false })));
  assert.equal(panel.toJSON(), null);
  dimensions = { height: 600, width: 400 };
  await renderer.act(async () => panel.update(React.createElement(SearchSheet, props)));
  assert.equal(panel.root.findByType('Entrance').props.style.height, 180);
  assert.equal(panel.root.findByType('Input').props.value, 'Oslo');
  await renderer.act(async () => panel.unmount());
});
