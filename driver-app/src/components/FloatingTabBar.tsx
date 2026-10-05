import React, { createContext, useCallback, useContext, useEffect, useRef, useState, type RefObject } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BlurTargetView, BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
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

const customerGlyphs: Record<string, React.ReactNode> = {
  home: <><Path d="M5 11l1.5-4.5A2 2 0 018.4 5h7.2a2 2 0 011.9 1.5L19 11" /><Rect x={4} y={11} width={16} height={6} rx={2} /><Circle cx={8} cy={19} r={1.4} fill="currentColor" stroke="none" /><Circle cx={16} cy={19} r={1.4} fill="currentColor" stroke="none" /></>,
  history: <Path d="M3 12h4l2 6 4-14 2 8h6" />,
  wallet: <><Rect x={3} y={6} width={18} height={13} rx={3} /><Path d="M3 10h18" /><Circle cx={16.5} cy={14.5} r={1.3} fill="currentColor" stroke="none" /></>,
  profile: <><Circle cx={12} cy={9} r={3.2} /><Path d="M5.5 19a6.5 6.5 0 0113 0" /></>,
};

export function FloatingTabBar({ state, descriptors, navigation, driver = false }: BottomTabBarProps & { driver?: boolean }) {
  const insets = useSafeAreaInsets();
  const { hidden, targets } = useContext(Visibility);
  const focused = state.routes[state.index];
  if (hidden && focused.name === 'home') return null;
  const visible = state.routes.filter(route => (driver ? ['home', 'earnings', 'profile'] : ['home', 'history', 'wallet', 'profile']).includes(route.name));
  return <View style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 16, borderRadius: 26, boxShadow: '0 16px 40px rgba(11,14,20,0.14)' }}>
    <View style={{ overflow: 'hidden', borderRadius: 26, borderWidth: 1, borderColor: colors.line, backgroundColor: driver ? 'rgba(255,255,255,0.94)' : 'rgba(255,255,255,0.92)', paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row' }}>
      <BlurView blurTarget={targets[focused.key]} blurMethod="dimezisBlurViewSdk31Plus" intensity={44} tint="light" style={StyleSheet.absoluteFill} pointerEvents="none" />
      {visible.map(route => {
        const options = descriptors[route.key].options;
        const selected = focused.key === route.key;
        const color = selected ? colors.accent : colors.textMuted;
        const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : options.title || route.name;
        return <Pressable key={route.key} accessibilityRole="tab" accessibilityLabel={options.tabBarAccessibilityLabel || label} accessibilityState={{ selected }}
          testID={`tab-${route.name}`} onPress={() => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!selected && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          }} onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
          style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 6, transform: [{ scale: pressed ? 0.95 : 1 }] })}>
          {selected && !driver && <View style={{ position: 'absolute', top: -2, width: 24, height: 4, borderRadius: 2, backgroundColor: colors.accent }} />}
          {driver ? <Icon name={route.name === 'home' ? 'home' : route.name === 'earnings' ? 'trending-up' : 'user'} size={20} color={color} /> :
            <Svg width={20} height={20} viewBox="0 0 24 24" color={color} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">{customerGlyphs[route.name]}</Svg>}
          <Text style={{ color, fontFamily: font.medium, fontSize: 10, lineHeight: 15, letterSpacing: driver ? 0 : 0.25 }}>{label}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}
