// Run against a local Vite server with Playwright available to Node.
// All auth/API responses are test fixtures; no live accounts are modified.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const base = process.env.ADMIN_TEST_URL || 'http://127.0.0.1:5173';
const user = { id: 'fixture-admin', role: 'admin', permissions: ['support'], email: 'admin@example.invalid' };
(async () => {
  const server = process.env.ADMIN_TEST_URL ? null : spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], { cwd: path.resolve(__dirname, '..'), stdio: 'ignore' });
  let browser;
  try {
    for (let i = 0; i < 50; i++) {
      try { await fetch(base); break; } catch (error) {
        if (i === 49) throw error;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-software-rasterizer', '--no-zygote'] } : {}) });
    async function fixture({ enrolled = false, statusError = false, statusMalformed = false, setupError = false } = {}) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const requests = []; let verifiedCode;
      await context.route('**/api/**', async route => {
        const req = route.request(); const path = new URL(req.url()).pathname; requests.push(path);
        const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
        if (path === '/api/auth/login') return reply(enrolled ? { twofa_required: true, twofa_token: 'fixture-challenge' } : { token: 'fixture-session', user });
        if (path === '/api/auth/me') return reply(user);
        if (path === '/api/auth/2fa/status') return statusError ? reply({ detail: 'Status unavailable' }, 503) : reply(statusMalformed ? {} : { enabled: enrolled, required: true });
        if (path === '/api/auth/2fa/setup') return setupError ? reply({ detail: 'Setup unavailable' }, 503) : reply({ secret: 'FIXTUREONLY', qr: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jrxkAAAAASUVORK5CYII=' });
        if (path === '/api/auth/2fa/enable') {
          if (req.postDataJSON().code !== '123456') return reply({ detail: 'Feil kode. Prøv igjen.' }, 400);
          enrolled = true; return reply({ enabled: true, backup_codes: ['abcd-1234', 'efab-5678'] });
        }
        if (path === '/api/auth/2fa/verify-login') {
          verifiedCode = req.postDataJSON().code;
          if (!['123456', 'abcd-1234'].includes(verifiedCode)) return reply({ detail: 'Feil kode.' }, 401);
          return reply({ token: 'fixture-verified-session', user });
        }
        if (path === '/api/auth/logout') return reply({ ok: true });
        return reply({});
      });
      await page.goto(base + '/#/settings');
      await page.getByLabel('E-postadresse').fill(user.email);
      await page.getByLabel('Passord', { exact: true }).fill('fixture-password-only');
      await page.getByRole('button', { name: 'Fortsett', exact: true }).click();
      return { page, context, requests, verifiedCode: () => verifiedCode };
    }
    function noAdminRequests(requests) {
      assert.equal(requests.filter(x => /\/api\/(admin|superadmin)\//.test(x)).length, 0, 'No admin API requests before enrollment');
    }
    const f = await fixture();
    await f.page.getByRole('heading', { name: 'Aktiver totrinnsbekreftelse' }).waitFor();
    await f.page.getByRole('button', { name: 'Sett opp 2FA' }).click();
    await f.page.getByAltText('QR-kode for totrinnsbekreftelse').waitFor();
    await f.page.getByLabel('Bekreftelseskode').fill('000000');
    await f.page.getByRole('button', { name: 'Aktiver 2FA', exact: true }).click();
    await f.page.getByText('Feil kode. Prøv igjen.', { exact: true }).waitFor();
    noAdminRequests(f.requests);
    await f.page.getByLabel('Bekreftelseskode').fill('123456');
    await f.page.getByRole('button', { name: 'Aktiver 2FA', exact: true }).click();
    await f.page.getByText('Reservekoder – vises bare nå').waitFor();
    assert.equal(await f.page.getByRole('button', { name: 'Deaktiver 2FA' }).count(), 0);
    noAdminRequests(f.requests);
    await f.page.getByRole('button', { name: 'Jeg har lagret reservekodene – logg inn på nytt' }).click();
    await f.page.getByLabel('E-postadresse').waitFor();
    assert.equal(await f.page.evaluate(() => sessionStorage.getItem('kjapp_admin_token')), null);
    assert(!JSON.stringify(await f.page.evaluate(() => ({ ...sessionStorage }))).includes('abcd-1234'));
    await f.context.close();
    console.log('PASS mandatory enrollment, restricted-role access, invalid/valid code, backup display, logout');

    for (const options of [{ statusError: true }, { statusMalformed: true }]) {
      const t = await fixture(options);
      await t.page.getByRole('alert').waitFor();
      noAdminRequests(t.requests);
      assert.equal(await t.page.getByRole('button', { name: 'Prøv igjen' }).count(), 1);
      await t.context.close();
    }
    console.log('PASS status failures and malformed responses keep operations closed');

    const badSetup = await fixture({ setupError: true });
    await badSetup.page.getByRole('button', { name: 'Sett opp 2FA' }).click();
    await badSetup.page.getByText('Setup unavailable', { exact: true }).waitFor();
    noAdminRequests(badSetup.requests); await badSetup.context.close();
    console.log('PASS setup failure remains retryable');

    for (const backup of [false, true]) {
      const t = await fixture({ enrolled: true });
      if (backup) await t.page.getByRole('button', { name: 'Bruk en reservekode' }).click();
      await t.page.getByLabel(backup ? 'Reservekode' : '6-sifret kode').fill(backup ? 'abcd-1234' : '123456');
      await t.page.getByRole('button', { name: 'Logg inn', exact: true }).click();
      await t.page.getByRole('navigation', { name: 'Hovedmeny' }).waitFor();
      assert.equal(t.verifiedCode(), backup ? 'abcd-1234' : '123456');
      await t.context.close();
    }
    console.log('PASS TOTP and reserve-code login');
  } finally { if (browser) await browser.close(); server?.kill(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
