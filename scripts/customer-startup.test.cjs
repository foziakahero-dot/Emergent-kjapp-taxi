const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('../frontend/node_modules/typescript');
const React = require('../frontend/node_modules/react');
const { act, create } = require('../frontend/node_modules/react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
function load(path, imports = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
  vm.runInNewContext(code, { exports, require: name => imports[name] || require(name), setTimeout, clearTimeout, console });
  return exports;
}
const deadline = load('frontend/src/lib/deadline.ts');
test('native work that never resolves rejects at its deadline', async () => {
  await assert.rejects(deadline.withDeadline(new Promise(() => {}), 5), /Prøv igjen/);
});
test('successful work returns its original value', async () => {
  assert.equal(await deadline.withDeadline(Promise.resolve('session'), 100), 'session');
});
async function authHarness(storage, authApi, bounded = deadline) {
  const { AuthProvider, useAuth } = load('frontend/src/context/AuthContext.tsx', {
    react: React, '@/src/utils/storage': { storage }, '@/src/lib/api': { authApi, TOKEN_KEY: 'token' },
    '@/src/lib/deadline': bounded, '@/src/lib/nativeRuntime': {}, '@/src/lib/socialSignIn': {},
  });
  let state;
  function Probe() { state = useAuth(); return null; }
  let tree;
  await act(async () => { tree = create(React.createElement(AuthProvider, null, React.createElement(Probe))); });
  return { state: () => state, close: () => act(() => tree.unmount()) };
}
test('storage failure exposes retry instead of leaving startup silent', async () => {
  const h = await authHarness({ getItem: async () => { throw new Error('storage unavailable'); } }, {});
  assert.equal(h.state().user, undefined);
  assert.match(h.state().sessionError, /prøv igjen/i);
  await h.close();
});
test('session network deadline exposes retry and a retry can recover', async () => {
  let recover = false;
  const h = await authHarness({ getItem: async () => 'token' }, { me: () => recover ? Promise.resolve({ role: 'user', id: 'customer' }) : new Promise(() => {}) }, {
    withDeadline: (work, ms) => ms === 12000 && !recover ? Promise.reject(new Error('timeout')) : deadline.withDeadline(work, 100),
  });
  assert.match(h.state().sessionError, /prøv igjen/i);
  recover = true;
  await act(() => h.state().refresh());
  assert.equal(h.state().user.id, 'customer');
  assert.equal(h.state().sessionError, '');
  await h.close();
});
test('a late restoration response cannot overwrite a new login', async () => {
  let resolveMe;
  const h = await authHarness({ getItem: async () => 'token', setItem: async () => {} }, {
    me: () => new Promise(resolve => { resolveMe = resolve; }),
    login: async () => ({ token: 'new', user: { role: 'user', id: 'new-user' } }),
  });
  await act(() => h.state().login('new@example.com', 'password'));
  await act(async () => resolveMe({ role: 'user', id: 'old-user' }));
  assert.equal(h.state().user.id, 'new-user');
  await h.close();
});

test('both production admin domains use the backend, previews remain isolated', () => {
  const source = fs.readFileSync('admin-web/src/api.ts', 'utf8').replace('(import.meta as any).env', '{}');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  for (const [host, expected] of [
    ['admin.snarapp.no', 'https://api.kjappapp.no/api'],
    ['admin.kjappapp.no', 'https://api.kjappapp.no/api'],
    ['preview.vercel.app', '/__preview_api_disabled__'],
  ]) {
    const exports = {};
    const http = { interceptors: { request: { use() {} }, response: { use() {} } } };
    vm.runInNewContext(code, { exports, require: () => ({ __esModule: true, default: { create: () => http } }), window: { location: { hostname: host, origin: `https://${host}` } } });
    assert.equal(exports.API_BASE, expected);
  }
});
