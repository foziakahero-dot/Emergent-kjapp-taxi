const { assertQaBackend, assertUpdateBackend } = require('../scripts/phase5-qa-build-guard.cjs');

module.exports = ({ config: base }) => {
  assertUpdateBackend(process.env.SNAR_UPDATE_CHANNEL, process.env.EXPO_PUBLIC_BACKEND_URL);
  assertQaBackend(
    process.env.EAS_BUILD_PROFILE,
    process.env.EXPO_PUBLIC_BACKEND_URL
  );
  const isQaBuild = ['qa', 'testflight-qa'].includes(process.env.EAS_BUILD_PROFILE);
  const plugins = [...base.plugins];
  const googleServicesFile = (isQaBuild ? process.env.QA_GOOGLE_SERVICES_JSON || '' :
    process.env.GOOGLE_SERVICES_JSON || process.env.GOOGLE_SERVICES_FILE || base.android.googleServicesFile || '').trim();
  if (process.env.EAS_BUILD_PLATFORM === 'android' && process.env.KJAPP_REQUIRE_FIREBASE === 'true' && !googleServicesFile) {
    throw new Error(isQaBuild ? 'Configure dedicated QA_GOOGLE_SERVICES_JSON before a QA Driver build.' : 'Configure GOOGLE_SERVICES_JSON before a Driver Android build.');
  }
  const android = { ...base.android };
  delete android.googleServicesFile;
  return {
    ...base,
    extra: { ...base.extra, sourceSha: process.env.EAS_BUILD_GIT_COMMIT_HASH || process.env.EXPO_PUBLIC_SOURCE_SHA || '' },
    ...(isQaBuild ? { name: 'SNAR Driver QA BACKEND' } : {}),
    ios: { ...base.ios },
    android: { ...android, ...(googleServicesFile ? { googleServicesFile } : {}) },
    plugins,
  };
};
