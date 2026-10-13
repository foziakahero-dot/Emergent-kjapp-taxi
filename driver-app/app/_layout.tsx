import { useReducedMotion } from '@/src/components/Motion';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import { colors, FONT_ASSETS } from '@/src/theme';
import { installClientErrorMonitor } from '@/src/lib/errorMonitoring';
import { driverApi } from '@/src/lib/api';
import {
  normalizeDriverNotificationUrl,
  registerNativePush,
  startDriverBackgroundLocation,
  stopDriverBackgroundLocation,
} from '@/src/lib/nativeRuntime';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function NativeRuntimeBridge() {
  const { user, refresh } = useAuth();

  useEffect(() => {
    if (user?.role === 'driver' && user?.approved === true && user?.legal_accepted === true) registerNativePush().catch(() => {});
  }, [user?.id, user?.role, user?.approved, user?.legal_accepted]);

  useEffect(() => {
    if (user?.role !== 'driver' || user?.approved !== true || user?.legal_accepted !== true) {
      stopDriverBackgroundLocation().catch(() => {});
      return;
    }

    let alive = true;
    const syncShiftRuntime = async () => {
      try {
        const summary = await driverApi.summary();
        if (!alive) return;
        if (summary?.online) {
          const current = await driverApi.current().catch(() => null);
          if (!alive) return;
          const trip = current?.trip || current;
          const active = ['driver_on_way', 'at_pickup', 'in_trip'].includes(trip?.status || '');
          await startDriverBackgroundLocation(active ? 'active' : 'idle');
        } else {
          await stopDriverBackgroundLocation();
        }
      } catch {
        // Foreground screens keep polling the backend; retry on the next interval.
      }
    };

    syncShiftRuntime();
    const timer = setInterval(syncShiftRuntime, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [user?.id, user?.role, user?.approved, user?.legal_accepted]);

  useEffect(() => {
    if (user?.role !== 'driver' || user?.approved !== true || user?.legal_accepted !== true) return;

    let alive = true;
    const syncIdentityGate = async () => {
      try {
        const identity = await driverApi.identityVerification();
        if (!alive) return;
        const status = identity?.status || '';
        if (['recheck_required', 'retry_required', 'pending_review'].includes(status)) {
          await stopDriverBackgroundLocation().catch(() => {});
          await refresh().catch(() => {});
          if (alive) router.replace('/driver-identity');
        }
      } catch {
        // A transient network failure must never manufacture an identity decision.
      }
    };

    void syncIdentityGate();
    const timer = setInterval(syncIdentityGate, 30000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [user?.id, user?.role, user?.approved, user?.legal_accepted, refresh]);

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

export default function RootLayout() {
  useReducedMotion(); // Resolve the system preference while bundled fonts are loading.
  const [fontsLoaded] = useFonts(FONT_ASSETS);
  useEffect(() => installClientErrorMonitor(), []);
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.driverBg }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.driverBg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <NativeRuntimeBridge />
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.driverBg },
                animation: 'fade',
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="driver-login" />
              <Stack.Screen name="forgot-password" />
              <Stack.Screen name="reset-password/[token]" />
              <Stack.Screen name="driver-legal-consent" />
              <Stack.Screen name="(driver)" />
              <Stack.Screen name="driver-settings" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="driver-identity" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="driver-trips" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="driver-fleet" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="driver-documents" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="driver-navigation" options={{ animation: 'slide_from_right' }} />
            </Stack>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

