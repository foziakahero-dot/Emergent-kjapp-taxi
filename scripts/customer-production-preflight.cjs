// Read-only release check. Never prints Stripe keys, OAuth tokens or account data.
const API = 'https://api.kjappapp.no';
async function main() {
  const get = async path => {
    const response = await fetch(API + path, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.json();
  };
  const [ready, payments, auth] = await Promise.all([get('/api/ready'), get('/api/payments/native/config'), get('/api/auth/native/config?client=customer')]);
  const checks = {
    backend_ready: ready.ready === true,
    production_environment: ready.checks?.production_mode === true && ready.checks?.qa_mode === false,
    demo_data_disabled: ready.checks?.demo_data_disabled === true,
    live_stripe: payments.enabled === true && payments.test_mode === false && payments.publishable_key?.startsWith('pk_live_') === true,
    stripe_webhook: ready.checks?.stripe_webhook_configured === true,
    google_pay: payments.google_pay_enabled === true,
    google_signin: auth.google_enabled === true && Boolean(auth.google_web_client_id),
  };
  for (const [name, pass] of Object.entries(checks)) console.log(`${pass ? 'PASS' : 'BLOCKED'} ${name}`);
  if (Object.values(checks).some(value => !value)) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
