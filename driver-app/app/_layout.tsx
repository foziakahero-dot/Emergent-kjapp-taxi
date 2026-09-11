import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useFonts } from 'expo-font';
import { AuthProvider } from '@/src/context/AuthContext';
import { colors, FONT_ASSETS } from '@/src/theme';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts(FONT_ASSETS);
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.driverBg }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.driverBg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
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
