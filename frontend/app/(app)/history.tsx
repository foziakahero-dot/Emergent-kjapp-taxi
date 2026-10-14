import { V10Entrance } from '@/src/components/V10Entrance';
import { thisOsloWeek } from '@/src/lib/osloCalendar';
import React, { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/src/context/AuthContext';
import { tripsApi } from '@/src/lib/api';
import { kr, vehicleMeta } from '@/src/lib/format';
import { Text } from '@/src/components/Typography';
import { V10Icon } from '@/src/components/V10Icon';
import { V10Badge, V10Group, V10Screen, V10Section, V10State, v10 } from '@/src/components/V10UI';
import { Loader } from '@/src/components/ui';
import { colors, font, useColorTheme } from '@/src/theme';

const liveStatuses = new Set(['payment_authorizing', 'searching', 'booking', 'driver_on_way', 'at_pickup', 'in_trip']);
export default function History() {
  useColorTheme();
  const router = useRouter();
  const { user } = useAuth();
  const history = useQuery({ queryKey: ['trips', user?.id], queryFn: tripsApi.list, enabled: !!user?.id });
  const active = useQuery({ queryKey: ['customer-active-trip', user?.id], queryFn: tripsApi.active, enabled: !!user?.id });
  useFocusEffect(useCallback(() => { void history.refetch(); void active.refetch(); }, [history.refetch, active.refetch]));
  const trips: any[] = Array.isArray(history.data?.trips) ? history.data.trips : [];
  const past = trips.filter(trip => !liveStatuses.has(trip.status));
  const live = active.data?.trip_id && liveStatuses.has(active.data.status) ? active.data : null;
  const groups = [{ title: 'Denne uken', trips: past.filter(trip => thisOsloWeek(trip.created_at)) }, { title: 'Tidligere', trips: past.filter(trip => !(thisOsloWeek(trip.created_at))) }].filter(group => group.trips.length);
  return <V10Screen dock testID="customer-activity-screen"><V10Entrance>
    <Text style={{ color: colors.text, fontFamily: font.semibold, fontSize: 32, lineHeight: 38, letterSpacing: -.96, marginTop: 8, marginBottom: 20 }}>Aktivitet</Text>
    {live && !active.isError ? <Pressable accessibilityRole="button" testID="history-active-trip" onPress={() => router.push(`/booking/${live.trip_id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 22, padding: 16, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.text }}><V10Badge tone="critical">Pågår</V10Badge><Text style={[v10.body, { flex: 1 }]}>Til {live.dropoff_address || 'destinasjonen din'}</Text><V10Icon name="chevR" size={18} /></Pressable> : null}
    {active.isError ? <Text style={v10.caption}>Kunne ikke oppdatere aktiv tur.</Text> : null}
    {history.isPending ? <Loader label="Henter turer…" /> : history.isError ? <V10State icon="wifiOff" warning title="Kunne ikke hente turhistorikken" body="Sjekk forbindelsen og prøv igjen." action="Prøv igjen" onAction={() => void history.refetch()} /> : !past.length ? <View style={{ marginTop: 24 }}><V10State icon="activity" title="Ingen turer ennå" body="Gjennomførte og avbrutte turer vises her." action="Til hjem" onAction={() => router.navigate('/(app)/home')} /></View> : groups.map(group => <V10Section key={group.title} title={group.title}><V10Group>{group.trips.map((trip, index) => {
      const id = trip.trip_id || trip.id;
      const cancelled = ['cancelled', 'cancelled_by_driver'].includes(trip.status);
      const date = new Date(trip.created_at);
      const label = cancelled ? 'Avbrutt' : trip.payment_status === 'paid' ? 'Fullført' : 'Betaling behandles';
      return <Pressable key={id || index} accessibilityRole="button" testID={`trip-${id || 'unknown'}`} disabled={!id} onPress={() => router.push(`/customer-trip/${encodeURIComponent(id)}` as any)} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14, opacity: cancelled ? .7 : 1 }}>
        {index ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: colors.line }} /> : null}
        <View style={v10.icon}><V10Icon name={cancelled ? 'x' : 'destination'} size={20} /></View>
        <View style={{ flex: 1 }}><Text style={[v10.body, cancelled && { textDecorationLine: 'line-through' }]} numberOfLines={2}>{trip.dropoff_address || 'SNAR-tur'}</Text><Text style={v10.caption}>{Number.isFinite(date.getTime()) ? date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', timeZone: 'Europe/Oslo' }) + ' ' + date.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Oslo' }) : 'Dato mangler'} · {vehicleMeta(trip.vehicle_type || 'ai-first').name}</Text></View>
        <View style={{ alignItems: 'flex-end' }}><Text style={v10.body}>{cancelled ? '—' : kr(trip.price)}</Text><Text style={v10.caption}>{label}</Text></View>
      </Pressable>;
    })}</V10Group></V10Section>)}
  </V10Entrance></V10Screen>;
}
