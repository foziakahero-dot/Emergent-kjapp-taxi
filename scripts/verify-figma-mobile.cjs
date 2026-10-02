/** Component behavior checks. Native rendering and pixel comparison still require devices. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const customerRequire = createRequire(path.join(root, 'frontend/package.json'));
const React = customerRequire('react');
const renderer = customerRequire('react-test-renderer');
const ts = customerRequire('typescript');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const originalError = console.error;
console.error = (...args) => { if (!String(args[0]).includes('react-test-renderer is deprecated')) originalError(...args); };
let clock = 0, timerId = 0, nativeListeners = 0;
const timers = new Map(), accessibility = new Set(), cache = new Map();
const timingCalls = [];
class Value {
  constructor(value) { this.value = value; }
  setValue(value) { this.value = value; }
  interpolate(config) { return { value: this.value, ...config }; }
  stopAnimation() {}
}
const animation = () => ({ start() {}, stop() {} });
const native = {
  Text: 'NativeText', TextInput: 'NativeTextInput', View: 'View', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: value => value, absoluteFill: { position: 'absolute', inset: 0 }, flatten: value => Array.isArray(value) ? Object.assign({}, ...value.filter(Boolean).map(native.StyleSheet.flatten)) : value },
  AccessibilityInfo: {
    isReduceMotionEnabled: () => Promise.resolve(false),
    addEventListener: (_event, callback) => { nativeListeners++; accessibility.add(callback); return { remove: () => { nativeListeners--; accessibility.delete(callback); } }; },
  },
  Animated: { Value, View: 'AnimatedView', timing: (_value, config) => { timingCalls.push(config); return animation(); }, sequence: animation, loop: animation },
  Easing: { linear: value => value, bezier: (...values) => values },
};
function load(app, file) {
  const absolute = path.join(root, app, file);
  if (cache.has(absolute)) return cache.get(absolute);
  const result = { exports: {} };
  cache.set(absolute, result.exports);
  const compiled = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const localRequire = name => {
    if (name === 'react') return React;
    if (name === 'react/jsx-runtime') return customerRequire(name);
    if (name === 'react-native') return native;
    if (name === 'expo-linear-gradient') return { LinearGradient: 'Gradient' };
    if (name.startsWith('@expo-google-fonts/')) return new Proxy({}, { get: (_target, key) => key === '__esModule' ? true : `asset:${String(key)}` });
    if (name.endsWith('.ttf')) return name;
    if (name.startsWith('@/')) {
      const relative = name.slice(2);
      const target = ['.tsx', '.ts'].map(extension => relative + extension).find(candidate => fs.existsSync(path.join(root, app, candidate)));
      return load(app, target);
    }
    throw new Error(`Unexpected dependency in component check: ${name}`);
  };
  vm.runInNewContext(compiled, { require: localRequire, module: result, exports: result.exports, console,
    setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, at: clock + delay }); return id; },
    clearTimeout: id => timers.delete(id),
  }, { filename: absolute });
  cache.set(absolute, result.exports);
  return result.exports;
}
function advance(ms) {
  clock += ms;
  for (const [id, timer] of [...timers]) if (timer.at <= clock) { timers.delete(id); timer.callback(); }
}
const act = renderer.act;
(async () => {
  for (const app of ['frontend', 'driver-app']) {
    const { font, FONT_ASSETS } = load(app, 'src/theme.ts');
    const { resolveFont, Text } = load(app, 'src/components/Typography.tsx');
    for (const [weight, family] of [[300, 'Inter_300Light'], [400, font.body], [500, font.medium], [600, font.semibold], [700, font.bold], [800, font.extraBold]]) {
      assert.equal(resolveFont({ fontWeight: String(weight) }).fontFamily, family);
      assert.ok(FONT_ASSETS[family], `${app} must load ${family}`);
    }
    assert.equal(resolveFont({ fontFamily: font.mono, fontWeight: '500' }).fontFamily, font.monoMedium);
    assert.equal(resolveFont({}, font.bold).fontFamily, font.bold);
    assert.equal(resolveFont({ fontFamily: 'Custom', fontWeight: '700' }).fontFamily, 'Custom');
    let tree;
    await act(async () => { tree = renderer.create(React.createElement(Text, { style: { color: '#FFFFFF', fontWeight: '700' } }, React.createElement(Text, { style: { fontSize: 12 } }, 'kr'))); });
    const nested = tree.root.findAllByType('NativeText')[1];
    const nestedStyle = native.StyleSheet.flatten(nested.props.style);
    assert.equal(nestedStyle.color, '#FFFFFF');
    assert.equal(nestedStyle.fontFamily, font.bold);
    assert.equal(nestedStyle.lineHeight, 16);
    await act(async () => tree.unmount());
    const { gradientPoints } = load(app, 'src/components/FigmaGradient.tsx');
    for (const [angle, width, height] of [[120, 320, 52], [145, 104, 104], [180, 390, 844], [135, 334, 160]]) {
      const { start, end } = gradientPoints(angle, width, height);
      assert.ok(Math.abs(start.x + end.x - 1) < 1e-12);
      assert.ok(Math.abs(start.y + end.y - 1) < 1e-12);
      const dx = (end.x - start.x) * width, dy = (end.y - start.y) * height;
      assert.ok(Math.abs(dx * -Math.cos(angle * Math.PI / 180) - dy * Math.sin(angle * Math.PI / 180)) < 1e-9, 'CSS gradient angle must survive non-square layouts');
    }
  }
  const motion = load('driver-app', 'src/components/Motion.tsx');
  function Preference() { return React.createElement('Preference', { reduced: motion.useReducedMotion() }); }
  let preferences;
  await act(async () => { preferences = renderer.create(React.createElement(React.Fragment, {}, React.createElement(Preference), React.createElement(Preference))); });
  assert.equal(nativeListeners, 1, 'Preference listeners must be shared');
  assert.ok(preferences.root.findAllByType('Preference').every(node => !node.props.reduced));
  await act(async () => accessibility.forEach(callback => callback(true)));
  assert.ok(preferences.root.findAllByType('Preference').every(node => node.props.reduced));
  await act(async () => preferences.unmount());
  assert.equal(nativeListeners, 0, 'Preference listener must be removed');
  const { SlideConfirm } = load('driver-app', 'src/components/SlideConfirm.tsx');
  let calls = 0, release;
  const errors = [];
  let slide;
  await act(async () => { slide = renderer.create(React.createElement(SlideConfirm, { label: 'Start tur', onConfirm: () => { calls++; return new Promise(resolve => { release = resolve; }); }, onError: error => errors.push(error) })); });
  await act(async () => { const press = slide.root.findByType('Pressable').props.onPress; press(); press(); });
  await act(async () => advance(349));
  assert.equal(calls, 0, 'Trip action must wait for the confirmation animation');
  await act(async () => advance(1));
  assert.equal(calls, 1, 'Repeated presses must call the backend action once');
  assert.equal(slide.root.findByType('Pressable').props.disabled, true);
  await act(async () => release());
  assert.equal(slide.root.findByType('Pressable').props.disabled, false);
  await act(async () => slide.unmount());
  await act(async () => { slide = renderer.create(React.createElement(SlideConfirm, { label: 'Avslutt tur', onConfirm: () => { calls++; }, onError: error => errors.push(error) })); });
  await act(async () => slide.root.findByType('Pressable').props.onPress());
  await act(async () => slide.unmount());
  await act(async () => advance(350));
  assert.equal(calls, 1, 'Unmounted trip controls must never send stale actions');
  const failure = new Error('Network failed');
  await act(async () => { slide = renderer.create(React.createElement(SlideConfirm, { label: 'Start tur', onConfirm: async () => { throw failure; }, onError: error => errors.push(error) })); });
  await act(async () => slide.root.findByType('Pressable').props.onPress());
  await act(async () => advance(350));
  assert.deepEqual(errors, [failure], 'Backend action errors must reach the screen');
  assert.equal(slide.root.findByType('Pressable').props.disabled, false);
  await act(async () => slide.unmount());
  assert.equal(timers.size, 0);
  assert.equal(nativeListeners, 0);
  console.log('PASS: font files/weights, nested text inheritance, CSS gradient angles, shared reduced-motion preference, delayed single trip action, unmount cancellation and error recovery.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { console.error = originalError; });
