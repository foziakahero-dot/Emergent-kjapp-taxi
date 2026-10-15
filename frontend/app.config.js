const { assertQaBackend } = require('../scripts/phase5-qa-build-guard.cjs');

module.exports = ({ config: base }) => {
  assertQaBackend(
    process.env.EAS_BUILD_PROFILE,
    process.env.EXPO_PUBLIC_BACKEND_URL
  );
  const plugins = base.plugins.filter(plugin => (Array.isArray(plugin) ? plugin[0] : plugin) !== '@stripe/stripe-react-native');
  if (!plugins.some(plugin => (Array.isArray(plugin) ? plugin[0] : plugin) === 'expo-sharing')) {
    plugins.push('expo-sharing');
  }

  // EAS may expose the iOS OAuth client either as a public build variable or as
  // a build-only variable. Support both names so the native URL scheme is baked
  // into the iOS binary whenever the project environment contains the client.
  const iosClient = (process.env.EAS_BUILD_PROFILE === 'qa'
    ? process.env.QA_GOOGLE_IOS_CLIENT_ID || ''
    : process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || process.env.GOOGLE_IOS_CLIENT_ID || ''
  ).trim();
  if (iosClient.endsWith('.apps.googleusercontent.com')) {
    plugins.push(['@react-native-google-signin/google-signin', {
      iosUrlScheme: `com.googleusercontent.apps.${iosClient.replace('.apps.googleusercontent.com', '')}`,
    }]);
  }

  const merchant = (process.env.EXPO_PUBLIC_APPLE_PAY_MERCHANT_ID || process.env.APPLE_PAY_MERCHANT_ID || '').trim();
  plugins.push(['@stripe/stripe-react-native', {
    enableGooglePay: true,
    ...(merchant ? { merchantIdentifier: merchant } : {}),
  }]);

  const isQaBuild = process.env.EAS_BUILD_PROFILE === 'qa';
  const googleServicesFile = isQaBuild
    ? ''
    : (
      process.env.GOOGLE_SERVICES_JSON ||
      process.env.GOOGLE_SERVICES_FILE ||
      ''
    ).trim();

  if (process.env.EAS_BUILD_PLATFORM === 'android' &&
      process.env.KJAPP_REQUIRE_FIREBASE === 'true' && !googleServicesFile) {
    throw new Error('Configure GOOGLE_SERVICES_JSON as an EAS file secret before an Android build.');
  }

  return {
    ...base,
    ...(isQaBuild ? { name: 'SNAR QA BACKEND' } : {}),
    owner: 'elitetransport',
    plugins,
    android: {
      ...base.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
  };
};
