import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import { registerDriverNotifications } from '@/src/lib/notifications';
import { colors, FONT_ASSETS } from '@/src/theme';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function DriverShell() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user?.role === 'driver') {
      registerDriverNotifications().catch(() => {});
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    const openTrip = (response: Notifications.NotificationResponse | null) => {
      const data = response?.notification.request.content.data as any;
      if (data?.kind === 'new_trip' || data?.trip_id) {
        router.replace('/(driver)/home');
      }
    };

    Notifications.getLastNotificationResponseAsync().then(openTrip).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(openTrip);
    return () => sub.remove();
  }, [router]);

  return (
    <>
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
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts(FONT_ASSETS);
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.driverBg }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.driverBg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <DriverShell />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
