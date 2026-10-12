const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyQaBackend, REQUIRED_QA_CHECKS } = require('./phase5-qa-backend-preflight.cjs');
const { APPROVED_QA_BACKEND } = require('./phase5-qa-build-guard.cjs');

const env = { EAS_BUILD_PROFILE: 'qa', EXPO_PUBLIC_BACKEND_URL: APPROVED_QA_BACKEND };
function ready() {
  return { ready: true, status: 'ready', blockers: [], checks: {
    ...Object.fromEntries(REQUIRED_QA_CHECKS.map(key => [key, true])),
    production_mode: false, auto_charge_enabled: false,
  } };
}
function fakeFetch({ readiness = ready(), health = { db: true, status: 'ok' }, response = {} } = {}) {
  return async (url, options) => {
    assert.equal(options.redirect, 'manual');
    assert.ok(options.signal instanceof AbortSignal);
    assert.ok([APPROVED_QA_BACKEND + '/api/health', APPROVED_QA_BACKEND + '/api/ready'].includes(url));
    return { status: 200, url, redirected: false,
      json: async () => url.endsWith('/health') ? health : readiness, ...response };
  };
}

test('preflight permits a ready isolated QA database and Stripe test mode', async () => {
  assert.equal((await verifyQaBackend({ env, fetchImpl: fakeFetch() })).qa, true);
});
test('wrong target or profile fails before any network request', async () => {
  const fetchImpl = async () => assert.fail('must not contact this target');
  for (const override of [{ EXPO_PUBLIC_BACKEND_URL: 'https://api.kjappapp.no' },
    { EXPO_PUBLIC_BACKEND_URL: 'https://api-qa.snarapp.no.evil.example' }, { EAS_BUILD_PROFILE: 'apk' }]) {
    await assert.rejects(verifyQaBackend({ env: { ...env, ...override }, fetchImpl }));
  }
});
test('redirects, different response URLs and non-200 status fail closed', async () => {
  for (const response of [{ status: 302 }, { status: 503 }, { redirected: true },
    { url: 'https://api.kjappapp.no/api/health' }]) {
    await assert.rejects(verifyQaBackend({ env, fetchImpl: fakeFetch({ response }) }));
  }
});
test('DNS/TLS errors or non-JSON responses block builds', async () => {
  await assert.rejects(verifyQaBackend({ env, fetchImpl: async () => { throw new Error('TLS failure'); } }));
  await assert.rejects(verifyQaBackend({ env, fetchImpl: fakeFetch({ response: {
    json: async () => { throw new SyntaxError('HTML response'); },
  } }) }));
});
test('database health and every required readiness check must explicitly pass', async () => {
  await assert.rejects(verifyQaBackend({ env, fetchImpl: fakeFetch({ health: { db: false, status: 'degraded' } }) }));
  for (const key of REQUIRED_QA_CHECKS) {
    for (const value of [false, undefined, 'true']) {
      const readiness = ready();
      readiness.checks[key] = value;
      await assert.rejects(verifyQaBackend({ env, fetchImpl: fakeFetch({ readiness }) }));
    }
  }
});
test('production mode, auto charging, blockers and malformed readiness cannot pass', async () => {
  for (const mutate of [r => { r.checks.production_mode = true; },
    r => { r.checks.auto_charge_enabled = true; }, r => { r.ready = false; },
    r => { r.blockers = ['stripe_test_mode_configured']; }, r => { delete r.blockers; },
    r => { delete r.checks.production_mode; }, r => { delete r.checks.auto_charge_enabled; }]) {
    const readiness = ready(); mutate(readiness);
    await assert.rejects(verifyQaBackend({ env, fetchImpl: fakeFetch({ readiness }) }));
  }
});
