const base = require('./app.json');

module.exports = () => {
  const googleMapsKey = process.env.GOOGLE_MAPS_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const googleServicesFile = process.env.GOOGLE_SERVICES_FILE || process.env.GOOGLE_SERVICES_JSON_FILE || '';
  const plugins = [...(base.expo.plugins || [])].filter((p) => !(Array.isArray(p) ? p[0] === 'react-native-maps' : p === 'react-native-maps'));

  if (googleMapsKey) {
    plugins.push(['react-native-maps', { androidGoogleMapsApiKey: googleMapsKey }]);
  }

  return {
    expo: {
      ...base.expo,
      android: {
        ...base.expo.android,
        ...(googleServicesFile ? { googleServicesFile } : {}),
      },
      plugins,
      extra: {
        ...(base.expo.extra || {}),
        googleMapsNative: Boolean(googleMapsKey),
        firebaseNativePush: Boolean(googleServicesFile),
      },
    },
  };
};
