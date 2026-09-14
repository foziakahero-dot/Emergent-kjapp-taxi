const base = require('./app.json');

module.exports = () => {
  const googleMapsKey = process.env.GOOGLE_MAPS_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const android = {
    ...(base.expo.android || {}),
    ...(googleMapsKey
      ? {
          config: {
            ...((base.expo.android && base.expo.android.config) || {}),
            googleMaps: { apiKey: googleMapsKey },
          },
        }
      : {}),
  };

  return {
    expo: {
      ...base.expo,
      android,
      extra: {
        ...(base.expo.extra || {}),
        googleMapsNative: Boolean(googleMapsKey),
      },
    },
  };
};
