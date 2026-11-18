import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server.js';
import { createServer } from 'vite';

// Load the actual dashboard and HTTP client; Leaflet's DOM-only renderer is
// never exercised during SSR. No browser, remote API, or QA credentials needed.
let server, Page, apiModule;
before(async () => {
  globalThis.window = { location: new URL('http://localhost/') };
  const session = new Map();
  globalThis.sessionStorage = { getItem: key => session.get(key) ?? null, setItem: (k, v) => session.set(k, v), removeItem: k => session.delete(k) };
  server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)), configFile: false,
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom',
    plugins: [{ name: 'ssr-map', enforce: 'pre', resolveId(id) { if (id === './FleetMap') return '\0map'; }, load(id) { if (id === '\0map') return 'export const FleetMap = () => null'; } }],
  });
  Page = (await server.ssrLoadModule('/src/FleetV2Pages.tsx')).OperationsDashboardPage;
  apiModule = await server.ssrLoadModule('/src/api.ts');
});
after(async () => { await server?.close(); delete globalThis.window; delete globalThis.sessionStorage; });

test('before any endpoint confirms data, each section is present but no zeros, all-clear or empty result are claimed', () => {
  const html = renderToStaticMarkup(React.createElement(StaticRouter, { location: '/' }, React.createElement(Page)));
  for (const section of ['Omsetning', 'Sjåførstatus', 'Siste turer', 'Viktige varsler']) assert.ok(html.includes(section), `Missing ${section}`);
  assert.doesNotMatch(html, /Alt ser bra ut|Ingen turer i perioden|0 kr|Ingen kritiske/);
});

async function deniedRequest(url, status, replaceToken = false) {
  const { http, TOKEN_KEY, setUnauthorizedHandler } = apiModule;
  sessionStorage.setItem(TOKEN_KEY, 'first-session');
  setUnauthorizedHandler(() => sessionStorage.removeItem(TOKEN_KEY));
  await assert.rejects(http.get(url, { adapter: async config => {
    if (replaceToken) sessionStorage.setItem(TOKEN_KEY, 'replacement-session');
    throw Object.assign(new Error('denied'), { config, response: { status } });
  } }));
  return sessionStorage.getItem(TOKEN_KEY);
}
test('current fleet access denial clears the session, including from the payout card', async () => {
  for (const url of ['/fleet/live', '/fleet/payouts']) assert.equal(await deniedRequest(url, 403), null);
});
test('late unauthorized response cannot invalidate the replacement session', async () => {
  assert.equal(await deniedRequest('/fleet/live', 401, true), 'replacement-session');
});
test('transient resource failures leave the authorized session intact', async () => {
  assert.equal(await deniedRequest('/fleet/trips', 503), 'first-session');
});

test('denials report forbidden vs expired credentials to the sign-in UI', async () => {
  const { http, TOKEN_KEY, setUnauthorizedHandler } = apiModule;
  const reasons = [];
  sessionStorage.setItem(TOKEN_KEY, 'current');
  setUnauthorizedHandler(status => reasons.push(status));
  for (const status of [403, 401]) await assert.rejects(http.get('/fleet/live', { adapter: async config => {
    throw Object.assign(new Error('denied'), { config, response: { status } });
  } }));
  assert.deepEqual(reasons, [403, 401]);
});

const resourceModule = () => import('../src/dashboardResource.ts');

test('missing collections, unusable entries and unknown Stripe readiness are not valid empty results', async () => {
  const { readList, readStripeReady } = await resourceModule();
  assert.deepEqual(readList({ trips: [] }, 'trips'), []);
  for (const invalid of [{}, null, { trips: {} }, { trips: [null] }]) assert.throws(() => readList(invalid, 'trips'));
  assert.throws(() => readStripeReady({}));
  assert.equal(readStripeReady({ ready: false }), false);
});

test('a delayed resource does not block a sibling; only the failed resource needs a retry', async () => {
  const { createResource } = await resourceModule();
  const delayed = Promise.withResolvers();
  const trips = createResource(() => delayed.promise);
  let error = true;
  const live = createResource(async () => { if (error) throw Error(); return []; });
  const wait = trips.refresh();
  await live.refresh();
  assert.equal(live.snapshot().status, 'error');
  assert.equal(trips.snapshot().status, 'loading');
  error = false;
  await live.refresh();
  assert.deepEqual(live.snapshot().data, []);
  assert.equal(live.snapshot().status, 'ready');
  delayed.resolve(['trip']); await wait;
  assert.deepEqual(trips.snapshot().data, ['trip']);
});

test('failed refresh keeps the same successful timestamp; auth failure discards the snapshot', async () => {
  const { createResource } = await resourceModule();
  let status = 200;
  const res = createResource(async () => { if (status !== 200) throw { response: { status } }; return ['private trip']; });
  await res.refresh();
  const updated = res.snapshot().updatedAt;
  assert.ok(updated > 0);
  status = 503; await res.refresh();
  assert.equal(res.snapshot().status, 'stale');
  assert.deepEqual(res.snapshot().data, ['private trip']);
  assert.equal(res.snapshot().updatedAt, updated);
  status = 403; await res.refresh();
  assert.equal(res.snapshot().data, undefined);
  assert.equal(res.snapshot().updatedAt, undefined);
});

test('unmount invalidates in-flight results, including after an immediate remount', async () => {
  const { createResource } = await resourceModule();
  const old = Promise.withResolvers();
  let request = old.promise;
  const res = createResource(() => request);
  const first = res.refresh();
  res.reset();
  request = Promise.resolve(['current']); await res.refresh();
  old.resolve(['previous']); await first;
  assert.deepEqual(res.snapshot().data, ['current']);
});
