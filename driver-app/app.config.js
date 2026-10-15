const { assertQaBackend } = require('../scripts/phase5-qa-build-guard.cjs');

module.exports = ({ config: base }) => {
  assertQaBackend(
    process.env.EAS_BUILD_PROFILE,
    process.env.EXPO_PUBLIC_BACKEND_URL
  );
  const plugins = [...base.plugins, 'expo-apple-authentication'];
  const iosClient = (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || process.env.GOOGLE_IOS_CLIENT_ID || '').trim();
  if (iosClient.endsWith('.apps.googleusercontent.com')) {
    plugins.push(['@react-native-google-signin/google-signin', {
      iosUrlScheme: `com.googleusercontent.apps.${iosClient.replace('.apps.googleusercontent.com', '')}`,
    }]);
  }
  const isQaBuild = process.env.EAS_BUILD_PROFILE === 'qa';
  const googleServicesFile = isQaBuild ? '' : process.env.GOOGLE_SERVICES_JSON;
  if (process.env.EAS_BUILD_PLATFORM === 'android' &&
      process.env.KJAPP_REQUIRE_FIREBASE === 'true' && !googleServicesFile) {
    throw new Error('Configure GOOGLE_SERVICES_JSON as an EAS file secret before an Android build.');
  }
  return {
    ...base,
    ...(isQaBuild ? { name: 'SNAR Driver QA BACKEND' } : {}),
    ios: { ...base.ios, usesAppleSignIn: true },
    android: {
      ...base.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
    plugins,
  };
};
