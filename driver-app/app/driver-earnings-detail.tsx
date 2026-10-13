import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/src/context/AuthContext';
import { driverApi } from '@/src/lib/api';
import { confirmedTripIncome, historyDate, historyTrips } from '@/src/lib/driverHistory';
import { kr } from '@/src/lib/format';
import { Text } from '@/src/components/Typography';
import { V10Action, V10Group, V10Header, V10Row, V10Screen, V10Section, V10State, v10 } from '@/src/components/V10UI';
import { Loader } from '@/src/components/ui';
import { colors, font } from '@/src/theme';

export default function DriverEarningsDetail() {
  const router = useRouter();
  const { user } = useAuth();
  const [period, setPeriod] = useState<'day' | 'week'>('day');
  const summary = useQuery({ queryKey: ['driver-summary', user?.id], queryFn: driverApi.summary, enabled: !!user?.id });
  const weekly = useQuery({ queryKey: ['driver-weekly', user?.id], queryFn: driverApi.weekly, enabled: !!user?.id });
  const payouts = useQuery({ queryKey: ['driver-payouts', user?.id], queryFn: driverApi.payouts, enabled: !!user?.id });
  const history = useQuery({ queryKey: ['driver-history', user?.id], queryFn: driverApi.history, enabled: !!user?.id });
  // Match the backend's UTC accounting-day boundary, rather than summing a limited history page.
  const start = new Date(); start.setUTCHours(0, 0, 0, 0);
  if (period === 'week') start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  const since = start.toISOString();
  const days = Array.isArray(weekly.data?.days) ? weekly.data.days.filter((day: any) => typeof day.date === 'string' && day.date >= since.slice(0, 10)) : [];
  const validWeek = days.length > 0 && days.every((day: any) => typeof day.income === 'number' && Number.isFinite(day.income) && typeof day.trips === 'number' && Number.isFinite(day.trips));
  const income = period === 'day' ? summary.data?.income : !validWeek ? null : days.reduce((sum: number, day: any) => sum + (typeof day.income === 'number' ? day.income : 0), 0);
  const tripsCount = period === 'day' ? summary.data?.trips : !validWeek ? null : days.reduce((sum: number, day: any) => sum + (typeof day.trips === 'number' ? day.trips : 0), 0);
  const incomeQuery = period === 'day' ? summary : weekly;
  const trips = historyTrips(history.data).filter(trip => (trip.created_at || '') >= since);
  const payoutDate = payouts.data?.next_payout_date && Number.isFinite(new Date(payouts.data.next_payout_date).getTime()) ? historyDate(payouts.data.next_payout_date) : null;
  return <V10Screen testID="driver-earnings-detail-screen"><V10Header title="Inntjening" onBack={() => router.back()} />
    <View style={{ flexDirection: 'row', backgroundColor: colors.cardSubtle, borderRadius: 10, padding: 3 }}>
      {(['day', 'week'] as const).map(key => <Pressable key={key} testID={`driver-earnings-period-${key}`} accessibilityRole="tab" accessibilityState={{ selected: period === key }} aria-selected={period === key} onPress={() => setPeriod(key)} style={{ flex: 1, minHeight: 36, borderRadius: 8, backgroundColor: period === key ? colors.surface : 'transparent', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.text, fontFamily: font.medium, fontSize: 12 }}>{key === 'day' ? 'I dag' : 'Denne uken'}</Text></Pressable>)}
    </View>
    {incomeQuery.isPending ? <Loader /> : incomeQuery.isError ? <View style={{ marginTop: 20 }}><V10State icon="wifiOff" warning title="Kunne ikke hente inntekten" body="Oppdater for å vise bekreftede tall." action="Prøv igjen" onAction={() => void incomeQuery.refetch()} /></View> : <>
      <Text testID="driver-earnings-period-net" style={{ color: colors.text, fontFamily: font.semibold, fontSize: 40, lineHeight: 60, letterSpacing: -1.2, marginTop: 20 }}>{typeof income === 'number' && Number.isFinite(income) ? kr(income) : '— kr'}</Text>
      <Text style={v10.secondary}>{typeof tripsCount === 'number' ? `${tripsCount} betalte turer` : 'Turantall ikke tilgjengelig'}{period === 'day' && typeof summary.data?.online_minutes === 'number' ? ` · ${Math.floor(summary.data.online_minutes / 60)} t ${summary.data.online_minutes % 60} min` : ''}</Text>
    </>}
    <V10Section title="Oppgjør via fleet">{payouts.isPending ? <Loader /> : payouts.isError ? <V10State icon="wifiOff" title="Oppgjør kunne ikke hentes" body="Prøv igjen for å se oppdatert informasjon." action="Prøv igjen" onAction={() => void payouts.refetch()} /> : <V10Group>
      <V10Row icon="payment" title={payoutDate ? `Neste utbetaling · ${payoutDate}` : 'Utbetaling via løyvehaveren'} subtitle={user?.fleet_name || 'Kontakt løyvehaveren for oppgjørsinformasjon'} />
      <V10Row border icon="earnings" title="Betalte turer · siste 7 dager" right={<Text style={v10.body}>{kr(payouts.data?.earned_net_7d)}</Text>} />
    </V10Group>}</V10Section>
    <V10Section title="Turer">{history.isPending ? <Loader /> : history.isError ? <V10State icon="wifiOff" title="Turene kunne ikke hentes" body="Prøv igjen for å oppdatere listen." action="Prøv igjen" onAction={() => void history.refetch()} /> : !trips.length ? <Text style={v10.secondary}>Ingen tilgjengelige turer i denne perioden.</Text> : <V10Group>{trips.map((trip, index) => {
      const income = confirmedTripIncome(trip);
      return <Pressable key={trip.trip_id} accessibilityRole="button" onPress={() => router.push(`/driver-trip/${encodeURIComponent(trip.trip_id!)}` as any)} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        {index ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: colors.line }} /> : null}
        <Text style={[v10.caption, { width: 40 }]}>{historyDate(trip.created_at, true)}</Text><Text style={[v10.body, { flex: 1, fontSize: 15 }]} numberOfLines={2}>{trip.pickup_address} → {trip.dropoff_address}</Text><Text style={v10.body}>{income !== null ? kr(income) : 'Avventer'}</Text>
      </Pressable>;
    })}</V10Group>}</V10Section>
    <View style={{ marginTop: 16 }}><V10Action kind="soft" label="Måned og detaljerte rapporter" onPress={() => router.push('/driver-earnings-report')} /></View>
  </V10Screen>;
}
