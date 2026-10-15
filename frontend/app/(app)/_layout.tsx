import { FloatingTabBar, TabBarVisibilityProvider, TabScene } from '@/src/components/FloatingTabBar';
import React, { useEffect } from 'react';
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
      screenLayout={({ children, route }) => <TabScene routeKey={route.key}>{children}</TabScene>}
      tabBar={props => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="home" options={{ title: 'Hjem' }} />
      <Tabs.Screen name="history" options={{ title: 'Aktivitet' }} />
      <Tabs.Screen name="assist" options={{ title: 'SNAR AI' }} />
      <Tabs.Screen name="messages" options={{ title: 'Meldinger' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
      <Tabs.Screen name="wallet" options={{ href: null }} />
    </Tabs>
    </TabBarVisibilityProvider>
  );
}
