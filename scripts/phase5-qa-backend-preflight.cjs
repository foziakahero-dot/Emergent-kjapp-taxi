const { APPROVED_QA_BACKEND, QA_BUILD_PROFILES, assertQaBackend } = require('./phase5-qa-build-guard.cjs');

const REQUIRED_QA_CHECKS = [
  'database', 'qa_mode', 'qa_database_isolated', 'demo_data_disabled',
  'jwt_configured', 'admin_identity_configured', 'stripe_key_configured',
  'stripe_webhook_configured', 'stripe_test_mode_configured',
  'public_web_origin_configured', 'service_area_enforced', 'booking_enabled',
];

const TRANSIENT_HTTP_STATUSES = new Set([502, 503, 504]);
const RETRY_DELAYS_MS = [0, 3000, 5000, 8000, 12000];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchQaJson(path, { fetchImpl, sleepImpl = sleep } = {}) {
  const url = APPROVED_QA_BACKEND + path;
  let lastError;

  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt += 1) {
    const delay = RETRY_DELAYS_MS[attempt];
    if (delay > 0) await sleepImpl(delay);

    try {
      const response = await fetchImpl(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(10000),
        headers: { Accept: 'application/json' },
      });

      // Native fetch validates DNS/TLS. A redirect must never count as QA success.
      if (response.status === 200) {
        if (response.url !== url || response.redirected) {
          throw new Error(`QA ${path} did not return a direct HTTPS 200 response.`);
        }
        try {
          return await response.json();
        } catch {
          throw new Error(`QA ${path} did not return valid JSON.`);
        }
      }

      if (!TRANSIENT_HTTP_STATUSES.has(response.status)) {
        throw new Error(`QA ${path} did not return a direct HTTPS 200 response.`);
      }

      lastError = new Error(`QA ${path} temporarily returned HTTP ${response.status}.`);
    } catch (error) {
      // Permanent semantic/redirect/JSON failures must never be retried away.
      if (error?.message?.includes('direct HTTPS 200') || error?.message?.includes('valid JSON')) {
        throw error;
      }
      lastError = error;
    }

    if (attempt < RETRY_DELAYS_MS.length - 1) {
      console.warn(`[qa-preflight] ${path} unavailable; retrying canonical QA backend (${attempt + 1}/${RETRY_DELAYS_MS.length - 1}).`);
    }
  }

  throw lastError || new Error(`QA ${path} is unavailable.`);
}

async function verifyQaBackend({ env = process.env, fetchImpl = globalThis.fetch, sleepImpl = sleep } = {}) {
  if (!QA_BUILD_PROFILES.has(env.EAS_BUILD_PROFILE)) {
    throw new Error('QA preflight requires EAS_BUILD_PROFILE=qa or testflight-qa.');
  }
  assertQaBackend(env.EAS_BUILD_PROFILE, env.EXPO_PUBLIC_BACKEND_URL);

  const results = {};
  for (const path of ['/api/health', '/api/ready']) {
    results[path] = await fetchQaJson(path, { fetchImpl, sleepImpl });
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

module.exports = {
  verifyQaBackend,
  fetchQaJson,
  REQUIRED_QA_CHECKS,
  TRANSIENT_HTTP_STATUSES,
  RETRY_DELAYS_MS,
};

if (require.main === module) {
  verifyQaBackend().then(result => console.log(JSON.stringify(result))).catch(() => {
    // Do not print remote bodies, response headers or provider credentials.
    console.error('QA backend preflight FAILED: verify canonical DNS/TLS, /api/health and /api/ready before building.');
    process.exitCode = 1;
  });
}
