import React from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Icon, IconName } from '@/src/components/Icon';
import { colors, font } from '@/src/theme';

function tab(name: IconName) {
  const TabIcon = ({ color, size }: { color: string; size: number }) => (
    <Icon name={name} size={size ?? 22} color={color} />
  );
  TabIcon.displayName = `TabIcon(${name})`;
  return TabIcon;
}

export default function CustomerTabsLayout() {
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
      <Tabs.Screen name="assist" options={{ title: 'Assist', tabBarIcon: tab('sparkles') }} />
      <Tabs.Screen name="history" options={{ title: 'Turer', tabBarIcon: tab('history') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: tab('user') }} />
    </Tabs>
  );
}
