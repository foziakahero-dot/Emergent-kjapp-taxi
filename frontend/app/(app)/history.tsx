import { V10Entrance } from '@/src/components/V10Entrance';
import { thisOsloWeek } from '@/src/lib/osloCalendar';
import React, { useCallback, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/src/context/AuthContext';
import { tripsApi } from '@/src/lib/api';
import { apiError, kr, vehicleMeta } from '@/src/lib/format';
import { cancellationFee, cancellationTerms, cancelledTrip, CUSTOMER_CANCELLABLE_STATUSES } from '@/src/lib/customerCancellation';
import { driverPresence } from '@/src/lib/tripPresence';
import { Text } from '@/src/components/Typography';
import { V10Icon } from '@/src/components/V10Icon';
import { V10Action, V10Badge, V10Group, V10Screen, V10Section, V10State, v10 } from '@/src/components/V10UI';
import { Loader } from '@/src/components/ui';
import { colors, font, useColorTheme } from '@/src/theme';

const liveLabels: Record<string, string> = {
  payment_authorizing: 'Venter på kortgodkjenning',
  searching: 'Søker sjåfør',
  booking: 'Bestiller',
  driver_on_way: 'Sjåfør på vei',
  at_pickup: 'Sjåføren er fremme',
  in_trip: 'Pågår',
};

function ActivityTripCancellation({ tripId, searching, onRefresh }: {
  tripId: string; searching: boolean; onRefresh: (cancelled: boolean) => void;
}) {
  const [fee, setFee] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const focus = useRef(0);
  useFocusEffect(useCallback(() => {
    setFee(null);
    setError('');
    return () => { focus.current++; };
  }, []));

  const run = async (approvedFee: number | null) => {
    if (lock.current) return;
    lock.current = true;
    const currentFocus = focus.current;
    setBusy(true);
    setError('');
    let submitted = false;
    try {
      const confirmedFee = await cancellationFee(tripId);
      if (focus.current !== currentFocus) return;
      if (approvedFee === null || approvedFee !== confirmedFee) {
        setFee(confirmedFee);
        return;
      }
      submitted = true;
      const result = await (searching ? tripsApi.cancelSearch(tripId) : tripsApi.cancel(tripId));
      if (result?.ok !== true) throw new Error('SNAR bekreftet ikke avbestillingen.');
      onRefresh(true);
      if (focus.current === currentFocus) setFee(null);
    } catch (error) {
      if (submitted) {
        const trip = await tripsApi.get(tripId).catch(() => null);
        if (cancelledTrip(trip?.status)) { onRefresh(true); return; }
      }
      onRefresh(false);
      if (focus.current === currentFocus) {
        setError(approvedFee === null ? `Kunne ikke hente avbestillingsvilkårene. ${apiError(error)}` : `Avbestillingen er ikke bekreftet. ${apiError(error)}`);
        setFee(null);
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return <View style={{ gap: 8 }}>
    {error ? <Text accessibilityRole="alert" style={[v10.caption, { color: colors.danger }]}>{error}</Text> : null}
    {fee === null ? <V10Action testID="history-cancel-trip" kind="soft" small label="Avbestill tur" busy={busy} onPress={() => void run(null)} />
      : <View style={{ gap: 8 }}><Text style={v10.body}>Avbestille turen?</Text>
        <Text testID="history-cancel-terms" accessibilityLiveRegion="polite" style={v10.secondary}>{cancellationTerms(fee)}</Text>
        <V10Action testID="history-cancel-confirm" kind="danger" small label={fee ? `Avbestill · ${kr(fee)}` : 'Bekreft avbestilling'} busy={busy} onPress={() => void run(fee)} />
        <V10Action testID="history-cancel-keep" kind="ghost" small label="Behold tur" disabled={busy} onPress={() => setFee(null)} />
      </View>}
  </View>;
}

export default function History() {
  useColorTheme();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const history = useQuery({ queryKey: ['trips', user?.id], queryFn: tripsApi.list, enabled: !!user?.id });
  const active = useQuery({ queryKey: ['customer-active-trip', user?.id], queryFn: tripsApi.active, enabled: false });
  useFocusEffect(useCallback(() => { void history.refetch(); void active.refetch(); }, [history.refetch, active.refetch]));
  const trips: any[] = Array.isArray(history.data) ? history.data : Array.isArray(history.data?.trips) ? history.data.trips : [];
  const past = trips.filter(trip => !Object.hasOwn(liveLabels, trip.status));
  const live = active.data?.trip_id && Object.hasOwn(liveLabels, active.data.status) ? active.data : null;
  const liveId = live?.trip_id;
  const refreshAfterCancellation = (cancelled: boolean) => {
    if (cancelled) queryClient.setQueryData(['customer-active-trip', user?.id], (trip: any) => trip?.trip_id === liveId ? null : trip);
    void queryClient.invalidateQueries({ queryKey: ['customer-active-trip', user?.id] });
    void history.refetch();
  };
  const searching = !!live && !live.driver_id && ['searching', 'booking'].includes(live.status);
  const etaAge = Date.now() - Date.parse(live?.eta_updated_at ?? '');
  const eta = live?.status === 'driver_on_way' && driverPresence(live).fresh && etaAge >= -5000 && etaAge <= 60000
    && typeof live.eta_min === 'number' && Number.isFinite(live.eta_min) && live.eta_min > 0 ? Math.ceil(live.eta_min) : null;
  const groups = [{ title: 'Denne uken', trips: past.filter(trip => thisOsloWeek(trip.created_at)) }, { title: 'Tidligere', trips: past.filter(trip => !(thisOsloWeek(trip.created_at))) }].filter(group => group.trips.length);
  return <V10Screen dock testID="customer-activity-screen"><V10Entrance>
    <Text style={{ color: colors.text, fontFamily: font.semibold, fontSize: 32, lineHeight: 38, letterSpacing: -.96, marginTop: 8, marginBottom: 20 }}>Aktivitet</Text>
    {live && !active.isError ? <V10Group style={{ padding: 16, gap: 12 }}>
      <Pressable accessibilityRole="button" testID="history-active-trip" onPress={() => router.push(`/booking/${liveId}`)}
        style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 6 }}>
          <V10Badge tone="positive">{liveLabels[live.status]}</V10Badge>
          <Text style={v10.body}>Til {live.dropoff_address || 'destinasjonen din'}</Text>
          {live.driver_id && live.driver?.name ? <Text style={v10.secondary}>{live.driver.name}{live.driver.plate ? ` · ${live.driver.plate}` : ''}</Text> : null}
          {eta !== null ? <Text style={v10.secondary}>Henting om ca. {eta} min</Text> : null}
        </View>
        <V10Icon name="chevR" size={18} />
      </Pressable>
      {CUSTOMER_CANCELLABLE_STATUSES.includes(live.status) ? <ActivityTripCancellation key={`${user?.id}:${liveId}`} tripId={liveId} searching={searching} onRefresh={refreshAfterCancellation} /> : null}
    </V10Group> : null}
    {active.isError ? <Text style={v10.caption}>Kunne ikke oppdatere aktiv tur.</Text> : null}
    {history.isPending ? <Loader label="Henter turer…" /> : history.isError ? <V10State icon="wifiOff" warning title="Kunne ikke hente turhistorikken" body="Sjekk forbindelsen og prøv igjen." action="Prøv igjen" onAction={() => void history.refetch()} /> : !past.length ? !live ? <View style={{ marginTop: 24 }}><V10State icon="activity" title="Ingen turer ennå" body="Gjennomførte og avbrutte turer vises her." action="Til hjem" onAction={() => router.navigate('/(app)/home')} /></View> : null : groups.map(group => <V10Section key={group.title} title={group.title}><V10Group>{group.trips.map((trip, index) => {
      const id = trip.trip_id || trip.id;
      const cancelled = cancelledTrip(trip.status);
      const date = new Date(trip.created_at);
      const label = cancelled ? 'Avbrutt' : trip.payment_status === 'paid' ? 'Fullført' : 'Betaling behandles';
      return <Pressable key={id || index} accessibilityRole="button" testID={`trip-${id || 'unknown'}`} disabled={!id} onPress={() => router.push(`/customer-trip/${encodeURIComponent(id)}` as any)} style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8 }}>
        {index ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: colors.line }} /> : null}
        <View style={v10.icon}><V10Icon name={cancelled ? 'x' : 'destination'} size={20} /></View>
        <View style={{ flex: 1, gap: 4 }}><Text style={v10.body} numberOfLines={2}>{trip.dropoff_address || 'SNAR-tur'}</Text><Text style={v10.caption}>{Number.isFinite(date.getTime()) ? date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', timeZone: 'Europe/Oslo' }) + ' ' + date.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Oslo' }) : 'Dato mangler'} · {vehicleMeta(trip.vehicle_type || 'ai-first').name}</Text><V10Badge tone={cancelled ? 'critical' : trip.payment_status === 'paid' ? 'neutral' : 'warning'}>{label}</V10Badge></View>
        {!cancelled ? <Text style={v10.body}>{kr(trip.price)}</Text> : null}
      </Pressable>;
    })}</V10Group></V10Section>)}
  </V10Entrance></V10Screen>;
}
