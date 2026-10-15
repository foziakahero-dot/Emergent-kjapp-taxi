const fs = require('node:fs');
const path = require('node:path');
const { assertQaBackend, APPROVED_QA_BACKEND } = require('../../scripts/phase5-qa-build-guard.cjs');
const { verifyQaBackend } = require('../../scripts/phase5-qa-backend-preflight.cjs');

function verifyCustomerQaConfiguration({ gate, app, eas, dependencies, env }) {
  assertQaBackend(env.EAS_BUILD_PROFILE, env.EXPO_PUBLIC_BACKEND_URL);
  const profile = eas.build?.qa;
  if (env.EAS_BUILD_PROFILE !== 'qa' || gate.qaBackendBuildAuthorized !== true
      || profile?.distribution !== 'internal' || profile?.android?.buildType !== 'apk'
      || profile?.env?.EXPO_PUBLIC_BACKEND_URL !== APPROVED_QA_BACKEND
      || app.android?.package !== 'no.kjapp.app'
      || app.ios?.bundleIdentifier !== 'no.nexorahub.kjapp.customer'
      || !dependencies['@rnmapbox/maps'] || !dependencies['@stripe/stripe-react-native']
      || !(env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '').trim().startsWith('pk.')) {
    throw new Error('Customer QA configuration is incomplete.');
  }
}

async function verifyCustomerQaBuild({ gate, env = process.env, fetchImpl = globalThis.fetch }) {
  const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, '..', name), 'utf8'));
  verifyCustomerQaConfiguration({ gate, env, app: read('app.json').expo,
    eas: read('eas.json'), dependencies: read('package.json').dependencies });
  return verifyQaBackend({ env, fetchImpl });
}

module.exports = { verifyCustomerQaConfiguration, verifyCustomerQaBuild };
