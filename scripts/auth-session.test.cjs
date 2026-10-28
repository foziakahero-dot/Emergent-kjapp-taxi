// Actual React auth providers with isolated storage/API adapters; never sends credentials.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const req = createRequire(path.resolve(__dirname, '../frontend/package.json'));
const React = req('react'), renderer = req('react-test-renderer'), ts = req('typescript');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const denied = () => Object.assign(new Error('Rejected local fixture session'), { response: { status: 401 } });
function provider(app) {
  const role = app === 'driver-app' ? 'driver' : 'user';
  const user = { id: 'fixture-only', role, approved: true, legal_accepted: true };
  const values = new Map(); let rejectMe = false, logouts = 0;
  const storage = { getItem: async key => values.get(key) || null, setItem: async (key,value) => { values.set(key,value); }, removeItem: async key => { values.delete(key); } };
  const authApi = { me: async () => { if (rejectMe) throw denied(); return user; }, login: async () => ({ token: 'fixture-token-not-valid-on-any-server', user }), logout: async () => { logouts++; } };
  const stubs = { react: React, 'react/jsx-runtime': req('react/jsx-runtime'), 'react-native': { Platform: { OS: 'web' } },
    '@/src/utils/storage': { storage }, '@/src/lib/api': { authApi, TOKEN_KEY: 'token' },
    '@/src/lib/nativeRuntime': { unregisterNativePush: async () => {}, stopDriverBackgroundLocation: async () => {} },
    '@/src/lib/socialSignIn': { googleIdentity: async () => null, appleIdentity: async () => null } };
  const module = { exports: {} };
  const source = fs.readFileSync(path.resolve(__dirname, '..', app, 'src/context/AuthContext.tsx'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => { if (!stubs[name]) throw Error(name); return stubs[name]; }, console, setTimeout: fn => queueMicrotask(fn), Date, Math });
  let current, tree;
  function Harness() { current = module.exports.useAuth(); return null; }
  const mount = async () => { await renderer.act(async () => { tree = renderer.create(React.createElement(module.exports.AuthProvider, null, React.createElement(Harness))); }); };
  const unmount = async () => renderer.act(async () => tree.unmount());
  return { storage, values, mount, unmount, current: () => current, reject: () => { rejectMe = true; }, logouts: () => logouts };
}
for (const app of ['frontend','driver-app']) {
  test(`${app}: login, reload persistence, logout and rejected-session cleanup`, async () => {
    const p = provider(app); await p.mount(); assert.equal(p.current().user, null);
    await renderer.act(async () => { await p.current().login('fixture@example.test', 'fixture-not-a-real-password'); });
    assert.equal(p.current().user.id, 'fixture-only'); assert.ok(p.values.get('token'));
    await p.unmount(); await p.mount(); assert.equal(p.current().user.id, 'fixture-only');
    await renderer.act(async () => { await p.current().logout(); });
    assert.equal(p.current().user, null); assert.equal(p.values.has('token'), false); assert.equal(p.logouts(), 1);
    await p.unmount(); await p.mount(); assert.equal(p.current().user, null);
    await p.unmount(); p.values.set('token','expired-local-fixture'); p.reject(); await p.mount();
    assert.equal(p.current().user, null); assert.equal(p.values.has('token'), false); await p.unmount();
  });
}
