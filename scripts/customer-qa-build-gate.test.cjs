const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyCustomerQaConfiguration } = require('../frontend/scripts/customer-qa-build-gate.cjs');
const valid = () => ({
  gate: { qaBackendBuildAuthorized: true },
  app: { android: { package: 'no.kjapp.app' }, ios: { bundleIdentifier: 'no.nexorahub.kjapp.customer' } },
  eas: { build: { qa: { distribution: 'internal', environment: 'preview', channel: 'qa', android: { buildType: 'apk' }, env: { EXPO_PUBLIC_BACKEND_URL: 'https://api-qa.snarapp.no' } } } },
  dependencies: { '@rnmapbox/maps': '10.3.5', '@stripe/stripe-react-native': '0.61.0' },
  env: { EAS_BUILD_PROFILE: 'qa', EXPO_PUBLIC_BACKEND_URL: 'https://api-qa.snarapp.no', EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN: 'pk.test-public-placeholder' },
});
test('accepts authorized internal QA APK configuration', () => assert.doesNotThrow(() => verifyCustomerQaConfiguration(valid())));
for (const [name, change] of [
  ['production runtime URL', x => { x.env.EXPO_PUBLIC_BACKEND_URL = 'https://api.kjappapp.no'; }],
  ['production profile URL', x => { x.eas.build.qa.env.EXPO_PUBLIC_BACKEND_URL = 'https://api.kjappapp.no'; }],
  ['missing authorization', x => { x.gate.qaBackendBuildAuthorized = false; }],
  ['store distribution', x => { x.eas.build.qa.distribution = 'store'; }],
  ['missing map token', x => { x.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN = ''; }],
  ['wrong native identity', x => { x.app.android.package = 'no.other.app'; }],
]) test(`rejects ${name}`, () => { const x = valid(); change(x); assert.throws(() => verifyCustomerQaConfiguration(x)); });

const testflight = () => {
  const x = valid();
  x.env.EAS_BUILD_PROFILE = 'testflight-qa';
  x.app.ios.usesAppleSignIn = true;
  x.eas.build['testflight-qa'] = { distribution: 'store', environment: 'preview', channel: 'qa',
    ios: {}, env: { EXPO_PUBLIC_BACKEND_URL: 'https://api-qa.snarapp.no' } };
  return x;
};
test('accepts Customer QA TestFlight with preview environment and Apple capability', () => {
  assert.doesNotThrow(() => verifyCustomerQaConfiguration(testflight()));
});
for (const [name, change] of [
  ['production backend', x => { x.eas.build['testflight-qa'].env.EXPO_PUBLIC_BACKEND_URL = 'https://api.kjappapp.no'; }],
  ['production environment', x => { x.eas.build['testflight-qa'].environment = 'production'; }],
  ['production channel', x => { x.eas.build['testflight-qa'].channel = 'production'; }],
  ['internal distribution', x => { x.eas.build['testflight-qa'].distribution = 'internal'; }],
  ['simulator binary', x => { x.eas.build['testflight-qa'].ios.simulator = true; }],
  ['missing Apple capability', x => { x.app.ios.usesAppleSignIn = false; }],
  ['missing authorization', x => { x.gate.qaBackendBuildAuthorized = false; }],
  ['missing map token', x => { x.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN = ''; }],
]) test(`rejects TestFlight ${name}`, () => {
  const x = testflight(); change(x); assert.throws(() => verifyCustomerQaConfiguration(x));
});
test('TestFlight preinstall selects the QA gate rather than the legacy production gate', () => {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const source = fs.readFileSync(require.resolve('../frontend/scripts/customer-build-gate.cjs'), 'utf8');
  let calls = 0;
  vm.runInNewContext(source, {
    require: name => name === 'fs' ? { readFileSync: () => JSON.stringify({ qaBackendBuildAuthorized: true }) }
      : name === 'path' ? require('node:path')
      : name === './customer-qa-build-gate.cjs' ? { verifyCustomerQaBuild: () => { calls++; return Promise.resolve(); } }
      : assert.fail('unexpected dependency'),
    __dirname: '/fixture/scripts', process: { env: { EAS_BUILD_PROFILE: 'testflight-qa' } },
    console: { log() {}, error() {} },
  });
  assert.equal(calls, 1);
});
