// EAS file secret points to the Firebase client config for this Android application.
// Google Sign-In is enabled only in builds that provide EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.
module.exports = ({ config }) => {
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  const googleWebClientId = (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '').trim();
  const googleIosClientId = (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '').trim();
  const googleIosUrlScheme = (process.env.GOOGLE_IOS_URL_SCHEME || '').trim();
  const platform = process.env.EAS_BUILD_PLATFORM;

  if (platform === 'android' &&
      process.env.KJAPP_REQUIRE_FIREBASE === 'true' && !googleServicesFile) {
    throw new Error('Configure GOOGLE_SERVICES_JSON as an EAS file secret before an Android build.');
  }

  const googlePluginName = '@react-native-google-signin/google-signin';
  const plugins = (config.plugins || []).filter((plugin) =>
    (Array.isArray(plugin) ? plugin[0] : plugin) !== googlePluginName
  );

  if (googleWebClientId) {
    if (platform === 'ios') {
      if (!googleIosClientId || !googleIosUrlScheme) {
        throw new Error(
          'Google iOS Sign-In requires EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID and GOOGLE_IOS_URL_SCHEME.'
        );
      }
      plugins.push([googlePluginName, { iosUrlScheme: googleIosUrlScheme }]);
    } else {
      // Android needs the package/SHA-1 OAuth client in Google Cloud and the WEB client ID at runtime.
      plugins.push(googlePluginName);
    }
  }

  return {
    ...config,
    plugins,
    android: {
      ...config.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
  };
};
