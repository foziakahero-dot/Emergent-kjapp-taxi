const base = require('./app.json').expo;

module.exports = () => {
  const plugins = [...base.plugins, 'expo-apple-authentication'];
  const iosClient = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';
  if (iosClient.endsWith('.apps.googleusercontent.com')) {
    plugins.push(['@react-native-google-signin/google-signin', {
      iosUrlScheme: `com.googleusercontent.apps.${iosClient.replace('.apps.googleusercontent.com', '')}`,
    }]);
  }
  return { ...base, ios: { ...base.ios, usesAppleSignIn: true }, plugins };
};
