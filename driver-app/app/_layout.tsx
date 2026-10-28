import * as SplashScreen from 'expo-splash-screen';
import { LaunchSplash } from '@/src/components/SplashArt';
import { useReducedMotion } from '@/src/components/Motion';
import React, { useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import { colors, FONT_ASSETS, useColorTheme } from '@/src/theme';
import { installClientErrorMonitor } from '@/src/lib/errorMonitoring';
import { driverApi } from '@/src/lib/api';
import {
  normalizeDriverNotificationUrl,
  registerNativePush,
  startDriverBackgroundLocation,
  stopDriverBackgroundLocation,
} from '@/src/lib/nativeRuntime';

// Keep the native SNAR mark visible until the bundled font is ready.
void SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function NativeRuntimeBridge() {
  const pathname = usePathname();
  const path = useRef(pathname);
  path.current = pathname;
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
        if (['recheck_required', 'retry_required'].includes(status) ||
            (status === 'pending_review' && (user.identity_verification_required || user.identity_verified_at))) {
          await stopDriverBackgroundLocation().catch(() => {});
          await refresh().catch(() => {});
          if (alive && !['/driver-identity', '/driver-approval'].includes(path.current)) router.replace('/driver-approval');
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
  }, [user?.id, user?.role, user?.approved, user?.legal_accepted, user?.identity_verification_required, user?.identity_verified_at, refresh]);

  useEffect(() => {
    if (Platform.OS === 'web' || user?.role !== 'driver') return;
    let active = true;
    let sub: { remove: () => void } | undefined;
    const open = (notification?: Notifications.Notification | null) => {
      const target = normalizeDriverNotificationUrl(notification?.request.content.data?.url);
      if (target) router.push(target as any);
    };

    void (async () => {
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        if (active && last?.notification) open(last.notification);
        if (!active) return;
        sub = Notifications.addNotificationResponseReceivedListener(response => open(response.notification));
      } catch {
        // Notifications are optional; a module failure cannot terminate Driver startup.
      }
    })();
    return () => { active = false; sub?.remove(); };
  }, [user?.id, user?.role]);

  return null;
}

export default function RootLayout() {
  const theme = useColorTheme();
  useReducedMotion(); // Resolve the system preference while bundled fonts are loading.
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS);
  const [launchFinished, setLaunchFinished] = useState(false);
  const [fontDeadline, setFontDeadline] = useState(false);
  useEffect(() => {
    const minimum = setTimeout(() => setLaunchFinished(true), 1600);
    const deadline = setTimeout(() => setFontDeadline(true), 5000);
    return () => { clearTimeout(minimum); clearTimeout(deadline); };
  }, []);
  const fontReady = fontsLoaded || !!fontError || fontDeadline;
  useEffect(() => {
    if (!fontReady) return;
    void SplashScreen.hideAsync().catch(() => {});
  }, [fontReady]);
  useEffect(() => installClientErrorMonitor(), []);
  if (!launchFinished || !fontReady) return <><StatusBar style="light" /><LaunchSplash onLayout={() => { if (fontReady) void SplashScreen.hideAsync().catch(() => {}); }} /></>;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.driverBg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <NativeRuntimeBridge />
            <StatusBar style={theme.effective === 'dark' ? 'light' : 'dark'} />
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
              <Stack.Screen name="driver-earnings-detail" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="driver-earnings-report" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="driver-account" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="driver-settings" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="driver-approval" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="driver-identity" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="driver-trip/[tripId]" options={{ animation: 'slide_from_right' }} />
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

