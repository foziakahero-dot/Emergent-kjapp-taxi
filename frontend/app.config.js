const base = require('./app.json').expo;

module.exports = () => {
  const plugins = [...(base.plugins || [])];

  if (process.env.SENTRY_ORG && process.env.SENTRY_PROJECT) {
    plugins.push([
      '@sentry/react-native/expo',
      {
        url: process.env.SENTRY_URL || 'https://sentry.io/',
        organization: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
      },
    ]);
  }

  return {
    ...base,
    android: {
      ...base.android,
      ...(process.env.GOOGLE_SERVICES_JSON
        ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
        : {}),
    },
    plugins,
  };
};
