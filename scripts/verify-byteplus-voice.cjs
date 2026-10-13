/** Rendered behavioral verification. Live provider/device checks are separate. */
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
let navigation = [], proposalCalls = [], confirmCalls = [], pendingConfirm, failConfirm = false;
const router = { push: x => navigation.push(x) };
const result = { status: 'select_addresses', transcript: 'Hent meg ved Oslo S og kjør til Gardermoen', session_id: 'session-1',
  recommended_vehicle_type: 'trygg', pickup_candidates: [{ id: 'pickup-1', name: 'Oslo S' }], destination_candidates: [{ id: 'destination-1', name: 'Gardermoen' }] };
const proposal = { proposal_id: 'proposal-1', pickup: { name: 'Oslo S' }, destination: { name: 'Gardermoen' }, vehicle_type: 'trygg',
  estimated_price: 527, distance_km: 42, duration_min: 39, waiting_policy: { token: 'policy', max_fee: 60, per_minute: 4, free_minutes: 2, max_billable_minutes: 15 },
  expires_at: new Date(Date.now() + 120000).toISOString(), intent: { luggage: 2, large_luggage: true } };
const stubs = {
  'react': React, 'react/jsx-runtime': appRequire('react/jsx-runtime'),
  'react-native': { View: 'View', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator' },
  'expo-router': { useRouter: () => router }, './Typography': { Text: 'Text' },
  '@/src/theme': { colors: {}, font: {} }, '@/src/lib/format': { apiError: e => e.message, kr: n => n + ' kr' },
  '@/src/lib/api': { aiApi: {
    voiceProposal: async data => { proposalCalls.push(data); return proposal; },
    voiceConfirm: id => { confirmCalls.push(id); if (failConfirm) return Promise.reject(new Error('network result unknown')); return new Promise(resolve => { pendingConfirm = resolve; }); },
  }, tripsApi: { active: async () => ({ trip_id: 'canonical-recovered' }) } },
};
function load(file) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true, fileName: file });
  assert.equal((compiled.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
  const module = { exports: {} };
  vm.runInNewContext(compiled.outputText, { module, exports: module.exports, require: name => {
    assert.ok(stubs[name], 'Unhandled import: ' + name); return stubs[name];
  }, console, Date, Promise }, { filename: file });
  return module.exports;
}
const { VoiceBookingPanel } = load('frontend/src/components/VoiceBookingPanel.tsx');
const byId = (view, id) => view.root.findByProps({ testID: id });
function readable(node) { return node == null ? '' : typeof node !== 'object' ? String(node) : Array.isArray(node) ? node.map(readable).join('') : readable(node.children ?? node.props?.children); }
const text = view => readable(view.toJSON());
async function click(node) { assert.ok(!node.props.disabled); await act(async () => { await node.props.onPress(); }); }
async function prepare(view) {
  assert.equal(byId(view, 'voice-calculate').props.disabled, true);
  await click(byId(view, 'voice-pickup-pickup-1'));
  assert.equal(byId(view, 'voice-calculate').props.disabled, true);
  await click(byId(view, 'voice-destination-destination-1'));
  await click(byId(view, 'voice-calculate'));
  assert.match(text(view), /527 kr/); assert.match(text(view), /2 kolli/);
  assert.equal(byId(view, 'voice-confirm').props.disabled, true);
  await click(byId(view, 'voice-waiting-consent'));
}
(async () => {
  let view;
  await act(async () => { view = renderer.create(React.createElement(VoiceBookingPanel, { result, onEdit() {} })); });
  await prepare(view);
  assert.equal(confirmCalls.length, 0, 'proposal must not book');
  assert.deepEqual(JSON.parse(JSON.stringify(proposalCalls[0])), { session_id: 'session-1', pickup_id: 'pickup-1', destination_id: 'destination-1', vehicle_type: 'trygg' });
  const handler = byId(view, 'voice-confirm').props.onPress;
  let confirmation;
  await act(async () => { confirmation = handler(); await handler(); });
  assert.equal(confirmCalls.length, 1, 'sync lock prevents duplicate taps');
  await act(async () => { pendingConfirm({ trip_id: 'canonical-trip' }); await confirmation; });
  assert.deepEqual(navigation, ['/booking/canonical-trip']);
  await act(async () => view.unmount());
  failConfirm = true;
  await act(async () => { view = renderer.create(React.createElement(VoiceBookingPanel, { result, onEdit() {} })); });
  await prepare(view);
  await click(byId(view, 'voice-confirm'));
  assert.equal(byId(view, 'voice-confirm').props.disabled, true, 'unknown creation is not retried');
  assert.match(text(view), /network result unknown/);
  const recovery = view.root.findAllByType('Pressable').find(n => readable(n.props.children).includes('Åpne aktiv tur'));
  await click(recovery);
  assert.equal(navigation.at(-1), '/booking/canonical-recovered');
  await act(async () => view.unmount());
  for (const file of ['frontend/app/(app)/assist.tsx', 'frontend/src/lib/api.ts']) {
    const compiled = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS }, reportDiagnostics: true, fileName: file });
    assert.equal((compiled.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0, file);
  }
  console.log('PASS: rendered voice proposal, explicit address/consent gates, authoritative price, duplicate confirm, failed-confirm recovery; changed TS/TSX parse.');
})().catch(error => { console.error(error); process.exitCode = 1; });
