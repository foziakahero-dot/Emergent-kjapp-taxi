import { EarningsMeter } from '@/src/components/snar10/driver/EarningsMeter';
import { usePersonalShiftGoal } from '@/src/lib/usePersonalShiftGoal';
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/src/context/AuthContext';
import { driverApi } from '@/src/lib/api';
import { kr } from '@/src/lib/format';
import { Text } from '@/src/components/Typography';
import { DriverWeekChart } from '@/src/components/DriverWeekChart';
import { V10Icon } from '@/src/components/V10Icon';
import { V10Action, V10Badge, V10Group, V10Screen, V10Section, V10State, v10 } from '@/src/components/V10UI';
import { Loader } from '@/src/components/ui';
import { colors, font, useColorTheme } from '@/src/theme';
import { V10Entrance } from '@/src/components/V10Entrance';

const number = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
export default function DriverEarnings() {
  useColorTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { goal } = usePersonalShiftGoal(user?.id);
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  const summary = useQuery({ queryKey: ['driver-summary', user?.id], queryFn: driverApi.summary, enabled: !!user?.id, refetchInterval: focused ? 5000 : false });
  const weekly = useQuery({ queryKey: ['driver-weekly', user?.id], queryFn: driverApi.weekly, enabled: !!user?.id, refetchInterval: focused ? 5000 : false });
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state === 'active' && focused) void Promise.allSettled([summary.refetch(), weekly.refetch()]); });
    return () => subscription.remove();
  }, [focused, summary.refetch, weekly.refetch]);
  const data = summary.data;
  const minutes = number(data?.online_minutes);
  const income = number(data?.income);
  const hourly = income !== null && minutes !== null && minutes > 0 ? income / (minutes / 60) : null;
  return <V10Screen dock testID="driver-earnings-screen">
    <V10Entrance fade>
    {summary.isPending ? <Loader label="Henter bekreftede inntekter…" /> : summary.isError ? <V10State icon="wifiOff" warning title="Kunne ikke hente inntektsdata" body="Sjekk forbindelsen og prøv igjen." action="Prøv igjen" onAction={() => void summary.refetch()} /> : <>
      <Text style={[v10.overline, { marginTop: 8 }]}>I dag · {new Date().toLocaleDateString('nb-NO', { weekday: 'long' })}</Text>
      <Text testID="earnings-net" style={{ color: colors.text, fontFamily: font.semibold, fontSize: 48, lineHeight: 62, letterSpacing: -1.68, marginTop: 4, fontVariant: ['tabular-nums'] }}>{kr(income)}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><V10Badge tone="positive">Bekreftet</V10Badge><Text style={v10.secondary}>Betalte turer{number(data?.bonus) ? ' og opptjent bonus' : ''}</Text></View>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
        <Kpi label="Online" value={minutes !== null ? `${Math.floor(minutes / 60)} t ${minutes % 60}` : '—'} unit="min" />
        <Kpi label="Turer" value={number(data?.trips)?.toLocaleString('nb-NO') || '—'} />
        <Kpi label="Per time" value={hourly !== null ? Math.round(hourly).toLocaleString('nb-NO') : '—'} unit="kr" />
      </View>
      <EarningsMeter income={income} goal={Number(goal)} />
      <V10Section title="Siste 7 dager"><V10Group style={{ padding: 16 }}>{weekly.isPending ? <Loader /> : weekly.isError ? <V10State icon="wifiOff" title="Grafen kunne ikke hentes" body="Oppdater inntektsdataene for å prøve igjen." action="Prøv igjen" onAction={() => void weekly.refetch()} /> : <DriverWeekChart days={Array.isArray(weekly.data?.days) ? weekly.data.days : []} />}</V10Group></V10Section>
      <Pressable accessibilityRole="button" onPress={() => router.navigate('/(driver)/intel')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 22, padding: 16, backgroundColor: colors.surface, boxShadow: colors.elevation1, marginTop: 12 }}>
        <View style={[v10.icon, { backgroundColor: colors.surfaceInverse }]}><V10Icon name="ai" size={20} color={colors.onInverse} /></View>
        <View style={{ flex: 1 }}><Text style={v10.body}>SNAR Drive Intelligence</Text><Text style={[v10.caption, { marginTop: 2 }]}>Se status for skiftinnsikt</Text></View><V10Icon name="chevR" size={18} />
      </Pressable>
      <View style={{ marginTop: 12 }}><V10Action kind="soft" label="Uke, utbetaling og turer" onPress={() => router.push('/driver-earnings-detail')} testID="driver-earnings-detail-open" /></View>
    </>}
    </V10Entrance>
  </V10Screen>;
}
function Kpi({ label, value, unit }: { label: string; value: string; unit?: string }) {
  useColorTheme();
  return <View style={{ flex: 1 }}><Text style={v10.caption}>{label}</Text><Text style={{ fontFamily: font.semibold, fontSize: 20, lineHeight: 26, letterSpacing: -.4, color: colors.text, fontVariant: ['tabular-nums'] }}>{value}{unit ? <Text style={v10.caption}> {unit}</Text> : null}</Text></View>;
}
