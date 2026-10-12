const { APPROVED_QA_BACKEND, assertQaBackend } = require('./phase5-qa-build-guard.cjs');

const REQUIRED_QA_CHECKS = [
  'database', 'qa_mode', 'qa_database_isolated', 'demo_data_disabled',
  'jwt_configured', 'admin_identity_configured', 'stripe_key_configured',
  'stripe_webhook_configured', 'stripe_test_mode_configured',
  'public_web_origin_configured', 'service_area_enforced', 'booking_enabled',
];

async function verifyQaBackend({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  if (env.EAS_BUILD_PROFILE !== 'qa') {
    throw new Error('QA preflight requires EAS_BUILD_PROFILE=qa.');
  }
  assertQaBackend(env.EAS_BUILD_PROFILE, env.EXPO_PUBLIC_BACKEND_URL);
  const results = {};
  for (const path of ['/api/health', '/api/ready']) {
    const url = APPROVED_QA_BACKEND + path;
    const response = await fetchImpl(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(20000),
      headers: { Accept: 'application/json' },
    });
    // Native fetch validates DNS/TLS. A redirect must never count as QA success.
    if (response.status !== 200 || response.url !== url || response.redirected) {
      throw new Error(`QA ${path} did not return a direct HTTPS 200 response.`);
    }
    try {
      results[path] = await response.json();
    } catch {
      throw new Error(`QA ${path} did not return valid JSON.`);
    }
  }
  const health = results['/api/health'];
  const ready = results['/api/ready'];
  if (health?.db !== true || health?.status !== 'ok') {
    throw new Error('QA database health is not confirmed.');
  }
  const checks = ready?.checks || {};
  if (ready?.ready !== true || ready?.status !== 'ready'
      || !Array.isArray(ready?.blockers) || ready.blockers.length !== 0
      || checks.production_mode !== false || checks.auto_charge_enabled !== false
      || REQUIRED_QA_CHECKS.some(key => checks[key] !== true)) {
    throw new Error('QA readiness, database isolation or Stripe test mode is not confirmed.');
  }
  return { api: APPROVED_QA_BACKEND, qa: true, database: true, stripeTestMode: true };
}

module.exports = { verifyQaBackend, REQUIRED_QA_CHECKS };

if (require.main === module) {
  verifyQaBackend().then(result => console.log(JSON.stringify(result))).catch(() => {
    // Do not print remote bodies, response headers or provider credentials.
    console.error('QA backend preflight FAILED: verify canonical DNS/TLS, /api/health and /api/ready before building.');
    process.exitCode = 1;
  });
}
