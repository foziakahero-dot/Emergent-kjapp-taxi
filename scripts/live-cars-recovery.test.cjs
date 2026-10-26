/** Actual availability hook/feed with isolated clock, socket, location and HTTP adapters. */
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
let now = Date.parse('2026-10-19T12:00:00Z'), nextId = 0, current, socket, watch, requests = 0;
let http = () => Promise.resolve(snapshot([car('nearby')]));
const timers = new Map(), cache = new Map();
const point = { lat: 59.9139, lng: 10.7522 };
const car = (id, extra = {}) => ({ id, ...point, type: 'ai-first', online: true, available: true, updated_at: new Date(now).toISOString(), ...extra });
const snapshot = cars => ({ cars, server_time: new Date(now).toISOString(), gps_fresh_seconds: 2 });
class ClockDate extends Date { static now() { return now; } }
const addTimer = (callback, delay, repeat = false) => { const id = ++nextId; timers.set(id, { callback, at: now + delay, delay, repeat }); return id; };
class Socket {
  connected = false; events = {};
  on(event, fn) { this.events[event] = fn; return this; }
  emit(_event, data, ack) { this.subscription = data; ack?.({ ok: true }); }
  connect() { this.connected = true; this.events.connect?.(); }
  disconnect() { this.connected = false; }
  removeAllListeners() { this.events = {}; }
}
const stubs = {
  react: React, 'react/jsx-runtime': appRequire('react/jsx-runtime'),
  'react-native': { AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } },
  'expo-router': { useFocusEffect: callback => React.useEffect(callback, [callback]) },
  'expo-location': { Accuracy: { High: 1 }, watchPositionAsync: async (_options, callback) => { watch = callback; return { remove() {} }; } },
  'socket.io-client': { io: () => (socket = new Socket()) },
  '@/src/context/AuthContext': { useAuth: () => ({ user: { id: 'customer-self' } }) },
  '@/src/utils/storage': { storage: { getItem: async () => 'isolated-test-token' } },
  './api': { BACKEND: 'https://qa.example.invalid', TOKEN_KEY: 'token', carsApi: { nearby: (...args) => { requests++; return http(...args); } } },
  './pickupLocation': { readPickupLocation: async () => ({ point }) },
};
function load(file) {
  const absolute = path.join(root, 'frontend/src/lib', file);
  if (cache.has(absolute)) return cache.get(absolute);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, Date: ClockDate, console,
    require(name) { if (stubs[name]) return stubs[name]; if (name.startsWith('./')) return load(name.slice(2) + '.ts'); throw Error(name); },
    setTimeout: (fn, delay) => addTimer(fn, delay), clearTimeout: id => timers.delete(id),
    setInterval: (fn, delay) => addTimer(fn, delay, true), clearInterval: id => timers.delete(id),
  }, { filename: absolute });
  cache.set(absolute, module.exports); return module.exports;
}
const { act } = renderer;
async function advance(ms) {
  const until = now + ms;
  while (true) {
    const due = [...timers].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
    if (!due) break;
    const [id, timer] = due; now = timer.at;
    if (timer.repeat) timer.at += timer.delay; else timers.delete(id);
    await act(async () => { timer.callback(); });
  }
  now = until;
}
const { useAvailableCars } = load('useAvailableCars.ts');
function Harness({ vehicleType }) { current = useAvailableCars({ enabled: true, vehicleType }); return null; }
(async () => {
  let tree;
  await act(async () => { tree = renderer.create(React.createElement(Harness)); });
  await act(async () => socket.events.connect_error());
  assert.equal(current.cars[0].id, 'nearby');
  http = () => new Promise(() => {}); // Second request never returns.
  await advance(2200);
  assert.ok(requests >= 2); assert.equal(current.cars.length, 0, 'REST markers must expire while the next HTTP call hangs');
  await act(async () => tree.unmount()); assert.equal(timers.size, 0);

  http = () => Promise.resolve(snapshot([car('nearby'), car('far', { lat: 60.1 }), car('offline', { online: false }), car('busy', { available: false }), car('customer-self')]));
  await act(async () => { tree = renderer.create(React.createElement(Harness)); });
  await act(async () => socket.events.connect_error());
  assert.equal(current.cars.map(c => c.id).join(','), 'nearby', 'REST cannot publish out-of-radius, offline, busy or own-location cars');
  await act(async () => watch({ coords: { latitude: 60.2, longitude: 10.7522 } }));
  await advance(200); assert.equal(current.cars.length, 0, 'Moving the customer removes out-of-radius cars locally');
  await act(async () => tree.unmount());

  http = () => Promise.resolve(snapshot([car('economy'), car('premium', { type: 'premium' })]));
  await act(async () => { tree = renderer.create(React.createElement(Harness, { vehicleType: 'premium' })); });
  await act(async () => socket.events.connect_error());
  assert.equal(current.cars.map(c => c.id).join(','), 'premium');
  await act(async () => tree.unmount()); assert.equal(timers.size, 0);

  let resolveRest;
  http = () => new Promise(resolve => { resolveRest = resolve; });
  await act(async () => { tree = renderer.create(React.createElement(Harness)); });
  await act(async () => socket.events.connect_error());
  await act(async () => socket.events['cars:snapshot']({ ...snapshot([car('socket-current')]), subscription_id: socket.subscription.subscription_id }));
  assert.equal(current.cars[0].id, 'socket-current');
  await act(async () => resolveRest(snapshot([car('rest-old')])));
  assert.equal(current.cars[0].id, 'socket-current', 'Late recovery response cannot overwrite the resumed authoritative socket');
  await act(async () => tree.unmount()); assert.equal(timers.size, 0);
  const { useAssignedVehicle } = load('useAssignedVehicle.ts');
  let assigned;
  function Assigned({ trip }) { assigned = useAssignedVehicle(trip); return null; }
  const trip = { driver_id: 'assigned-driver', status: 'driver_on_way', driver_lat: point.lat, driver_lng: point.lng, driver_heading: 80, vehicle_type: 'premium', driver_location_at: new Date(now).toISOString() };
  await act(async () => { tree = renderer.create(React.createElement(Assigned, { trip })); });
  assert.equal(assigned.id, 'assigned-driver');assert.equal(assigned.type, 'premium');assert.equal(assigned.heading, 80);
  await advance(30_001);
  assert.equal(assigned, null, 'Assigned car expires without another HTTP/socket response');
  await act(async () => tree.update(React.createElement(Assigned, { trip: { ...trip, driver_location_at: new Date(now).toISOString(), status: 'in_trip' } })));
  assert.equal(assigned.id, 'assigned-driver', 'New authoritative GPS restores assigned marker');
  await act(async () => tree.update(React.createElement(Assigned, { trip: { ...trip, driver_location_at: new Date(now).toISOString(), status: 'cancelled' } })));
  assert.equal(assigned, null);
  await act(async () => tree.unmount());assert.equal(timers.size, 0);
  console.log('PASS: actual hook REST expiry during stalled HTTP, radius on movement, own/offline/busy exclusion, category filtering, socket ownership race and timer cleanup.');
  console.log('PASS: assigned identity/class/heading, autonomous stale expiry, fresh GPS recovery and terminal-state removal.');
})().catch(error => { console.error(error); process.exitCode = 1; });
