import { Dock } from './snar10/Dock';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState, type RefObject } from 'react';
import { View } from 'react-native';
import { BlurTargetView } from 'expo-blur';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { colors, useColorTheme } from '@/src/theme';

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
  return <BlurTargetView ref={target} style={{ flex: 1, backgroundColor: colors.bg }}>{children}</BlurTargetView>;
}
export function useHideTabBar(hidden: boolean) {
  const { setHidden } = useContext(Visibility);
  useEffect(() => { setHidden(hidden); return () => setHidden(false); }, [hidden, setHidden]);
}

export function FloatingTabBar({ state, descriptors, navigation, driver = false }: BottomTabBarProps & { driver?: boolean }) {
  useColorTheme();
  const { hidden, targets } = useContext(Visibility);
  const focused = state.routes[state.index];
  if (hidden && (!driver || focused.name === 'home')) return null;
  const visible = state.routes.filter(route => (driver
    ? ['home', 'earnings', 'intel', 'messages', 'profile']
    : ['home', 'history', 'assist', 'messages', 'profile']).includes(route.name));
  const customerIcons: Record<string, string> = { home: 'home', history: 'activity', assist: 'ai', messages: 'message', profile: 'profile' };
  const driverIcons: Record<string, string> = { home: 'navigation', earnings: 'earnings', intel: 'ai', messages: 'message', profile: 'profile' };
  return <Dock target={targets[focused.key]} active={focused.name} items={visible.map(route => {
    const options = descriptors[route.key].options;
    return { id: route.name, label: typeof options.tabBarLabel === 'string' ? options.tabBarLabel : options.title || route.name,
      icon: (driver ? driverIcons : customerIcons)[route.name] || 'profile', ai: route.name === (driver ? 'intel' : 'assist'),
      accessibilityLabel: options.tabBarAccessibilityLabel, testID: `tab-${route.name}` };
  })} onSelect={name => {
    const route = visible.find(item => item.name === name);
    if (!route) return;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (focused.key !== route.key && !event.defaultPrevented) navigation.navigate(route.name, route.params);
  }} onLongPress={name => {
    const route = visible.find(item => item.name === name);
    if (route) navigation.emit({ type: 'tabLongPress', target: route.key });
  }} />;
}
