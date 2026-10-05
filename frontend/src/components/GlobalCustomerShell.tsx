import React, { useEffect } from 'react';
import { BackHandler, View } from 'react-native';
import { router, useSegments } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { FloatingTabBar } from '@/src/components/FloatingTabBar';

const routes = ['home', 'history', 'wallet', 'profile'].map(name => ({ name, key: `global-${name}` }));
const titles = ['Reise', 'Aktivitet', 'Lommebok', 'Profil'];
const authScreens = new Set(['index', 'login', 'register', 'forgot-password', 'reset-password', 'legal-consent', 'permissions', 'profile-setup']);

export function GlobalCustomerShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const segments = useSegments();
  const first = String(segments[0] || 'index');
  const customer = user && (!user.role || ['user', 'customer'].includes(user.role));
  const visible = !!customer && user?.legal_accepted === true && first !== '(app)' && !authScreens.has(first);
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/(app)/home'); return true;
    });
    return () => sub.remove();
  }, [visible]);
  const current = { name: 'detail', key: 'global-detail' };
  const descriptors = Object.fromEntries(routes.map((route, i) => [route.key, { options: { title: titles[i] } }]));
  const props = {
    state: { index: routes.length, routes: [...routes, current] }, descriptors,
    navigation: {
      emit: () => ({ defaultPrevented: false }),
      navigate: (name: string) => router.replace(`/(app)/${name}` as any),
    },
  };
  return <View style={{ flex: 1, paddingBottom: visible ? 112 : 0 }}>
    {children}
    {visible ? <FloatingTabBar {...(props as any)} /> : null}
  </View>;
}
