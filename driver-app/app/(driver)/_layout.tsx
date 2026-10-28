import { FloatingTabBar, TabBarVisibilityProvider, TabScene } from '@/src/components/FloatingTabBar';
import React from 'react';
import { Tabs } from 'expo-router';

export default function DriverTabsLayout() {
  return (
    <TabBarVisibilityProvider>
    <Tabs
      screenLayout={({ children, route }) => <TabScene routeKey={route.key}>{children}</TabScene>}
      tabBar={props => <FloatingTabBar {...props} driver />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="home" options={{ title: 'Hjem' }} />
      <Tabs.Screen name="trips" options={{ title: 'Turer' }} />
      <Tabs.Screen name="earnings" options={{ title: 'Inntekt' }} />
      <Tabs.Screen name="intel" options={{ href: null }} />
      <Tabs.Screen name="messages" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ title: 'Konto' }} />
    </Tabs>
    </TabBarVisibilityProvider>
  );
}

