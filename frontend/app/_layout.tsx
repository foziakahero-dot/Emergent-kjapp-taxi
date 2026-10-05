import { useReducedMotion } from '@/src/components/Motion';
import { NativePaymentProvider } from '@/src/components/NativePaymentProvider';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Pressable, Text } from 'react-native';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import { colors, FONT_ASSETS } from '@/src/theme';
import { installClientErrorMonitor } from '@/src/lib/errorMonitoring';
import { normalizeCustomerNotificationUrl, registerNativePush } from '@/src/lib/nativeRuntime';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function SessionGate({ children }: { children: React.ReactNode }) {
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
  useReducedMotion(); // Resolve the system preference while bundled fonts are loading.
  const [fontsLoaded] = useFonts(FONT_ASSETS);
  useEffect(() => installClientErrorMonitor(), []);
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <NativePaymentProvider>
            <SessionGate>
            <NativeRuntimeBridge />
            <StatusBar style="dark" />
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
              <Stack.Screen name="payment-methods" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="saved-places" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
            </Stack>
            </SessionGate>
            </NativePaymentProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

