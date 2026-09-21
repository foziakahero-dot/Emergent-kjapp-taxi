import * as Sentry from '@sentry/react-native';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
const environment = process.env.EXPO_PUBLIC_APP_ENV || (__DEV__ ? 'development' : 'production');

if (dsn) {
  Sentry.init({
    dsn,
    environment,
    tracesSampleRate: __DEV__ ? 0 : 0.1,
    attachStacktrace: true,
    sendDefaultPii: false,
    enableAutoSessionTracking: true,
  });
}

export { Sentry };
