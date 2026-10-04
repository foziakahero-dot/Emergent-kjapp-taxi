module.exports = ({ config: base }) => {
  const plugins = base.plugins.filter(plugin => (Array.isArray(plugin) ? plugin[0] : plugin) !== '@stripe/stripe-react-native');
  const iosClient = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';
  // No guessed Google scheme or Apple Merchant ID is placed in the binary.
  if (iosClient.endsWith('.apps.googleusercontent.com')) {
    plugins.push(['@react-native-google-signin/google-signin', {
      iosUrlScheme: `com.googleusercontent.apps.${iosClient.replace('.apps.googleusercontent.com', '')}`,
    }]);
  }
  const merchant = process.env.EXPO_PUBLIC_APPLE_PAY_MERCHANT_ID || '';
  plugins.push(['@stripe/stripe-react-native', {
    enableGooglePay: true, ...(merchant ? { merchantIdentifier: merchant } : {}),
  }]);
  return { ...base, owner: 'elitetransport', plugins, android: { ...base.android, ...(process.env.GOOGLE_SERVICES_JSON ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : {}) } };
};

