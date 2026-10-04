import React from 'react';
import { Platform } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
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

export default function DriverTabsLayout() {
  const { user } = useAuth();

  if (user === undefined) return null;
  if (!user || user.role !== 'driver' || user.approved !== true) {
    return <Redirect href="/" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.online,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.driverCard,
          borderTopColor: colors.line,
          borderTopWidth: 1,
          ...(Platform.OS === 'web' ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: 'center' },
        tabBarLabelStyle: { fontSize: 11, fontFamily: font.body },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Kjør', tabBarIcon: tab('car') }} />
      <Tabs.Screen name="earnings" options={{ title: 'Inntekt', tabBarIcon: tab('trending-up') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: tab('user') }} />
    </Tabs>
  );
}
