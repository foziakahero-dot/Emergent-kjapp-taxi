// UI-only smoke test. Every external API request is intercepted; no real sessions,
// SMS, cars, trips, notifications or payments are created. This is not live E2E.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = process.env.SNAR_SMOKE_OUT || path.resolve(__dirname, '../docs/launch-v1/screenshots');
const roots = [process.env.SNAR_CUSTOMER_WEB || '/tmp/snar-customer-web', process.env.SNAR_DRIVER_WEB || '/tmp/snar-driver-web'];
const uid = 'aaaaaaaaaaaaaaaaaaaaaaaa', did = 'bbbbbbbbbbbbbbbbbbbbbbbb';
fs.mkdirSync(output, { recursive: true });

function serve(root) {
  const server = http.createServer((req, res) => {
    let file = path.join(root, new URL(req.url, 'http://localhost').pathname);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
    res.setHeader('Content-Type', ({ '.js': 'application/javascript', '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.webp': 'image/webp' })[path.extname(file)] || 'application/octet-stream');
    res.end(fs.readFileSync(file));
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function main() {
  const servers = await Promise.all(roots.map(serve));
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] } : {}) });
  const reports = [];
  try {
    const cases = [
      ['customer', 'login', '/login'], ['driver', 'login', '/driver-login'],
      ['customer', 'home', '/home'], ['customer', 'trips', '/history'], ['customer', 'account', '/profile'],
      ['customer', 'searching', '/booking/ui-fixture'], ['customer', 'driver_on_way', '/booking/ui-fixture'],
      ['customer', 'at_pickup', '/booking/ui-fixture'], ['customer', 'in_trip', '/booking/ui-fixture'],
      ['customer', 'completed', '/receipt/ui-fixture'],
      ['driver', 'offline', '/home'], ['driver', 'blocked', '/home'], ['driver', 'online', '/home'],
      ['driver', 'offer', '/home'], ['driver', 'driver_on_way', '/home'], ['driver', 'at_pickup', '/home'],
      ['driver', 'in_trip', '/home'], ['driver', 'completed', '/home'],
      ['driver', 'trips', '/trips'], ['driver', 'earnings', '/earnings'], ['driver', 'account', '/profile'],
    ];
    for (const [product, scenario, routePath] of cases) {
      const index = product === 'customer' ? 0 : 1;
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, geolocation: { latitude: 59.91, longitude: 10.75 }, permissions: ['geolocation'] });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      if (scenario !== 'login') await page.addInitScript(() => localStorage.setItem('kjapp_token', 'ui-fixture-never-valid-on-server'));
      const user = { id: index ? did : uid, role: index ? 'driver' : 'user', email: 'ui@example.test', fullName: 'UI Test', approved: true,
        legal_accepted: true, identity_verification_status: 'verified', fleet_id: 'cccccccccccccccccccccccc', vehicle_id: 'dddddddddddddddddddddddd', car: 'Testbil', plate: 'TEST' };
      const online = ['online', 'offer', 'driver_on_way', 'at_pickup', 'in_trip', 'completed'].includes(scenario);
      const trip = () => {
        const now = new Date().toISOString();
        return { trip_id: 'ui-fixture', user_id: uid, driver_id: scenario === 'searching' ? null : did, status: scenario,
          pickup_address: 'Hentested i Oslo', dropoff_address: 'Destinasjon i Oslo', pickup_lat: 59.91, pickup_lng: 10.75,
          dropoff_lat: 59.93, dropoff_lng: 10.71, driver_lat: 59.911, driver_lng: 10.751, driver_location_at: now,
          vehicle_type: 'ai-first', price: 190, driver_earnings: 190, commission_rate: 0, commission_source: 'subscription_v1', business_model: 'subscription', payment_status: scenario === 'completed' ? 'paid' : 'reserved', payment_flow: 'reservation',
          distance_km: 3, duration_min: 8, created_at: now, at_pickup_at: now, search_started_at: now, server_time: now,
          search_deadline_at: new Date(Date.now() + 60000).toISOString(), search_attempt: 1, eta_min: 4,
          customer: { name: 'Testkunde' }, driver: { id: did, name: 'Testsjåfør', car: 'Testbil', plate: 'TEST' } };
      };
      const tripState = ['searching', 'driver_on_way', 'at_pickup', 'in_trip', 'completed'].includes(scenario);
      await page.routeWebSocket(/wss?:\/\//, socket => socket.close());
      await page.route('**/*', async route => {
        const url = new URL(route.request().url()), p = url.pathname;
        if (url.hostname === '127.0.0.1') return route.continue();
        if (!p.startsWith('/api/')) return route.abort();
        let body = {};
        if (p === '/api/auth/me') body = user;
        else if (p.includes('/auth/native/config')) body = { google_enabled: false, apple_enabled: false };
        else if (p.includes('/otp/config')) body = { enabled: false };
        else if (p === '/api/trips/active') body = index === 0 && tripState && scenario !== 'completed' ? trip() : null;
        else if (p === '/api/trips/ui-fixture') body = trip();
        else if (p === '/api/driver/current') body = index && tripState ? trip() : null;
        else if (p === '/api/driver/pending') body = { server_time: new Date().toISOString(), trips: scenario === 'offer' ? [{ ...trip(), status: 'searching', offer_expires_at: new Date(Date.now() + 30000).toISOString(), offer_km: 1 }] : [] };
        else if (p === '/api/driver/compliance') body = { operational: scenario !== 'blocked', account_approved: true, profile_photo_ok: true, vehicle_id: scenario === 'blocked' ? null : user.vehicle_id,
          driver: { operational: true }, vehicle: { operational: scenario !== 'blocked' }, message: scenario === 'blocked' ? 'Ingen bil er koblet til kontoen' : '' };
        else if (p === '/api/driver/summary/today') body = { online, income: 0, trips: 0, online_minutes: 0 };
        else if (p === '/api/driver/identity-verification') body = { status: 'verified' };
        else if (p === '/api/cars/nearby') body = { cars: [], server_time: new Date().toISOString(), radius_km: 5 };
        else if (p === '/api/places/reverse') body = { label: 'Oslo' };
        else if (p === '/api/places/search') body = { results: [{ name: 'Majorstuen', lat: 59.93, lng: 10.71 }] };
        else if (p === '/api/trips/estimate') body = { distance_km: 3, duration_min: 8, options: ['ai-first', 'enkelt', 'trygg', 'premium', 'suv'].map(vehicle_type => ({ vehicle_type, price: 190, waiting_policy: { free_minutes: 2, per_minute: 10, max_fee: 60, token: 'ui-fixture' } })) };
        else if (p === '/api/payment-methods') body = { payment_methods: [] };
        else if (p === '/api/me/places' || p === '/api/places') body = { places: [] };
        else if (p === '/api/driver/history' || p === '/api/trips') body = { trips: [] };
        else if (p === '/api/driver/history/weekly') body = { days: [] };
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      });
      await page.goto(`http://127.0.0.1:${servers[index].address().port}${routePath}`);
      await page.waitForTimeout(5500);
      await page.getByTestId('v10-launch-splash').waitFor({ state: 'hidden', timeout: 6000 });
      const text = await page.locator('body').innerText();
      assert.ok(text.trim(), `${product}/${scenario}: empty screen`);
      assert.deepEqual(errors, [], `${product}/${scenario}: runtime exceptions`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${product}/${scenario}: horizontal overflow`);
      if (scenario === 'login' && !index) {
        assert.equal(await page.getByTestId('login-phone-submit').isDisabled(), true);
      }
      if (scenario === 'login' && index) assert.equal(await page.getByText('Fortsett med Google', { exact: true }).count(), 0);
      if (scenario === 'home' || scenario === 'offline') {
        assert.equal(await page.getByRole('tab').count(), index ? 4 : 3);
      }
      if (scenario === 'blocked') assert.ok(text.includes('Ingen bil er koblet til kontoen'));
      await page.screenshot({ path: path.join(output, `${product}-${scenario}.png`), fullPage: true });
      if (scenario === 'home' && !index) {
        await page.getByTestId('home-where-to').click();
        await page.getByTestId('search-input').fill('Major');
        await page.getByTestId('search-result-0').waitFor();
        await page.screenshot({ path: path.join(output, 'customer-search.png'), fullPage: true });
        await page.getByTestId('search-close').click();
        await page.getByTestId('home-search-toggle').click();
        assert.equal(await page.getByTestId('search-input').inputValue(), 'Major');
        await page.getByTestId('search-result-0').click();
        await page.getByTestId('route-choose-vehicle').click();
        await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(output, 'customer-selector.png'), fullPage: true });
        await page.getByTestId('booking-review').click();
        await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(output, 'customer-booking-review.png'), fullPage: true });
      }
      reports.push({ product, scenario, errors: [], horizontalOverflow: false });
      console.log(`PASS UI fixture: ${product}/${scenario}`);
      await context.close();
    }
    fs.writeFileSync(path.join(output, 'ui-results.json'), JSON.stringify({ scope: 'Local web UI with intercepted fixture APIs; not native or live E2E', reports }, null, 2));
  } finally { await browser.close(); servers.forEach(server => server.close()); }
}
main().catch(error => { console.error(error); process.exit(1); });
