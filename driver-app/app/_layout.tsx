import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import * as Sentry from '@sentry/react-native';
import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import { colors, FONT_ASSETS } from '@/src/theme';
import { driverApi } from '@/src/lib/api';
import {
  normalizeDriverNotificationUrl,
  registerNativePush,
  startDriverBackgroundLocation,
  stopDriverBackgroundLocation,
} from '@/src/lib/nativeRuntime';

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
Sentry.init({
  dsn: sentryDsn,
  enabled: Boolean(sentryDsn),
  environment: process.env.EXPO_PUBLIC_APP_ENV || 'beta',
  tracesSampleRate: 0.05,
  sendDefaultPii: false,
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function NativeRuntimeBridge() {
  const { user } = useAuth();

  useEffect(() => {
    if (user?.role === 'driver') registerNativePush().catch(() => {});
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (user?.id) Sentry.setUser({ id: user.id, role: user.role || 'driver' } as any);
    else Sentry.setUser(null);
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (user?.role !== 'driver') {
      stopDriverBackgroundLocation().catch(() => {});
      return;
    }

    let alive = true;
    const syncShiftRuntime = async () => {
      try {
        const summary = await driverApi.summary();
        if (!alive) return;
        if (summary?.online) await startDriverBackgroundLocation();
        else await stopDriverBackgroundLocation();
      } catch {
        // Foreground screens/SSE fallback keep the backend state fresh.
      }
    };

    syncShiftRuntime();
    const timer = setInterval(syncShiftRuntime, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [user?.id, user?.role]);

  useEffect(() => {
    const open = (notification?: Notifications.Notification | null) => {
      const target = normalizeDriverNotificationUrl(notification?.request.content.data?.url);
      if (target) router.push(target as any);
    };

    const last = Notifications.getLastNotificationResponse();
    if (last?.notification) open(last.notification);

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      open(response.notification);
    });
    return () => sub.remove();
  }, []);

  return null;
}

function RootLayout() {
  const [fontsLoaded] = useFonts(FONT_ASSETS);
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.driverBg }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.driverBg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <NativeRuntimeBridge />
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.driverBg },
                animation: 'fade',
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="driver-login" />
              <Stack.Screen name="(driver)" />
              <Stack.Screen name="driver-settings" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="driver-trips" options={{ animation: 'slide_from_right' }} />
            </Stack>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
