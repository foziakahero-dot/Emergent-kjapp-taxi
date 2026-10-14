import React, { createContext, useCallback, useContext, useEffect, useRef, useState, type RefObject } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BlurTargetView, BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Text } from '@/src/components/Typography';
import { V10Icon } from '@/src/components/V10Icon';
import { Icon } from '@/src/components/Icon';
import { colors, font, useColorTheme } from '@/src/theme';

type Target = RefObject<View | null>;
const Visibility = createContext({ hidden: false, setHidden: (_hidden: boolean) => {}, targets: {} as Record<string, Target>, registerTarget: (_key: string, _target?: Target) => {} });
export function TabBarVisibilityProvider({ children }: { children: React.ReactNode }) {
  useColorTheme();
  const [hidden, setHidden] = useState(false);
  const [targets, setTargets] = useState<Record<string, Target>>({});
  const registerTarget = useCallback((key: string, target?: Target) => setTargets(previous => {
    const next = { ...previous };
    if (target) next[key] = target; else delete next[key];
    return next;
  }), []);
  return <Visibility.Provider value={{ hidden, setHidden, targets, registerTarget }}>{children}</Visibility.Provider>;
}
export function TabScene({ routeKey, children }: { routeKey: string; children: React.ReactNode }) {
  useColorTheme();
  const target = useRef<View>(null);
  const { registerTarget } = useContext(Visibility);
  useEffect(() => { registerTarget(routeKey, target); return () => registerTarget(routeKey); }, [registerTarget, routeKey]);
  return <BlurTargetView ref={target} style={{ flex: 1 }}>{children}</BlurTargetView>;
}
export function useHideTabBar(hidden: boolean) {
  const { setHidden } = useContext(Visibility);
  useEffect(() => { setHidden(hidden); return () => setHidden(false); }, [hidden, setHidden]);
}

export function FloatingTabBar({ state, descriptors, navigation, driver = false }: BottomTabBarProps & { driver?: boolean }) {
  const theme = useColorTheme();
  const insets = useSafeAreaInsets();
  const { hidden, targets } = useContext(Visibility);
  const focused = state.routes[state.index];
  if (hidden) return null;
  const customerScreens = ['home', 'history', 'assist', 'messages', 'profile'];
  const visible = state.routes.filter(route => (driver ? ['home', 'earnings', 'profile'] : customerScreens).includes(route.name));
  const icons: Record<string, React.ComponentProps<typeof Icon>['name']> = {
    home: 'home', history: 'history', assist: 'sparkles', messages: 'message', profile: 'user',
    earnings: 'trending-up',
  };
  return <View style={{ position: 'absolute', left: 16, right: 16, bottom: driver ? insets.bottom + 16 : Math.max(22, insets.bottom + 6), borderRadius: 24, boxShadow: '0 12px 32px rgba(11,26,44,0.12)' }}>
    <View style={{ height: 66, overflow: 'hidden', borderRadius: 24, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.glass, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }}>
      <BlurView blurTarget={targets[focused.key]} blurMethod="dimezisBlurViewSdk31Plus" intensity={44} tint={theme.effective === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} pointerEvents="none" />
      {visible.map(route => {
        const options = descriptors[route.key].options;
        const selected = focused.key === route.key;
        const isAssistant = !driver && route.name === 'assist';
        const color = isAssistant ? colors.onInverse : selected ? colors.text : colors.textMuted;
        const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : options.title || route.name;
        return <Pressable key={route.key} accessibilityRole="tab" accessibilityLabel={options.tabBarAccessibilityLabel || label} accessibilityState={{ selected }}
          testID={`tab-${route.name}`} onPress={() => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!selected && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          }} onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
          style={({ pressed }) => ({ flex: driver ? 1 : undefined, width: driver ? undefined : isAssistant ? 52 : 58, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 3, transform: [{ scale: pressed ? (driver ? .97 : .9) : 1 }] })}>
          {selected && !driver && !isAssistant ? <View style={{ position: 'absolute', bottom: 2, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent }} /> : null}
          <View style={isAssistant ? { width: 52, height: 52, borderRadius: 17, backgroundColor: colors.surfaceInverse, alignItems: 'center', justifyContent: 'center' } : undefined}>
            {driver ? <Icon name={icons[route.name] || 'user'} size={20} color={color} /> : <V10Icon name={({home:'home',history:'activity',assist:'ai',messages:'message',profile:'profile'} as Record<string,string>)[route.name] || 'profile'} size={isAssistant ? 24 : 22} color={color} />}
          </View>
          {!isAssistant ? <Text style={{ color: driver ? (selected ? colors.accent : colors.textMuted) : color, fontFamily: font.medium, fontSize: 10.5, lineHeight: 14 }}>{label}</Text> : null}
        </Pressable>;
      })}
    </View>
  </View>;
}
