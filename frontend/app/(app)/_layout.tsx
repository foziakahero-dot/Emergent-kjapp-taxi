import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Icon, IconName } from '@/src/components/Icon';
import { colors, font } from '@/src/theme';
import { useAuth } from '@/src/context/AuthContext';

function tab(name: IconName) {
  const TabIcon = ({ color, size }: { color: string; size: number }) => (
    <Icon name={name} size={size ?? 22} color={color} />
  );
  TabIcon.displayName = `TabIcon(${name})`;
  return TabIcon;
}

export default function CustomerTabsLayout() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user === null) router.replace('/login');
    else if (user && user.legal_accepted !== true) router.replace('/legal-consent');
  }, [user, router]);

  if (!user || user.legal_accepted !== true) return null;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          borderTopWidth: 1,
          ...(Platform.OS === 'web' ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: 'center' },
        tabBarLabelStyle: { fontSize: 11, fontFamily: font.body },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Hjem', tabBarIcon: tab('navigation') }} />
      <Tabs.Screen name="history" options={{ title: 'Turer', tabBarIcon: tab('history') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: tab('user') }} />
      <Tabs.Screen name="assist" options={{ href: null }} />
    </Tabs>
  );
}
