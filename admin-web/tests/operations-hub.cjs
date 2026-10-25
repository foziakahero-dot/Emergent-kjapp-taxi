// Local-only navigation, permission and responsive regression checks.
// API traffic is intercepted; this never signs in to a live account.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const base = process.env.ADMIN_TEST_URL || 'http://127.0.0.1:5173';
(async () => {
  const server = process.env.ADMIN_TEST_URL ? null : spawn(process.execPath,
    ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort'],
    { cwd: path.resolve(__dirname, '..'), stdio: 'ignore' });
  let browser;
  try {
    for (let i = 0; i < 50; i++) {
      try { await fetch(base); break; } catch (error) {
        if (i === 49) throw error;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE_PATH ? {
      executablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-software-rasterizer', '--no-zygote'],
    } : {}) });
    async function fixture(user, viewport) {
      const context = await browser.newContext({ viewport });
      const errors = [];
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.pathname.startsWith('/api/')) {
          const data = url.pathname === '/api/auth/login' ? { token: 'fixture-only', user }
            : url.pathname === '/api/auth/me' ? user
            : url.pathname === '/api/auth/2fa/status' ? { enabled: true, required: true }
            : {};
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
        }
        return url.origin === new URL(base).origin ? route.continue() : route.abort();
      });
      await page.goto(base);
      await page.getByLabel('E-postadresse').fill('fixture@example.invalid');
      await page.getByLabel('Passord', { exact: true }).fill('fixture-only');
      await page.getByRole('button', { name: 'Fortsett', exact: true }).click();
      await page.getByRole('heading', { name: 'Din arbeidsflate' }).waitFor();
      return { page, context, errors };
    }
    const full = await fixture({ role: 'superadmin' }, { width: 1440, height: 1100 });
    assert.equal(await full.page.getByRole('navigation', { name: 'Hovedmeny' }).getByRole('link').count(), 20);
    assert.equal(await full.page.getByRole('navigation', { name: 'Snarveier i Operations Hub' }).getByRole('link').count(), 6);
    await full.page.keyboard.press('Tab');
    await full.page.getByRole('button', { name: 'Hopp til innhold' }).press('Enter');
    assert.equal(await full.page.evaluate(() => document.activeElement.id), 'hub-main');
    if (process.env.ADMIN_SCREENSHOT_DIR) await full.page.screenshot({ path: path.join(process.env.ADMIN_SCREENSHOT_DIR, 'hub-desktop.png') });
    assert.deepEqual(full.errors, []);
    await full.context.close();

    const restricted = await fixture({ role: 'admin', permissions: ['operations'] }, { width: 390, height: 844 });
    const shortcuts = restricted.page.getByRole('navigation', { name: 'Snarveier i Operations Hub' });
    assert.equal(await shortcuts.getByRole('link').count(), 3);
    assert.equal(await restricted.page.getByRole('link', { name: 'Administratorer', exact: true }).count(), 0);
    assert.equal(await restricted.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (process.env.ADMIN_SCREENSHOT_DIR) await restricted.page.screenshot({ path: path.join(process.env.ADMIN_SCREENSHOT_DIR, 'hub-mobile.png') });
    const menu = restricted.page.getByRole('button', { name: 'Åpne meny', exact: true });
    await menu.click();
    assert.equal(await menu.getAttribute('aria-expanded'), 'true');
    await restricted.page.keyboard.press('Escape');
    assert.equal(await menu.getAttribute('aria-expanded'), 'false');
    assert.equal(await menu.evaluate(el => document.activeElement === el), true);
    await menu.click();
    await restricted.page.getByRole('navigation', { name: 'Hovedmeny' }).getByRole('link', { name: 'Turer', exact: true }).click();
    await restricted.page.waitForURL('**/#/trips');
    assert.equal(await menu.getAttribute('aria-expanded'), 'false');
    await restricted.page.goto(base + '/#/payments');
    await restricted.page.getByRole('alert').filter({ hasText: 'Du har ikke tilgang' }).waitFor();
    assert.deepEqual(restricted.errors, []);
    await restricted.context.close();
    console.log('PASS preserved navigation, role-filtered shortcuts, keyboard focus, mobile width/menu/Escape, denied finance route');
  } finally { await browser?.close(); server?.kill(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
