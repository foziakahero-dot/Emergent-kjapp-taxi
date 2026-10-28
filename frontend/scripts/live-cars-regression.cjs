const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const ts = require(root + '/node_modules/typescript');
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
const { LiveCarsFeed, distanceKm } = require(root + '/src/lib/liveCars.ts');
class Socket {
  connected = false; handlers = {}; sent = [];
  on(e, fn) { this.handlers[e] = fn; }
  emit(e, data) { this.sent.push([e, data]); }
  connect() { this.connected = true; this.handlers.connect?.(); }
  disconnect() { this.connected = false; this.handlers.disconnect?.(); }
  removeAllListeners() { this.handlers = {}; }
  receive(data) { this.handlers['cars:snapshot']?.(data); }
}
let now = 10_000, sockets = [];
const feed = new LiveCarsFeed(() => { const s = new Socket(); sockets.push(s); return s; }, () => {}, () => now);
const circle = { lat: 59.9139, lng: 10.7522 };
feed.subscribe(circle); feed.setActive(true);
let socket = sockets[0];
const server = Date.parse('2026-10-16T00:00:00Z');
const car = { id: 'real', ...circle, name: 'QA Driver', car: 'Tesla Model Y', rating: 4.8, updated_at: new Date(server).toISOString() };
const frame = (cars, subscription_id = 1, millis = 0) => ({ cars, subscription_id, gps_fresh_seconds: 2, server_time: new Date(server + millis).toISOString() });
socket.receive(frame([car])); assert.deepEqual(feed.state.cars, [car]);
socket.receive(frame([{ ...car, lat: circle.lat + .001 }])); assert.equal(feed.state.cars[0].lat, circle.lat + .001);
socket.receive(frame([])); assert.equal(feed.state.cars.length, 0, 'Replacement removes offline cars immediately');
socket.receive(frame([car, { ...car, id: 'outside', lat: circle.lat + .1 }, { ...car, id: 'invalid', lng: NaN }, car]));
assert.deepEqual(feed.state.cars.map(c => c.id), ['real']);
assert.ok(distanceKm(circle, { ...circle, lat: circle.lat + .1 }) > 5);
now += 2000; feed.tick(); assert.equal(feed.state.cars.length, 0, 'GPS expiry is independent of device clock skew');
now += 8001; feed.tick(); assert.equal(feed.state.issue, 'offline', 'Silent streams fail closed after bounded transport grace');
feed.subscribe({ ...circle, lat: circle.lat + .1 });
socket.receive(frame([car], 1)); assert.equal(feed.state.cars.length, 0, 'Old subscription cannot restore markers');
socket.receive(frame([{ ...car, lat: circle.lat + .1 }], 2)); assert.equal(feed.state.cars.length, 1);
socket.disconnect(); assert.equal(feed.state.cars.length, 0, 'Disconnect clears without waiting for TTL');
const late = socket.handlers['cars:snapshot']; feed.setActive(false); late(frame([car], 2));
assert.equal(feed.state.cars.length, 0, 'Background response cannot revive cars');
feed.setActive(true); socket = sockets[1]; socket.receive(frame([{ ...car, lat: circle.lat + .1 }], 2));
assert.equal(feed.state.cars.length, 1); feed.dispose();
console.log('PASS: real-time replacement, movement, 5 km filtering, expiry, silence, disconnect, revision and resume');

{
  let clock = 50_000, stream;
  const stable = new LiveCarsFeed(() => (stream = new Socket()), () => {}, () => clock);
  stable.subscribe(circle); stable.setActive(true);
  const send = age => {
    const elapsed = clock - 50_000;
    stream.receive({ ...frame([{ ...car, updated_at: new Date(server + elapsed - age).toISOString() }], 1, elapsed), gps_fresh_seconds: 15 });
  };
  send(5000);
  assert.equal(stable.state.cars.length, 1, 'A 5-second-old real GPS sample remains eligible');
  clock += 3000; stable.tick();
  assert.equal(stable.state.cars.length, 1, 'A short frame delay must not remove a fresh driver');
  send(8000);
  clock += 7000; stable.tick();
  assert.equal(stable.state.cars.length, 0, 'Repeated snapshots cannot extend the actual GPS deadline');
  send(0); stream.receive({ ...frame([], 1, clock - 50_000), gps_fresh_seconds: 15 });
  assert.equal(stable.state.cars.length, 0, 'Authoritative offline/busy removal never waits for grace');
  stable.dispose();
}

const React = require(root + '/node_modules/react');
const renderer = require(root + '/node_modules/react-test-renderer');
const { act } = renderer; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const originalError = console.error;
console.error = (...args) => { if (!String(args[0]).includes('react-test-renderer is deprecated')) originalError(...args); };
const native = {
  View: 'View', Text: 'Text', Image: 'Image', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator',
  Platform: { OS: 'android' }, PanResponder: { create: config => ({ panHandlers: config }) },
};
const svg = new Proxy({ __esModule: true, default: 'Svg' }, { get: (t, k) => k in t ? t[k] : String(k) });
const mapbox = { __esModule: true, default: { setAccessToken() {} }, ...Object.fromEntries(['Camera', 'LineLayer', 'MapView', 'MarkerView', 'ShapeSource', 'StyleImport'].map(k => [k, k])) };
const stubs = {
  react: React, 'react/jsx-runtime': require(root + '/node_modules/react/jsx-runtime'),
  'react-native': native, 'react-native-svg': svg, '@rnmapbox/maps': mapbox,
  '@/src/theme': { useColorTheme: () => ({ effective: 'light' }), colors: {}, font: {} },
  '@/src/components/Motion': { useReducedMotion: () => true },
  './useSmoothPosition': { useSmoothPosition: p => p ? { ...p, heading: p.heading || 0 } : null },
  './Typography': { Text: 'Text' }, '@/src/components/Typography': { Text: 'Text' }, './Icon': { Icon: 'Icon' },
  '@/src/components/MapMarkers': { MapCar: 'MapCar', PositionDot: 'PositionDot' },
};
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} }; cache.set(file, module.exports);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext('(function(require,module,exports){' + code + '\n})', { process: { env: { EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN: 'pk.unit-test' } }, console, setTimeout, clearTimeout })(name => {
    if (stubs[name]) return stubs[name];
    let target = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(file), name);
    if (!path.extname(target)) target += fs.existsSync(target + '.tsx') ? '.tsx' : '.ts';
    return load(target);
  }, module, module.exports);
  cache.set(file, module.exports); return module.exports;
}
(async () => {
  for (const [file, component] of [['InteractiveMap.tsx', 'InteractiveMap'], ['RasterMap.tsx', 'InteractiveMap'], ['MapboxMap.native.tsx', 'MapboxInteractiveMap']]) {
    const Map = load(path.join(root, 'src/components', file))[component]; let tree;
    await act(async () => { tree = renderer.create(React.createElement(Map, { cars: [car] })); });
    const layout = tree.root.findAll(node => typeof node.type === 'string' && node.props.onLayout)[0];
    await act(async () => { layout.props.onLayout({ nativeEvent: { layout: { width: 390, height: 844 } } }); });
    const marker = tree.root.findAll(node => node.type === 'Pressable' && node.props.testID === 'driver-marker-real')[0];
    assert.ok(marker, file + ' custom marker is tappable');
    await act(async () => { marker.props.onPress(); });
    for (const [id, value] of [['marker-driver-name', 'QA Driver'], ['marker-car-model', 'Tesla Model Y'], ['marker-driver-rating', '4.8 av 5']]) {
      assert.equal(tree.root.findAll(node => node.type === 'Text' && node.props.testID === id)[0].props.children, value);
    }
    await act(async () => { tree.update(React.createElement(Map, { cars: [] })); });
    assert.equal(tree.root.findAll(node => typeof node.type === 'string' && node.props.testID === 'driver-marker-popup').length, 0, 'Popup disappears with driver');
    await act(async () => tree.unmount());
  }
  console.log('PASS: actual native Mapbox, web and raster markers open correct popup and remove it with the driver');
})().catch(error => { console.error(error); process.exitCode = 1; });
