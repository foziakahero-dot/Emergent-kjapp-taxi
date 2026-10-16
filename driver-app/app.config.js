const { assertQaBackend } = require('../scripts/phase5-qa-build-guard.cjs');

module.exports = ({ config: base }) => {
  assertQaBackend(
    process.env.EAS_BUILD_PROFILE,
    process.env.EXPO_PUBLIC_BACKEND_URL
  );
  const isQaBuild = ['qa', 'testflight-qa'].includes(process.env.EAS_BUILD_PROFILE);
  const plugins = [...base.plugins, 'expo-apple-authentication'];
  const googleServicesFile = isQaBuild ? process.env.QA_GOOGLE_SERVICES_JSON : process.env.GOOGLE_SERVICES_JSON;
  if (process.env.EAS_BUILD_PLATFORM === 'android' &&
      process.env.KJAPP_REQUIRE_FIREBASE === 'true' && !googleServicesFile) {
    throw new Error(isQaBuild ? 'Configure dedicated QA_GOOGLE_SERVICES_JSON as an EAS file secret before a QA Android build.' : 'Configure GOOGLE_SERVICES_JSON as an EAS file secret before an Android build.');
  }
  return {
    ...base,
    extra: { ...base.extra, sourceSha: process.env.EAS_BUILD_GIT_COMMIT_HASH || process.env.EXPO_PUBLIC_SOURCE_SHA || '' },
    ...(isQaBuild ? { name: 'SNAR Driver QA BACKEND' } : {}),
    ios: { ...base.ios, usesAppleSignIn: true },
    android: {
      ...base.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
    plugins,
  };
};
