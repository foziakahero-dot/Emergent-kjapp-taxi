const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (dsn) {
  try {
    const Sentry = require('@sentry/react-native');
    Sentry.init({
      dsn,
      environment: process.env.EXPO_PUBLIC_APP_ENV || (__DEV__ ? 'development' : 'production'),
      tracesSampleRate: __DEV__ ? 0 : 0.1,
      attachStacktrace: true,
      sendDefaultPii: false,
      enableAutoSessionTracking: true,
    });
  } catch (error) {
    // Crash reporting must never prevent the app itself from starting.
    console.warn('Sentry initialization skipped', error);
  }
}

// Expo Router must be registered last.
require('expo-router/entry');
