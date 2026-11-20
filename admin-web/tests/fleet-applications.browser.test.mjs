// Run with Node 22.12+, Playwright (resolvable from this project), and installed Chrome.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const evidence = new URL('../qa-evidence/', import.meta.url);
const queue = '/api/superadmin/fleet-applications';
const row = (id, status = 'pending') => ({ id, status, company_name: `Testflåte ${id}`, contact_name: 'Testperson', submitted_at: '2025-01-15T12:00:00Z', documents_count: 0, documents: {} });
const ok = json => ({ json });
const fail = status => ({ status, json: { detail: 'Synthetic diagnostic' } });
const list = (...rows) => ok({ applications: rows });
let server, origin, browser;

before(async () => {
  // Serve only the built files, never the development server's live /api proxy.
  const bundle = await build({ root, base: '/', logLevel: 'error', envFile: false,
    define: { 'import.meta.env.VITE_API_BASE': JSON.stringify('/api') }, build: { write: false } });
  const files = new Map(bundle.output.map(f => ['/' + f.fileName, f.type === 'chunk' ? f.code : f.source]));
  server = createServer((req, res) => {
    const path = req.url === '/' ? '/index.html' : req.url;
    if (!files.has(path)) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(files.get(path));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', executablePath: process.env.PW_EXECUTABLE_PATH, headless: true });
});
after(async () => { await browser?.close(); if (server) await new Promise(r => server.close(r)); });

async function visit(t, handle, { enrolled = () => true, width = 1440, height = 960 } = {}) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width, height } });
  const unexpected = [];
  t.after(async () => { await ctx.close(); assert.deepEqual(unexpected, []); });
  await ctx.routeWebSocket('**/*', ws => ws.close());
  await ctx.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin !== origin) return route.abort();
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const base = { '/api/auth/me': { role: 'superadmin', email: 'admin@example.invalid', totp_enabled: enrolled() }, '/api/admin/overview': {}, '/api/admin/settings': { default_commission: 0.15 } };
    const response = base[url.pathname] ? ok(base[url.pathname]) : await handle(url, req);
    if (!response) { unexpected.push(`${req.method()} ${url.pathname}`); return route.abort(); }
    await route.fulfill(response);
  });
  await ctx.addInitScript(() => sessionStorage.setItem('kjapp_admin_token', 'isolated-test'));
  const page = await ctx.newPage();
  page.on('pageerror', e => unexpected.push(e.message));
  page.setDefaultTimeout(3500);
  await page.goto(origin + '/#/fleet-applications');
  return page;
}
const refresh = page => page.getByRole('button', { name: 'Oppdater', exact: true }).click();
const open = (page, id) => page.getByRole('button', { name: new RegExp(`Testflåte ${id}`) }).click();
const heading = (page, id) => page.getByRole('heading', { name: `Testflåte ${id}` });
const empty = page => page.getByText('Ingen søknader i denne statusen');
const paint = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
function gate() { let release; const wait = new Promise(r => { release = r; }); return { release, wait }; }
async function screenshot(page, name) {
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: fileURLToPath(new URL(name + '.png', evidence)), animations: 'disabled' });
}

test('initial outage has no verified zero or empty; retry restores the pending row', async t => {
  let healthy = false;
  const p = await visit(t, url => url.pathname === queue && (healthy ? list(row('Nord')) : fail(503)));
  await p.getByRole('alert').waitFor();
  assert.doesNotMatch(await p.locator('main').innerText(), /Ingen søknader|Søknader \(0\)|0 søknader/);
  await screenshot(p, 'admin-queue-error');
  healthy = true;
  await p.getByRole('button', { name: /prøv igjen/i }).click();
  await p.getByRole('button', { name: /Testflåte Nord/ }).waitFor();
  assert.equal(await p.getByRole('alert').count(), 0);
  await screenshot(p, 'admin-queue-recovery');
});

test('loading and malformed responses do not claim a verified empty; real empty does', async t => {
  const pending = gate(); let valid = false;
  const p = await visit(t, async url => { if (url.pathname === queue) { await pending.wait; return valid ? list() : ok({}); } });
  await p.getByRole('combobox').waitFor();
  assert.doesNotMatch(await p.locator('main').innerText(), /Ingen søknader|Søknader \(0\)|0 søknader/);
  pending.release();
  await p.getByRole('alert').waitFor();
  assert.equal(await empty(p).count(), 0);
  valid = true; await refresh(p); await empty(p).waitFor();
  assert.match(await p.locator('main').innerText(), /0 søknader/);
});

test('late response from a previous filter cannot replace current list', async t => {
  const old = gate(), started = gate();
  const p = await visit(t, async url => {
    if (url.pathname !== queue) return;
    if (url.searchParams.get('status') === 'pending') { started.release(); await old.wait; return list(row('Gammel')); }
    return list(row('Ny', 'approved'));
  });
  await started.wait;
  await p.getByRole('combobox').selectOption('approved');
  const current = p.getByRole('button', { name: /Testflåte Ny/ }); await current.waitFor();
  const finished = p.waitForEvent('requestfinished', r => r.url().includes('status=pending'));
  old.release(); await finished; await paint(p);
  assert.equal(await current.count(), 1); assert.equal(await p.getByText('Testflåte Gammel').count(), 0);
});

for (const change of ['selection', 'filter']) test(`pending detail cannot reappear after changing ${change}`, async t => {
  const old = gate(), started = gate();
  const p = await visit(t, async url => {
    if (url.pathname === queue) return url.searchParams.get('status') === 'pending' ? list(row('A'), row('B')) : list();
    if (url.pathname === queue + '/A') { started.release(); await old.wait; return ok(row('A')); }
    if (url.pathname === queue + '/B') return ok(row('B'));
  });
  await open(p, 'A'); await started.wait;
  if (change === 'selection') { await open(p, 'B'); await heading(p, 'B').waitFor(); }
  else { await p.getByRole('combobox').selectOption('approved'); await empty(p).waitFor(); }
  const finished = p.waitForEvent('requestfinished', r => r.url().endsWith('/A'));
  old.release(); await finished; await paint(p);
  assert.equal(await heading(p, 'A').count(), 0);
  if (change === 'selection') assert.equal(await heading(p, 'B').count(), 1);
});

for (const code of [401, 403]) test(`${code} on refresh clears both list and selected private detail`, async t => {
  let denied = false;
  const p = await visit(t, url => url.pathname === queue ? (denied ? fail(code) : list(row('Privat'))) : url.pathname === queue + '/Privat' && ok(row('Privat')));
  await open(p, 'Privat'); await heading(p, 'Privat').waitFor();
  denied = true; await refresh(p);
  if (code === 401) { await p.getByRole('heading', { name: 'Logg inn' }).waitFor(); assert.equal(await p.evaluate(() => sessionStorage.getItem('kjapp_admin_token')), null); }
  else { await p.getByRole('alert').filter({ hasText: /tilgang/i }).waitFor(); assert.equal(await empty(p).count(), 0); }
  assert.equal(await p.getByText('Testflåte Privat').count(), 0);
});

test('detail permission denial also clears the list', async t => {
  const p = await visit(t, url => url.pathname === queue ? list(row('Privat')) : url.pathname === queue + '/Privat' && fail(403));
  await open(p, 'Privat'); await p.getByRole('alert').filter({ hasText: /tilgang/i }).waitFor();
  assert.equal(await p.getByText('Testflåte Privat').count(), 0);
});

test('approval sends the selected commission and notes, retains one-time result after queue refresh', async t => {
  let approval;
  const p = await visit(t, (url, req) => {
    if (url.pathname === queue) return approval ? list() : list(row('A'));
    if (url.pathname === queue + '/A') return ok(row('A'));
    if (url.pathname === queue + '/A/approve' && req.method() === 'POST') { approval = req.postDataJSON(); return ok({ fleet_id: 'test-fleet', temp_password: 'test-only', confirmation_email_status: 'queued' }); }
  });
  await open(p, 'A'); await p.getByLabel('Serviceavgift ved godkjenning').fill('12.5');
  await p.getByPlaceholder('Notat til søker (valgfritt)').fill('Testnotat');
  await p.getByRole('button', { name: 'Godkjenn løyvehaver' }).click();
  await empty(p).waitFor();
  assert.deepEqual(approval, { review_notes: 'Testnotat', commission_rate: 0.125 });
  const password = p.getByLabel('Midlertidig passord til ny løyvehaver');
  assert.equal(await password.inputValue(), 'test-only'); assert.equal(await password.getAttribute('type'), 'password');
  await p.getByRole('button', { name: 'Lukk', exact: true }).click(); assert.equal(await password.count(), 0);
});

test('mobile admin can enroll before opening the protected route and scroll the full menu', async t => {
  let enabled = false;
  const p = await visit(t, (url, req) => {
    if (url.pathname === '/api/auth/2fa/status') return ok({ required: true, enabled });
    if (url.pathname === '/api/auth/2fa/setup') return ok({ secret: 'fixture-key' });
    if (url.pathname === '/api/auth/2fa/enable') {
      if (req.postDataJSON().code !== '123456') return fail(400);
      enabled = true;
      return ok({ enabled, backup_codes: ['fixture-reserve'], token: 'fixture-enrolled-session' });
    }
    if (url.pathname === queue && enabled) {
      assert.equal(req.headers().authorization, 'Bearer fixture-enrolled-session');
      return list();
    }
  }, { enrolled: () => enabled, width: 360, height: 800 });
  await p.getByRole('button', { name: 'Sett opp 2FA' }).click();
  assert.equal(await p.getByRole('navigation').count(), 0);
  await p.getByLabel('Bekreftelseskode').fill('123456');
  await p.getByRole('button', { name: 'Aktiver 2FA' }).click();
  await p.getByText('fixture-reserve').waitFor();
  await p.getByRole('button', { name: 'Åpne administrasjonspanelet' }).click();
  await empty(p).waitFor();
  await p.getByRole('button', { name: 'Åpne meny' }).click();
  const menu = p.locator('.sidebar-open');
  assert.ok((await menu.boundingBox()).height >= 790);
  const settings = menu.getByRole('link', { name: 'Innstillinger' });
  await settings.scrollIntoViewIfNeeded();
  await settings.click({ trial: true });
  await menu.getByRole('link', { name: 'Løyvesøknader' }).click();
  await p.locator('.sidebar-open').waitFor({ state: 'detached' });
});
