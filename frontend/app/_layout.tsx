import * as SplashScreen from 'expo-splash-screen';
import { LaunchSplash } from '@/src/components/SplashArt';
import { useReducedMotion } from '@/src/components/Motion';
import { GlobalCustomerShell } from '@/src/components/GlobalCustomerShell';
import { NativePaymentProvider } from '@/src/components/NativePaymentProvider';
import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Pressable, StyleSheet, Text } from 'react-native';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import { colors, FONT_ASSETS, useColorTheme } from '@/src/theme';
import { installClientErrorMonitor } from '@/src/lib/errorMonitoring';
import { normalizeCustomerNotificationUrl, registerNativePush } from '@/src/lib/nativeRuntime';

// Keep the native SNAR mark visible until the bundled font is ready.
void SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function SessionGate({ children }: { children: React.ReactNode }) {
  useColorTheme();
  const { user, sessionError, refresh } = useAuth();
  if (user === undefined && sessionError) return <View style={{ flex: 1, justifyContent: 'center', padding: 28, gap: 16 }}>
    <Text accessibilityRole="alert" style={{ color: colors.text }}>{sessionError}</Text>
    <Pressable onPress={() => void refresh()} testID="session-retry" accessibilityRole="button" style={{ padding: 16, backgroundColor: colors.accent, borderRadius: 24 }}>
      <Text style={{ color: '#FFFFFF', textAlign: 'center' }}>Prøv igjen</Text>
    </Pressable>
  </View>;
  return <>{children}</>;
}

function NativeRuntimeBridge() {
  const { user } = useAuth();

  useEffect(() => {
    const role = user?.role;
    const isCustomer = !!user && (!role || role === 'user' || role === 'customer');
    if (isCustomer) registerNativePush().catch(() => {});
  }, [user?.id, user?.role]);

  useEffect(() => {
    const role = user?.role;
    const isCustomer = !!user && (!role || role === 'user' || role === 'customer');
    if (!isCustomer) return;

    let active = true;
    let sub: { remove: () => void } | undefined;

    const open = (notification?: Notifications.Notification | null) => {
      const target = normalizeCustomerNotificationUrl(notification?.request.content.data?.url);
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
        // Push/deep-link initialization must never terminate the customer app.
      }
    };

    void init();

    return () => {
      active = false;
      sub?.remove();
    };
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
    // Start session restore alongside bundled fonts, not after another splash delay.
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

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <NativePaymentProvider>
            <SessionGate>
            <NativeRuntimeBridge />
            <StatusBar style={theme.effective === 'dark' ? 'light' : 'dark'} />
            <GlobalCustomerShell>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg },
                animation: 'fade',
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="login" />
              <Stack.Screen name="permissions" />
              <Stack.Screen name="profile-setup" />
              <Stack.Screen name="register" />
              <Stack.Screen name="forgot-password" />
              <Stack.Screen name="reset-password/[token]" />
              <Stack.Screen name="legal-consent" />
              <Stack.Screen name="(app)" />
              <Stack.Screen name="booking/[tripId]" />
              <Stack.Screen name="receipt/[tripId]" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="scheduled-trip" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="payment-methods" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="saved-places" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="customer-trip/[tripId]" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="customer-account" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="customer-accessibility" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="support" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="support-chat" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
            </Stack>
            </GlobalCustomerShell>
            </SessionGate>
            </NativePaymentProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
      {!launchFinished || !fontReady ? <View testID="launch-overlay" style={[StyleSheet.absoluteFill, { zIndex: 1000, backgroundColor: colors.surfaceInverse }]}><StatusBar style="light" /><LaunchSplash onLayout={() => { if (fontReady) void SplashScreen.hideAsync().catch(() => {}); }} /></View> : null}
    </GestureHandlerRootView>
  );
}

