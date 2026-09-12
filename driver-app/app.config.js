const base = require('./app.json');

module.exports = () => {
  const googleMapsKey = process.env.GOOGLE_MAPS_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const plugins = [...(base.expo.plugins || [])].filter((p) => !(Array.isArray(p) ? p[0] === 'react-native-maps' : p === 'react-native-maps'));

  if (googleMapsKey) {
    plugins.push(['react-native-maps', { androidGoogleMapsApiKey: googleMapsKey }]);
  }

  return {
    expo: {
      ...base.expo,
      plugins,
      extra: {
        ...(base.expo.extra || {}),
        googleMapsNative: Boolean(googleMapsKey),
      },
    },
  };
};
