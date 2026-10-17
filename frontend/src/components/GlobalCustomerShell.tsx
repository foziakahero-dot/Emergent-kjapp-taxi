import React, { useEffect, useState } from 'react';
import { AppState, BackHandler, Pressable, View } from 'react-native';
import { router, useSegments } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { FloatingTabBar } from '@/src/components/FloatingTabBar';
import { Text } from '@/src/components/Typography';
import { Icon } from '@/src/components/Icon';
import { tripsApi } from '@/src/lib/api';
import { driverPresence } from '@/src/lib/tripPresence';
import { colors, font, useColorTheme } from '@/src/theme';

const routes = ['home', 'history', 'assist', 'messages', 'profile'].map(name => ({ name, key: `global-${name}` }));
const titles = ['Hjem', 'Aktivitet', 'SNAR AI', 'Meldinger', 'Profil'];
const authScreens = new Set(['index', 'login', 'register', 'forgot-password', 'reset-password', 'legal-consent', 'permissions', 'profile-setup']);
const islandTripStatuses = new Set(['payment_authorizing', 'searching', 'booking', 'driver_on_way', 'at_pickup', 'in_trip']);

type ActiveTripSummary = {
  trip_id: string;
  status: string;
  eta_min?: number;
  driver?: { name?: string; car?: string; plate?: string };
};

function JourneyIsland({ trip, stale, bottomInset, onPress }: { trip: ActiveTripSummary; stale: boolean; bottomInset: number; onPress: () => void }) {
  useColorTheme();
  const labels: Record<string, string> = {
    payment_authorizing: 'Bekrefter kortreservasjon',
    searching: 'Søker sjåfør',
    booking: 'Bestiller tur',
    driver_on_way: 'Sjåfør på vei',
    at_pickup: 'Sjåføren er fremme',
    in_trip: 'Turen pågår',
  };
  const staleGps = ['driver_on_way', 'at_pickup', 'in_trip'].includes(trip.status) && !driverPresence(trip).fresh;
  const subtitle = trip.driver?.name
    ? [trip.driver.name, trip.driver.car, trip.driver.plate].filter(Boolean).join(' · ')
    : stale ? 'Venter på oppdatert turstatus' : staleGps ? 'Venter på oppdatert sjåførposisjon' : 'Trykk for å åpne turen';
  const progress: Record<string, number> = {
    payment_authorizing: 0.05, searching: 0.12, booking: 0.12, driver_on_way: 0.3,
    at_pickup: 0.45, in_trip: 0.7, arrived: 1,
  };
  return (
    <Pressable
      testID="customer-journey-island"
      accessibilityRole="button"
      accessibilityLabel={`${labels[trip.status] || 'Aktiv tur'}. ${subtitle}`}
      onPress={onPress}
      style={({ pressed }) => ({
        position: 'absolute', left: 16, right: 16, bottom: bottomInset + 98, zIndex: 41,
        height: 60, borderRadius: 20, paddingHorizontal: 10,
        backgroundColor: colors.surfaceInverse, flexDirection: 'row', alignItems: 'center', gap: 12,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(127,127,127,0.18)', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={trip.status === 'searching' || trip.status === 'booking' ? 'sparkles' : 'car'} size={20} color={colors.onInverse} />
        {!stale && !staleGps ? <View style={{ position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accent, borderWidth: 2, borderColor: colors.surfaceInverse }} /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: colors.onInverse, fontFamily: font.semibold, fontSize: 14.5, lineHeight: 19 }}>
          {labels[trip.status] || 'Aktiv tur'}
        </Text>
        <Text numberOfLines={1} style={{ color: '#C6CED8', fontSize: 12.5, lineHeight: 16 }}>
          {stale ? 'Status ikke oppdatert' : subtitle}
        </Text>
      </View>
      {!stale && !staleGps && Number.isFinite(Number(trip.eta_min)) && Number(trip.eta_min) > 0 && trip.status === 'driver_on_way'
        ? <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}><Text style={{ color: colors.onInverse, fontFamily: font.semibold, fontSize: 22, lineHeight: 26 }}>{Math.ceil(Number(trip.eta_min))}</Text><Text style={{ color: '#C6CED8', fontSize: 12 }}>min</Text></View>
        : <Icon name="chevron-up" size={18} color="#C6CED8" />}
      <View style={{ position: 'absolute', left: 14, right: 14, bottom: 0, height: 2, borderRadius: 2, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.16)' }}>
        <View style={{ width: `${(progress[trip.status] || 0.12) * 100}%`, height: 2, backgroundColor: colors.accent }} />
      </View>
    </Pressable>
  );
}

export function GlobalCustomerShell({ children }: { children: React.ReactNode }) {
  useColorTheme();
  const { user } = useAuth();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const first = String(segments[0] || 'index');
  const customer = user && (!user.role || ['user', 'customer'].includes(user.role));
  const visible = !!customer && user?.legal_accepted === true && first !== '(app)' && !authScreens.has(first);
  const canShowIsland = !!customer && user?.legal_accepted === true && !authScreens.has(first) && first !== 'booking';
  const activeTripQuery = useQuery<ActiveTripSummary | null>({
    queryKey: ['customer-active-trip', user?.id],
    queryFn: async () => {
      const trip = await tripsApi.active();
      return trip?.trip_id ? trip : null;
    },
    enabled: canShowIsland && appActive,
    refetchInterval: 1000,
    refetchIntervalInBackground: false,
    retry: 1,
  });

  useEffect(() => {
    setAppActive(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', state => setAppActive(state === 'active'));
    return () => subscription.remove();
  }, []);

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
  const trip = activeTripQuery.data;
  const islandTrip = trip && islandTripStatuses.has(trip.status) ? trip : null;
  useEffect(() => {
    if (canShowIsland && trip && ['searching', 'booking'].includes(trip.status) && !(trip as any).driver_id) {
      router.replace(`/booking/${trip.trip_id}`);
    }
  }, [canShowIsland, trip?.trip_id, trip?.status]);
  return <View style={{ flex: 1, paddingBottom: visible ? 112 : 0 }}>
    {children}
    {visible ? <FloatingTabBar {...(props as any)} /> : null}
    {canShowIsland && islandTrip ? <JourneyIsland
      trip={islandTrip}
      stale={activeTripQuery.isError}
      bottomInset={insets.bottom}
      onPress={() => {
        void queryClient.invalidateQueries({ queryKey: ['customer-active-trip', user?.id] });
        router.push(`/booking/${islandTrip.trip_id}`);
      }}
    /> : null}
  </View>;
}
