import * as Sentry from '@sentry/react-native';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();

Sentry.init({
  dsn: dsn || undefined,
  enabled: Boolean(dsn),
  environment: process.env.EXPO_PUBLIC_APP_ENV || 'beta',
  tracesSampleRate: 0,
  enableNative: true,
  enableNativeCrashHandling: true,
  sendDefaultPii: false,
});

Sentry.setTag('app.role', 'driver');

export { Sentry };
