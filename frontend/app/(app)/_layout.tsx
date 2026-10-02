import React, { useEffect } from 'react';
import { Platform, type ColorValue } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Icon, IconName } from '@/src/components/Icon';
import { colors, font } from '@/src/theme';
import { useAuth } from '@/src/context/AuthContext';

const isCustomerRole = (role?: string) => !role || role === 'user' || role === 'customer';

function tab(name: IconName) {
  const TabIcon = ({ color, size }: { color: ColorValue; size: number }) => (
    <Icon name={name} size={size ?? 22} color={color as string} />
  );
  TabIcon.displayName = `TabIcon(${name})`;
  return TabIcon;
}

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
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 14,
          height: 70,
          borderRadius: 26,
          backgroundColor: 'rgba(255,255,255,0.96)',
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: colors.line,
          shadowColor: '#0B0E14',
          shadowOpacity: 0.14,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 10 },
          elevation: 10,
          ...(Platform.OS === 'web' ? { height: 68 } : {}),
        },
        tabBarItemStyle: { alignSelf: 'center' },
        tabBarLabelStyle: { fontSize: 11, fontFamily: font.body },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Reise', tabBarIcon: tab('car') }} />
      <Tabs.Screen name="history" options={{ title: 'Aktivitet', tabBarIcon: tab('history') }} />
      <Tabs.Screen name="wallet" options={{ title: 'Lommebok', tabBarIcon: tab('wallet') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: tab('user') }} />
      <Tabs.Screen name="assist" options={{ href: null }} />
    </Tabs>
  );
}
