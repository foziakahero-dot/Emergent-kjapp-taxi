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
import { driverApi } from '@/src/lib/api';
import {
  listenForNativePushTokenChanges,
  normalizeDriverNotificationUrl,
  registerNativePush,
  startDriverBackgroundLocation,
  stopDriverBackgroundLocation,
} from '@/src/lib/nativeRuntime';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function NativeRuntimeBridge() {
  const { user } = useAuth();

  useEffect(() => {
    if (user?.role !== 'driver' || user?.approved !== true) return;
    registerNativePush().catch(() => {});
    const tokenSub = listenForNativePushTokenChanges();
    return () => tokenSub.remove();
  }, [user?.id, user?.role, user?.approved]);

  useEffect(() => {
    if (user?.role !== 'driver' || user?.approved !== true) {
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
        // Foreground screens keep polling the backend; retry on the next interval.
      }
    };

    syncShiftRuntime();
    const timer = setInterval(syncShiftRuntime, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [user?.id, user?.role, user?.approved]);

  useEffect(() => {
    if (user?.role !== 'driver' || user?.approved !== true) return;

    let active = true;
    let sub: { remove: () => void } | undefined;

    const open = (notification?: Notifications.Notification | null) => {
      const target = normalizeDriverNotificationUrl(notification?.request.content.data?.url);
      if (target) router.push(target as any);
    };

    const init = async () => {
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        if (active && last?.notification) open(last.notification);
        if (!active) return;
        sub = Notifications.addNotificationResponseReceivedListener((response) => {
          open(response.notification);
        });
      } catch {
        // Push/deep-link initialization must never terminate the driver app.
      }
    };

    void init();
    return () => {
      active = false;
      sub?.remove();
    };
  }, [user?.id, user?.role, user?.approved]);

  return null;
}

export default function RootLayout() {
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
