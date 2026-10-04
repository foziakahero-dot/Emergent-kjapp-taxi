import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, router, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import { colors, FONT_ASSETS } from '@/src/theme';
import { NetworkBanner } from '@/src/components/NetworkBanner';
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
  const { user } = useAuth();

  useEffect(() => {
    if (user?.role === 'driver') registerNativePush().catch(() => {});
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
    if (user?.role !== 'driver' || !user?.id) return;

    let alive = true;
    let sub: Notifications.EventSubscription | undefined;

    const open = (notification?: Notifications.Notification | null) => {
      if (!alive || !notification) return;
      try {
        const target = normalizeDriverNotificationUrl(notification.request.content.data?.url);
        if (target) router.push(target as any);
      } catch {
        // A malformed notification must never crash the native root.
      }
    };

    const boot = async () => {
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        if (alive && last?.notification) open(last.notification);
      } catch {
        // Native notification state is optional; driver app stays usable without it.
      }

      try {
        sub = Notifications.addNotificationResponseReceivedListener((response) => {
          open(response.notification);
        });
      } catch {
        // Listener registration failure must not terminate app startup.
      }
    };

    void boot();
    return () => {
      alive = false;
      try { sub?.remove(); } catch {}
    };
  }, [user?.id, user?.role]);

  return null;
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.driverBg, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', textAlign: 'center' }}>KJAPP kunne ikke åpne denne skjermen</Text>
      <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 10 }}>
        {__DEV__ ? error.message : 'En feil oppstod i appen. Prøv å åpne skjermen på nytt.'}
      </Text>
      <Pressable
        onPress={retry}
        style={{ marginTop: 20, minHeight: 48, paddingHorizontal: 22, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ color: colors.accentOn, fontWeight: '700' }}>Prøv igjen</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts(FONT_ASSETS);
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.driverBg }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.driverBg }}>
      <SafeAreaProvider>
        <NetworkBanner />
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
              <Stack.Screen name="driver-status" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="driver-trips" options={{ animation: 'slide_from_right' }} />
            </Stack>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
