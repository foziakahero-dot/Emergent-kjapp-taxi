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

test('booking search stays modal on Back, counts to 60 and asks server to end search once', async () => {
  const callbacks = new Map(); let timerId = 0, now = Date.parse('2026-10-17T00:00:00Z');
  const FakeDate = class extends Date { static now() { return now; } };
  native.Modal = host('Modal');
  const module = { exports: {} };
  const source = fs.readFileSync(path.resolve(__dirname, '../frontend/src/components/DriverSearchOverlay.tsx'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(compiled, { module, exports: module.exports, require: name => name === './Typography' ? stubs['@/src/components/Typography'] : stubs[name],
    Date: FakeDate, setInterval: fn => { callbacks.set(++timerId,fn); return timerId; }, clearInterval: id => callbacks.delete(id) });
  let overlay, stopped = 0, cancelled = 0;
  await renderer.act(async () => { overlay = renderer.create(React.createElement(module.exports.DriverSearchOverlay, {
    trip: { trip_id:'ride', search_started_at:'2026-10-17T00:00:00Z', server_time:'2026-10-17T00:00:00Z' },
    onCancel: () => cancelled++, onDeadline: () => stopped++,
  })); });
  await renderer.act(async () => overlay.root.findByType('Modal').props.onRequestClose());
  assert.equal(cancelled,0);
  now += 60000;
  await renderer.act(async () => { for(const fn of callbacks.values()) fn(); });
  await renderer.act(async () => { for(const fn of callbacks.values()) fn(); });
  assert.equal(stopped,1);
  assert.equal(overlay.root.findByType('Modal').props.visible,true,'Only canonical server state may remove the search modal');
  const seconds=overlay.root.findAllByType('Text').find(x=>x.props.testID==='driver-search-seconds');
  assert.equal(seconds.props.children[0],60);
  await renderer.act(async () => overlay.root.findAllByType('Pressable').find(x=>x.props.testID==='driver-search-cancel').props.onPress());
  assert.equal(cancelled,1);
  await renderer.act(async () => overlay.unmount());
  assert.equal(callbacks.size,0);
});

test('accepted driver notice shows full identity, contact actions and leaves half the map visible', async () => {
  native.ScrollView = host('ScrollView');
  stubs['react-native-safe-area-context'] = { useSafeAreaInsets: () => ({ top: 24, bottom: 0 }) };
  const module = { exports: {} };
  const source = fs.readFileSync(path.resolve(__dirname, '../frontend/src/components/DriverAcceptedNotice.tsx'),'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(compiled, { module, exports: module.exports, require: name => name === './Typography' ? stubs['@/src/components/Typography'] : stubs[name] });
  let notice, called = 0, messaged = 0, closed = 0;
  await renderer.act(async () => { notice = renderer.create(React.createElement(module.exports.DriverAcceptedNotice, {
    driver: { name: 'Kari Nordmann Hansen', brand: 'Volvo', model: 'XC60', color: 'Blå', plate: 'AB12345', rating: 4.87, phone: '+4712345678' }, eta: 7,
    onCall: () => called++, onChat: () => messaged++, onClose: () => closed++, onLayout: noop,
  })); });
  const json = JSON.stringify(notice.toJSON());
  for (const expected of ['Kari Nordmann Hansen', 'Volvo XC60', 'Blå', 'AB12345', '4,87']) assert.ok(json.includes(expected));
  assert.equal(notice.root.findAllByType('View').find(x => x.props.testID === 'driver-accepted-notice').props.style.maxHeight, dimensions.height * .5);
  const find = id => notice.root.findAllByType('Pressable').find(x => x.props.testID === id);
  await renderer.act(async () => { find('accepted-driver-call').props.onPress(); find('accepted-driver-message').props.onPress(); find('accepted-driver-close').props.onPress(); });
  assert.deepEqual([called, messaged, closed], [1,1,1]);
  await renderer.act(async () => notice.update(React.createElement(module.exports.DriverAcceptedNotice, { driver: {}, eta: null, onCall: noop, onChat: noop, onClose: noop, onLayout: noop })));
  assert.equal(find('accepted-driver-call').props.disabled, true);
  assert.ok(JSON.stringify(notice.toJSON()).includes('Farge ikke registrert'));
  await renderer.act(async () => notice.unmount());
});
