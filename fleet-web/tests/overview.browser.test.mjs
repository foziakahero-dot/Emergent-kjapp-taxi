// Run after npm run build in fleet-web. Requires Playwright and Chrome (or PW_CHANNEL).
import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const evidence = new URL('../qa-evidence/', import.meta.url);

test('fleet dashboard with local API responses', async t => {
  const server = await preview({ root, configFile: false, preview: { host: '127.0.0.1', port: 0 } });
  t.after(() => server.close());
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome' });
  t.after(() => browser.close());
  const now = new Date('2026-11-18T09:00:00+01:00');
  const arrival = new Date(now.getTime() + 86400000).toISOString();
  const paid = { id: 'paid', status: 'paid', amount: 991, currency: 'NOK', source: 'stripe', arrival_date: now.toISOString() };
  const incoming = { ...paid, id: 'incoming', status: 'in_transit', amount: 742.5, arrival_date: arrival };
  async function open(t, payout, docsStatus = 200) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    t.after(() => page.close());
    page.setDefaultTimeout(5000);
    await page.clock.install({ time: now });
    const calls = {}, state = { docsStatus, payout };
    await page.addInitScript(() => sessionStorage.setItem('kjapp_fleet_token', 'isolated-test'));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (!url.pathname.startsWith('/api/')) return route.continue();
      const path = url.pathname.slice(4); calls[path] = (calls[path] || 0) + 1;
      assert.equal(route.request().method(), 'GET');
      const day = { gross: 215, trips: 1, net: 0 };
      const bodies = {
        '/auth/me': { id: 'fixture-owner', role: 'fleet_owner', approved: true, fleet_id: 'local' },
        '/fleet/me': { id: 'local', name: 'Testflåte · lokale testdata' },
        '/fleet/overview': { today: day, week: day, drivers_total: 0, drivers_online: 0 },
        '/fleet/trips': { trips: [{ trip_id: 'test-trip', driver_name: 'Testtur Nord', status: 'completed', payment_status: 'paid', price: 215, created_at: now.toISOString() }] },
        '/fleet/drivers': { drivers: [] }, '/fleet/documents': { documents: [], missing: [], summary: {} },
        '/fleet/live': { drivers: [], trips: [], as_of: now.toISOString() },
        '/fleet/payouts': state.payout, '/fleet/stripe/status': { ready: true },
      };
      const status = path === '/fleet/documents' ? state.docsStatus : Object.hasOwn(bodies, path) ? 200 : 404;
      return route.fulfill({ status, json: status === 200 ? bodies[path] : { detail: 'Isolert testfeil' } });
    });
    await page.goto(origin);
    await page.getByText('Testtur Nord', { exact: true }).first().waitFor();
    return { page, calls, state };
  }
  for (const [name, response, expected] of [
    ['paid history only', { payouts: [paid], source: 'stripe', connected: true }, /ingen kommende utbetaling/i],
    ['earliest incoming Stripe transfer', { payouts: [paid, { ...incoming, id: 'later', amount: 899, status: 'pending', arrival_date: new Date(now.getTime() + 3 * 86400000).toISOString() }, incoming], source: 'stripe', connected: true }, /742,50/],
    ['failed or canceled transfers are historical', { payouts: [{ ...paid, status: 'failed' }, { ...paid, status: 'canceled' }], source: 'stripe', connected: true }, /ingen kommende utbetaling/i],
    ['unrecognised status cannot confirm an empty schedule', { payouts: [{ ...paid, status: 'other' }], source: 'stripe', connected: true }, /utbetalingsstatus kunne ikke kontrolleres/i],
    ['past expected arrival is not a confirmed next payout', { payouts: [{ ...incoming, arrival_date: '2020-01-18T00:00:00Z' }], source: 'stripe', connected: true }, /utbetalingsstatus kunne ikke kontrolleres/i],
    ['Stripe temporarily unavailable', { payouts: [], source: 'stripe', connected: true, temporarily_unavailable: true }, /utbetalingsstatus kunne ikke kontrolleres/i],
    ['no connected account', { payouts: [], source: 'none', connected: false }, /ikke tilkoblet|ikke koblet/i],
  ]) await t.test(name, async t => {
    const { page } = await open(t, response);
    await page.getByText(expected).first().waitFor();
    assert.equal(await page.getByText(/991.*kr/).count(), 0);
  });
  for (const code of [401, 403]) await t.test(`document refresh ${code} clears the prior protected view`, async t => {
    const { page, state } = await open(t, { payouts: [incoming], source: 'stripe', connected: true });
    await page.getByText(/742,50/).waitFor();
    state.docsStatus = code;
    await page.clock.fastForward(31_000);
    await page.getByText('Testtur Nord', { exact: true }).first().waitFor({ state: 'hidden' });
    assert.equal(await page.getByText(/742,50/).count(), 0);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('kjapp_fleet_token')), null);
  });
  await t.test('failed documents leave trips visible; retry recovers documents alone', async t => {
    const { page, calls, state } = await open(t, { payouts: [incoming], source: 'stripe', connected: true }, 503);
    await page.getByText(/Dokumentvarsler: Kunne ikke hente data/i).first().waitFor();
    assert.equal(await page.getByText(/Alt ser bra ut|System online/i).count(), 0);
    await mkdir(evidence, { recursive: true });
    await page.screenshot({ path: fileURLToPath(new URL('fleet-documents-error.png', evidence)), fullPage: true });
    const before = { ...calls }; state.docsStatus = 200;
    await page.getByRole('button', { name: /prøv igjen/i }).first().click();
    await page.getByText(/Dokumentvarsler: Kunne ikke hente data/i).first().waitFor({ state: 'hidden' });
    await page.getByText(/Alt ser bra ut|Ingen .*oppf[oø]lging|Ingen .*varsler/i).first().waitFor();
    assert.equal(calls['/fleet/documents'], before['/fleet/documents'] + 1);
    for (const path of ['/fleet/drivers','/fleet/trips','/fleet/overview','/fleet/payouts']) assert.equal(calls[path], before[path], path);
    await page.screenshot({ path: fileURLToPath(new URL('fleet-documents-recovered.png', evidence)), fullPage: true });
  });
});
