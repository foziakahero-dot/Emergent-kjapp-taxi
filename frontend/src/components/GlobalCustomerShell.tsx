import { Island } from './snar10/Island';
import React, { useEffect, useState } from 'react';
import { AppState, BackHandler, View } from 'react-native';
import { router, useSegments } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/src/context/AuthContext';
import { FloatingTabBar, TabBarVisibilityProvider, TabScene } from '@/src/components/FloatingTabBar';
import { tripsApi } from '@/src/lib/api';
import { driverPresence } from '@/src/lib/tripPresence';
import { useColorTheme } from '@/src/theme';

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

function JourneyIsland({ trip, stale, onPress }: { trip: ActiveTripSummary; stale: boolean; onPress: () => void }) {
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
  const eta = !stale && !staleGps && typeof trip.eta_min === 'number' && Number.isFinite(trip.eta_min)
    && trip.eta_min > 0 && trip.status === 'driver_on_way' ? String(Math.ceil(trip.eta_min)) : undefined;
  return <Island testID="customer-journey-island" title={labels[trip.status] || 'Aktiv tur'}
    sub={stale ? 'Status ikke oppdatert' : subtitle} eta={eta}
    icon={trip.status === 'in_trip' ? 'trip' : trip.status === 'searching' || trip.status === 'booking' ? 'ai' : 'vehicle'}
    live={!stale && !staleGps} progress={progress[trip.status] ?? .12} onClick={onPress} />;
}

export function GlobalCustomerShell({ children }: { children: React.ReactNode }) {
  useColorTheme();
  const { user } = useAuth();
  const segments = useSegments();
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
  return <TabBarVisibilityProvider><View style={{ flex: 1 }}>
    <TabScene routeKey="global-detail">{children}</TabScene>
    {visible ? <FloatingTabBar {...(props as any)} /> : null}
    {canShowIsland && islandTrip ? <JourneyIsland
      trip={islandTrip}
      stale={activeTripQuery.isError}
      onPress={() => {
        void queryClient.invalidateQueries({ queryKey: ['customer-active-trip', user?.id] });
        router.push(`/booking/${islandTrip.trip_id}`);
      }}
    /> : null}
  </View></TabBarVisibilityProvider>;
}
