// Actual native adapters with simulated SDK responses; no live charge is made.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const ts = require('../node_modules/typescript');
function load(file, stubs) {
  const mod = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module: mod, exports: mod.exports, require: key => stubs[key], process: { env: {} } });
  return mod.exports;
}
(async () => {
  let calls = [], result = {}, supported = true;
  let config = { enabled: true, google_pay_enabled: true, test_mode: true, publishable_key: 'pk_test_fixture' };
  const sdk = { isPlatformPaySupported: async args => { calls.push(['supported', args]); return supported; },
    confirmPlatformPayPayment: async (...args) => { calls.push(['confirm', ...args]); return result; },
    initStripe: () => { throw Error('Only the root StripeProvider may initialize Stripe'); },
    initPaymentSheet: async () => ({}), presentPaymentSheet: async () => ({}) };
  const { approveReservation } = load('src/lib/nativeReservation.native.ts', {
    '@stripe/stripe-react-native': sdk, './api': { paymentApi: { nativeConfig: async () => config } },
  });
  const detail = { trip_id: 'fixture-trip', client_secret: 'pi_fixture_secret', payment_provider: 'google_pay', amount_ore: 17300, currency: 'nok' };
  assert.equal(await approveReservation(detail), true);
  assert.equal(calls.find(c => c[0] === 'confirm')[2].googlePay.testEnv, true);
  config = { ...config, test_mode: false, publishable_key: 'pk_live_fixture' }; calls = [];
  assert.equal(await approveReservation(detail), true);
  assert.equal(calls.find(c => c[0] === 'confirm')[2].googlePay.testEnv, false);
  result = { error: { code: 'Canceled' } }; assert.equal(await approveReservation(detail), false);
  result = { error: { message: 'Bank declined' } }; await assert.rejects(approveReservation(detail), /Bank declined/);
  result = {}; supported = false; calls = [];
  await assert.rejects(approveReservation(detail), /ikke tilgjengelig/); assert(!calls.some(c => c[0] === 'confirm'));
  supported = true; calls = [];
  await assert.rejects(approveReservation({ ...detail, amount_ore: -1 }), /ikke bekreftes/);
  assert(!calls.some(c => c[0] === 'confirm'));
  config.publishable_key = 'pk_test_fixture'; await assert.rejects(approveReservation(detail), /ulike Stripe/);
  let configured = 0, nativeCalls = 0, failure;
  const google = { configure: () => configured++, hasPlayServices: async () => {}, signIn: async () => {
    nativeCalls++; if (failure) throw failure; return { type: 'success', data: { idToken: 'fixture-id-token' } };
  }};
  const { googleIdentity } = load('src/lib/socialSignIn.native.ts', {
    'react-native': { Platform: { OS: 'android' } }, 'expo-apple-authentication': {},
    '@react-native-google-signin/google-signin': { GoogleSignin: google,
      isSuccessResponse: r => r.type === 'success', isCancelledResponse: r => r.type === 'cancelled' },
  });
  await assert.rejects(googleIdentity({ google_enabled: false, google_web_client_id: '' }), /deaktivert/);
  assert.equal(configured, 0); assert.equal(nativeCalls, 0);
  assert.equal(await googleIdentity({ google_enabled: true, google_web_client_id: 'existing-client.apps.googleusercontent.com' }), 'fixture-id-token');
  failure = { code: '10', message: 'native detail must not be surfaced' };
  await assert.rejects(googleIdentity({ google_web_client_id: 'existing-client' }), /G10/);
  failure = { code: 'SIGN_IN_CANCELLED' }; assert.equal(await googleIdentity({ google_web_client_id: 'existing-client' }), null);
  console.log('PASS Google Pay reservation: test/live mode, real PaymentIntent confirmation adapter, cancel/decline, unavailable device, invalid amount and no duplicate Stripe initialization.');
  console.log('PASS Google Sign-In adapter: disabled backend, existing client, native signing error diagnostics and cancellation. Device/OAuth-console verification remains required.');
})().catch(error => { console.error(error); process.exitCode = 1; });
