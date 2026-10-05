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
      <Tabs.Screen name="earnings" options={{ title: 'Inntjening' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
    </Tabs>
    </TabBarVisibilityProvider>
  );
}

