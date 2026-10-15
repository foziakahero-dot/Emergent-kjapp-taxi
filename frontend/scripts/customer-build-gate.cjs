const fs = require('fs');
const path = require('path');
const gate = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'customer-build-gate.json'), 'utf8'));
const profile = process.env.EAS_BUILD_PROFILE;
if (profile === 'qa') {
  // V10 owns its source directly. Never run the legacy source rewriter here.
  const { verifyCustomerQaBuild } = require('./customer-qa-build-gate.cjs');
  verifyCustomerQaBuild({ gate }).then(() => {
    console.log('Customer V10 QA build gate PASS: isolated backend and Stripe test mode.');
  }).catch(() => {
    console.error('Customer V10 QA build gate FAILED. Verify QA configuration and backend readiness. No credential values are logged.');
    process.exitCode = 1;
  });
} else {
if (gate.nativeTestBuildAuthorized === true && gate.nativeTestBuildProfiles?.includes(profile)) {
  const app = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app.json'), 'utf8')).expo;
  const eas = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'eas.json'), 'utf8'));
  const dependencies = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).dependencies;
  const token = (process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '').trim();
  if (eas.build[profile]?.env?.EXPO_PUBLIC_BACKEND_URL !== 'https://api.kjappapp.no' || !token.startsWith('pk.') || !dependencies['@rnmapbox/maps'] || !dependencies['@stripe/stripe-react-native'] || app.android.package !== 'no.kjapp.app' || app.ios.bundleIdentifier !== 'no.nexorahub.kjapp.customer') {
    console.error('Customer native test build configuration is incomplete. No credential values are logged.');
    process.exit(1);
  }
  console.log('Authorized Customer native test build. Physical device and payment acceptance remain pending.');
  process.exit(0);
}
const incomplete = Object.entries(gate.checks).filter(([, status]) => status !== 'PASS');
if (gate.p0.length || gate.p1.length || incomplete.length || gate.customerBuildAuthorized !== true) {
  console.error('SNAR Customer build BLOCKED. See docs/CUSTOMER_PREBUILD_REPORT_20261004.md.');
  for (const [name, status] of incomplete) console.error(`${name}: ${status}`);
  for (const blocker of [...gate.p0, ...gate.p1]) console.error(blocker);
  process.exit(1);
}
console.log('SNAR Customer pre-build gate PASS.');
}
