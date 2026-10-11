import { FloatingTabBar, TabBarVisibilityProvider, TabScene } from '@/src/components/FloatingTabBar';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';

const isCustomerRole = (role?: string) => !role || role === 'user' || role === 'customer';

export default function CustomerTabsLayout() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user === null) router.replace('/login');
    else if (user && !isCustomerRole(user.role)) router.replace('/');
    else if (user && user.legal_accepted !== true) router.replace('/legal-consent');
  }, [user, router]);

  if (!user || !isCustomerRole(user.role) || user.legal_accepted !== true) return null;

  return (
    <TabBarVisibilityProvider>
    <Tabs
      screenLayout={({ children, route }) => <TabScene routeKey={route.key}><View style={{ flex: 1, marginBottom: 112 }}>{children}</View></TabScene>}
      tabBar={props => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="home" options={{ title: 'Reise' }} />
      <Tabs.Screen name="history" options={{ title: 'Aktivitet' }} />
      <Tabs.Screen name="wallet" options={{ title: 'Lommebok' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
      <Tabs.Screen name="assist" options={{ href: null }} />
    </Tabs>
    </TabBarVisibilityProvider>
  );
}

