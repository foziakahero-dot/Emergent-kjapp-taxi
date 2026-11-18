// k6: QA-only, 1..20 synthetic users, read-only health and nearby-car queries.
// Does not book, dispatch, call geocoding/route providers, send OTP or charge.
import http from 'k6/http';
import { check, sleep, fail } from 'k6';

const BASE = 'https://api-qa.snarapp.no';
const peak = Number(__ENV.SNAR_QA_VUS || '10');
if (__ENV.SNAR_QA_LOAD !== 'RUN_SYNTHETIC_QA' || !Number.isInteger(peak) || peak < 1 || peak > 20) {
  throw new Error('Set SNAR_QA_LOAD=RUN_SYNTHETIC_QA and 1..20 SNAR_QA_VUS');
}
if (!/^[a-f0-9]{40}$/.test(__ENV.EXPECTED_BACKEND_SHA || '')) {
  throw new Error('Pin EXPECTED_BACKEND_SHA before testing');
}
if (!__ENV.QA_CUSTOMER_TOKEN) throw new Error('A synthetic QA customer token is required');

export const options = {
  stages: [{ duration: '30s', target: Math.min(5, peak) },
    { duration: '60s', target: peak }, { duration: '30s', target: 0 }],
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.01', abortOnFail: true, delayAbortEval: '30s' }],
    // Initial acceptance target, to be calibrated with a measured Oslo baseline.
    'http_req_duration{endpoint:nearby}': ['p(95)<800'],
    checks: ['rate>0.99'],
  },
};

export function setup() {
  const ready = http.get(BASE + '/api/ready').json();
  const c = ready?.checks;
  if (!ready?.ready || ready?.release?.commit !== __ENV.EXPECTED_BACKEND_SHA || ready?.release?.environment !== 'qa'
    || c?.qa_database_isolated !== true || c?.qa_mode !== true || c?.production_mode !== false
    || c?.auto_charge_enabled !== false) fail('Pinned isolated QA runtime is not confirmed');
  const config = http.get(BASE + '/api/payments/native/config').json();
  if (config?.test_mode !== true) fail('Stripe TEST mode is required');
  const me = http.get(BASE + '/api/auth/me', { headers: { Authorization: `Bearer ${__ENV.QA_CUSTOMER_TOKEN}` } });
  const user = me.status === 200 ? me.json() : null;
  if (!['user', 'customer'].includes(user?.role) || !/^qa-.*@example\.invalid$/.test(user?.email || '')) {
    fail('Load tests require a dedicated synthetic customer');
  }
}

export default function () {
  const response = http.post(BASE + '/api/cars/nearby', JSON.stringify({
    lat: 59.9230, lng: 10.7310, special_needs: [],
  }), { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${__ENV.QA_CUSTOMER_TOKEN}` },
    tags: { endpoint: 'nearby' }, timeout: '5s' });
  check(response, { 'nearby returns HTTP 200': r => r.status === 200,
    'nearby returns JSON': r => String(r.headers['Content-Type'] || '').includes('application/json') });
  sleep(2); // 20 virtual users is approximately 10 requests/s, not 20 req/s.
}
