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
import { normalizeCustomerNotificationUrl, registerNativePush } from '@/src/lib/nativeRuntime';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

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

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
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
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <NetworkBanner />
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <NativeRuntimeBridge />
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg },
                animation: 'fade',
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="login" />
              <Stack.Screen name="register" />
              <Stack.Screen name="(app)" />
              <Stack.Screen name="booking/[tripId]" />
              <Stack.Screen name="receipt/[tripId]" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="payment-methods" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="saved-places" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
            </Stack>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
