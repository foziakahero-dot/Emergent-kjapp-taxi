const base = require('./app.json');

module.exports = () => {
  const googleMapsKey = process.env.GOOGLE_MAPS_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const plugins = [...(base.expo.plugins || [])].filter((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    return name !== 'react-native-maps';
  });

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
