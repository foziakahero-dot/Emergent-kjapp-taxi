import React, { createContext, useCallback, useContext, useEffect, useRef, useState, type RefObject } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BlurTargetView, BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Text } from '@/src/components/Typography';
import { Icon } from '@/src/components/Icon';
import { colors, font } from '@/src/theme';

type Target = RefObject<View | null>;
const Visibility = createContext({ hidden: false, setHidden: (_hidden: boolean) => {}, targets: {} as Record<string, Target>, registerTarget: (_key: string, _target?: Target) => {} });
export function TabBarVisibilityProvider({ children }: { children: React.ReactNode }) {
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
  return <View style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 16, borderRadius: 24, boxShadow: '0 12px 32px rgba(11,26,44,0.12)' }}>
    <View style={{ height: 66, overflow: 'hidden', borderRadius: 24, borderWidth: 1, borderColor: colors.line, backgroundColor: driver ? 'rgba(255,255,255,0.94)' : 'rgba(255,255,255,0.86)', paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }}>
      <BlurView blurTarget={targets[focused.key]} blurMethod="dimezisBlurViewSdk31Plus" intensity={44} tint="light" style={StyleSheet.absoluteFill} pointerEvents="none" />
      {visible.map(route => {
        const options = descriptors[route.key].options;
        const selected = focused.key === route.key;
        const isAssistant = !driver && route.name === 'assist';
        const color = isAssistant ? '#FFFFFF' : selected ? colors.text : colors.textMuted;
        const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : options.title || route.name;
        return <Pressable key={route.key} accessibilityRole="tab" accessibilityLabel={options.tabBarAccessibilityLabel || label} accessibilityState={{ selected }}
          testID={`tab-${route.name}`} onPress={() => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!selected && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          }} onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
          style={({ pressed }) => ({ flex: 1, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 3, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
          {selected && !driver && !isAssistant ? <View style={{ position: 'absolute', bottom: 1, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent }} /> : null}
          <View style={isAssistant ? { width: 52, height: 52, borderRadius: 17, backgroundColor: colors.surfaceInverse, alignItems: 'center', justifyContent: 'center' } : undefined}>
            <Icon name={icons[route.name] || 'user'} size={20} color={color} />
          </View>
          {!isAssistant ? <Text style={{ color: driver ? (selected ? colors.accent : colors.textMuted) : color, fontFamily: font.medium, fontSize: 10.5, lineHeight: 14 }}>{label}</Text> : null}
        </Pressable>;
      })}
    </View>
  </View>;
}
