import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/src/context/AuthContext';
import { driverApi } from '@/src/lib/api';
import { confirmedTripIncome, groupHistory, historyDate, historyTrips, tripStatusLabel } from '@/src/lib/driverHistory';
import { kr } from '@/src/lib/format';
import { Text } from '@/src/components/Typography';
import { V10Icon } from '@/src/components/V10Icon';
import { V10Group, V10Header, V10Screen, V10Section, V10State, v10 } from '@/src/components/V10UI';
import { Loader } from '@/src/components/ui';
import { V10Entrance } from '@/src/components/V10Entrance';
import { colors, useColorTheme } from '@/src/theme';

export default function DriverTrips() {
  useColorTheme();
  const router = useRouter();
  const { user } = useAuth();
  const history = useQuery({ queryKey: ['driver-history', user?.id], queryFn: driverApi.history, enabled: !!user?.id });
  const trips = historyTrips(history.data);
  return <V10Screen dock testID="driver-activity-screen"><V10Entrance fade><V10Header title="Turer" onBack={() => router.back()} />
    {history.isPending ? <Loader label="Henter turer…" /> : history.isError ? <V10State icon="wifiOff" warning title="Kunne ikke hente turhistorikken" body="Sjekk forbindelsen og prøv igjen." action="Prøv igjen" onAction={() => void history.refetch()} /> : !trips.length ? <View style={{ marginTop: 24 }}><V10State icon="activity" title="Ingen turer ennå" body="Turene du har kjørt, vises her." action="Til cockpit" onAction={() => router.navigate('/(driver)/home')} /></View> : groupHistory(trips).map(group =>
      <V10Section key={group.title} title={group.title}><V10Group>{group.trips.map((trip, index) => {
        const income = confirmedTripIncome(trip);
        const cancelled = ['cancelled', 'cancelled_by_driver'].includes(trip.status || '');
        return <Pressable key={trip.trip_id} testID={`driver-history-trip-${trip.trip_id}`} accessibilityRole="button" onPress={() => router.push(`/driver-trip/${encodeURIComponent(trip.trip_id!)}` as any)} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          {index ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: colors.line }} /> : null}
          <View style={v10.icon}><V10Icon name={cancelled ? 'x' : 'trip'} size={20} /></View>
          <View style={{ flex: 1 }}><Text style={[v10.body, { fontSize: 15 }]} numberOfLines={2}>{trip.pickup_address || 'Hentested skjult'} → {trip.dropoff_address || 'Destinasjon skjult'}</Text>
            <Text style={[v10.caption, { fontVariant: ['tabular-nums'] }]}>{historyDate(trip.created_at, true)} · {tripStatusLabel(trip)}</Text></View>
          <Text style={[v10.body, { fontVariant: ['tabular-nums'] }]}>{income !== null ? kr(income) : cancelled ? '—' : 'Avventer'}</Text>
        </Pressable>;
      })}</V10Group></V10Section>)}
  </V10Entrance></V10Screen>;
}
