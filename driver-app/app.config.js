const { assertQaBackend } = require('../scripts/phase5-qa-build-guard.cjs');

module.exports = ({ config: base }) => {
  assertQaBackend(
    process.env.EAS_BUILD_PROFILE,
    process.env.EXPO_PUBLIC_BACKEND_URL
  );
  const isQaBuild = ['qa', 'testflight-qa'].includes(process.env.EAS_BUILD_PROFILE);
  const plugins = [...base.plugins];
  return {
    ...base,
    extra: { ...base.extra, sourceSha: process.env.EAS_BUILD_GIT_COMMIT_HASH || process.env.EXPO_PUBLIC_SOURCE_SHA || '' },
    ...(isQaBuild ? { name: 'SNAR Driver QA BACKEND' } : {}),
    ios: { ...base.ios },
    android: { ...base.android },
    plugins,
  };
};
