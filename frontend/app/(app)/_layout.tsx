import React from 'react';
import { Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName } from '@/src/components/Icon';
import { colors } from '@/src/theme';

const ICONS: Record<string, IconName> = {
  home: 'navigation',
  history: 'history',
  profile: 'user',
};

function SignatureDock({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        paddingBottom: Math.max(insets.bottom, 10),
      }}
    >
      <View
        style={{
          height: 58,
          minWidth: 190,
          borderRadius: 29,
          paddingHorizontal: 8,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          backgroundColor: 'rgba(8,13,17,0.94)',
          borderWidth: 1,
          borderColor: colors.lineStrong,
          shadowColor: '#000',
          shadowOpacity: 0.35,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 8 },
          elevation: 16,
        }}
      >
        {state.routes.map((route: any, index: number) => {
          const active = state.index === index;
          return (
            <Pressable
              key={route.key}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                navigation.navigate(route.name);
              }}
              accessibilityRole="button"
              accessibilityState={active ? { selected: true } : {}}
              style={({ pressed }) => ({
                width: 50,
                height: 46,
                borderRadius: 23,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? colors.accentSoft : 'transparent',
                opacity: pressed ? 0.72 : 1,
                borderWidth: active ? 1 : 0,
                borderColor: active ? 'rgba(203,163,101,0.28)' : 'transparent',
              })}
            >
              <Icon
                name={ICONS[route.name] || 'circle-dot'}
                size={20}
                color={active ? colors.accent : colors.textMuted}
                strokeWidth={active ? 2.25 : 1.8}
              />
              {active ? (
                <View
                  style={{
                    position: 'absolute',
                    bottom: 4,
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: colors.accent,
                  }}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function CustomerTabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <SignatureDock {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="home" options={{ title: 'Hjem' }} />
      <Tabs.Screen name="history" options={{ title: 'Turer' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
    </Tabs>
  );
}
