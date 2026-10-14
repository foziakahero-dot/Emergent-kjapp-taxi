const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyCustomerQaConfiguration } = require('../frontend/scripts/customer-qa-build-gate.cjs');
const valid = () => ({
  gate: { qaBackendBuildAuthorized: true },
  app: { android: { package: 'no.kjapp.app' }, ios: { bundleIdentifier: 'no.nexorahub.kjapp.customer' } },
  eas: { build: { qa: { distribution: 'internal', android: { buildType: 'apk' }, env: { EXPO_PUBLIC_BACKEND_URL: 'https://api-qa.snarapp.no' } } } },
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
