const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const driverRoot = path.join(__dirname, '../driver-app');
const appRequire = createRequire(path.join(driverRoot, 'package.json'));
const ts = appRequire('typescript');
const source = readFileSync(path.join(driverRoot, 'src/lib/driverAccess.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
const api = {};
vm.runInNewContext(outputText, { exports: api });

test('only the invited applicant or an approved driver keeps the mobile session', () => {
  for (const user of [null, { role: 'user', approved: true }, { role: 'driver' },
    { role: 'driver', approved: false }, { role: 'fleet_owner', driver_onboarding_allowed: true }]) {
    assert.equal(api.canKeepDriverSession(user), false);
  }
  assert.equal(api.canKeepDriverSession({ role: 'driver', approved: true }), true);
  assert.equal(api.canKeepDriverSession({ role: 'driver', approved: false, driver_onboarding_allowed: true }), true);
});

test('pending drivers can visit onboarding independently of how a route was opened', () => {
  const user = { role: 'driver', approved: false, driver_onboarding_allowed: true };
  for (const screen of ['index', 'driver-approval', 'driver-identity', 'driver-legal-consent']) {
    assert.equal(api.canOpenDriverScreen(user, screen), true);
  }
  for (const screen of ['(driver)', 'driver-trip/[tripId]', 'driver-earnings-report', 'driver-navigation']) {
    assert.equal(api.canOpenDriverScreen(user, screen), false);
    assert.equal(api.canOpenDriverScreen({ role: 'driver', approved: true }, screen), true);
  }
});
