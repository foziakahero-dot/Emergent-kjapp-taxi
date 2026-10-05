import { FigmaGradient } from '@/src/components/FigmaGradient';
import { Text } from '@/src/components/Typography';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon } from '@/src/components/Icon';
import { Loader } from '@/src/components/ui';
import { driverApi } from '@/src/lib/api';
import { kr } from '@/src/lib/format';

type Period = 'today' | 'week' | 'month';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'I dag' },
  { key: 'week', label: 'Uke' },
  { key: 'month', label: 'Måned' },
];

export default function DriverEarnings() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const router = useRouter();
  const [period] = useState<Period>('week');
  const [focused, setFocused] = useState(false);

  const summaryQ = useQuery({ queryKey: ['driver-summary'], queryFn: driverApi.summary, refetchInterval: focused ? 5000 : false });
  const weeklyQ = useQuery({ queryKey: ['driver-weekly'], queryFn: driverApi.weekly, refetchInterval: focused ? 5000 : false });
  const payoutsQ = useQuery({ queryKey: ['driver-payouts'], queryFn: driverApi.payouts, refetchInterval: focused ? 5000 : false });
  const historyQ = useQuery({ queryKey: ['driver-history'], queryFn: driverApi.history, refetchInterval: focused ? 5000 : false });

  const refreshEarnings = useCallback(async () => {
    await Promise.allSettled([summaryQ.refetch(), weeklyQ.refetch(), payoutsQ.refetch(), historyQ.refetch()]);
  }, [summaryQ.refetch, weeklyQ.refetch, payoutsQ.refetch, historyQ.refetch]);

  useFocusEffect(useCallback(() => {
    setFocused(true);
    void refreshEarnings();
    return () => setFocused(false);
  }, [refreshEarnings]));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && focused) void refreshEarnings();
    });
    return () => subscription.remove();
  }, [focused, refreshEarnings]);

  const refreshing = summaryQ.isRefetching || weeklyQ.isRefetching || payoutsQ.isRefetching || historyQ.isRefetching;
  const summary = summaryQ.data;
  const weekly = weeklyQ.data;
  const payouts = payoutsQ.data;
  const hist = historyQ.data;
  const isLoading = summaryQ.isLoading || weeklyQ.isLoading || payoutsQ.isLoading || historyQ.isLoading;
  const isError = summaryQ.isError || weeklyQ.isError || payoutsQ.isError || historyQ.isError;
  const trips = hist?.trips || hist?.history || (Array.isArray(hist) ? hist : []);
  const days = weekly?.days || [];

  const period_data = useMemo(() => {
    if (period === 'today') {
      const gross = Number(summary?.gross_trip_income || 0);
      const tripNet = Number(summary?.trip_income || 0);
      const bonus = Number(summary?.bonus || 0);
      return { gross, bonus, fee: Math.max(0, gross - tripNet), trips: summary?.trips ?? 0, minutes: summary?.online_minutes ?? 0, net: tripNet + bonus };
    }
    if (period === 'week') {
      const gross = days.reduce((sum: number, d: any) => sum + Number(d.gross_income || 0), 0);
      const net = days.reduce((sum: number, d: any) => sum + Number(d.income || 0), 0);
      const t = days.reduce((sum: number, d: any) => sum + Number(d.trips || 0), 0);
      return { gross, bonus: 0, fee: Math.max(0, gross - net), trips: t, minutes: null, net };
    }
    const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString();
    const mt = trips.filter((t: any) => (t.created_at || '') >= monthAgo && t.payment_status === 'paid' && t.driver_earnings != null);
    const gross = mt.reduce((sum: number, t: any) => sum + Number(t.price || 0), 0);
    const net = mt.reduce((sum: number, t: any) => sum + Number(t.driver_earnings || 0), 0);
    return { gross, bonus: 0, fee: Math.max(0, gross - net), trips: mt.length, minutes: null, net };
  }, [period, summary, days, trips]);

  const maxIncome = Math.max(1, ...days.map((d: any) => d.income || 0));

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.driverBg, alignItems: 'center', justifyContent: 'center' }}>
        <Loader label="Henter bekreftede inntekter…" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.driverBg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
        <Text style={{ color: colors.text, fontFamily: font.semibold, fontSize: 16, textAlign: 'center' }}>Kunne ikke hente inntektsdata</Text>
        <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 8 }}>Prøv igjen når forbindelsen er tilbake.</Text>
      </View>
    );
  }

  return (
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refreshEarnings()} tintColor={colors.accent} />} style={{ flex: 1, backgroundColor: colors.driverBg }} contentContainerStyle={{ paddingTop: insets.top + 56, paddingBottom: insets.bottom + 112, paddingHorizontal: 28 }}>
      <Text style={s.title}>Inntjening</Text>

      <FigmaGradient angle={135} colors={['#FF3B3B', '#B30000']} style={s.hero}>
        <Text style={s.heroLabel}>NETTO {PERIODS.find((p) => p.key === period)!.label.toUpperCase()}</Text>
        <Text style={s.heroValue} testID="earnings-net">{kr(period_data.net)}</Text>
        <View style={s.heroRow}>
          <View style={s.heroStat}><Text style={s.heroStatV}>{period_data.trips}</Text><Text style={s.heroStatL}>turer</Text></View>
          <View style={s.heroStat}><Text style={s.heroStatV}>{kr(period_data.gross)}</Text><Text style={s.heroStatL}>brutto</Text></View>
          <View style={s.heroStat}>
            <Text style={s.heroStatV}>{period_data.minutes != null ? `${Math.floor((period_data.minutes || 0) / 60)}t ${(period_data.minutes || 0) % 60}m` : '—'}</Text>
            <Text style={s.heroStatL}>online</Text>
          </View>
        </View>
      </FigmaGradient>

      <View style={s.card}>
        <BreakRow label="Bruttoinntekt" value={kr(period_data.gross)} s={s} />
        <BreakRow label="SNAR serviceavgift" value={`− ${kr(period_data.fee)}`} muted s={s} />
        {period_data.bonus ? <BreakRow label="Bonus" value={`+ ${kr(period_data.bonus)}`} accentGreen s={s} /> : null}
        <View style={s.breakDivider} />
        <BreakRow label="Netto" value={kr(period_data.net)} bold s={s} />
      </View>

      <Text style={s.section}>Siste 7 dager</Text>
      <View style={s.card}>
        <ChartBars days={days} max={maxIncome} />
        <View style={s.chartLabels}>
          {days.map((d: any, i: number) => (
            <Text key={i} style={s.chartLabel}>{d.day_label}</Text>
          ))}
        </View>
      </View>

      <Text style={s.section}>Oppgjør via flåte</Text>
      <View style={s.card}>
        <View style={s.payTop}>
          <View>
            <Text style={s.payLabel}>Din netto · siste 7 dager</Text>
            <Text style={s.payValue}>{kr(payouts?.earned_net_7d ?? 0)}</Text>
          </View>
          <View style={s.payBadge}>
            <Icon name="clock" size={14} color={colors.online} />
            <Text style={s.payBadgeText}>{payouts?.paid_trips_7d ?? 0} betalte turer</Text>
          </View>
        </View>
        <Text style={s.payHint}>
          {payouts?.stripe_connect_ready
            ? `Brutto ${kr(payouts?.earned_gross_7d ?? 0)} · går til løyvehaverens Stripe Connect-konto${payouts?.payout_schedule === 'weekly_friday' ? ' · Stripe utbetaler ukentlig fredag' : ''}${payouts?.next_payout_date ? ` · neste ${new Date(payouts.next_payout_date).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })}` : ''}`
            : `Brutto ${kr(payouts?.earned_gross_7d ?? 0)} · oppgjør håndteres av løyvehaveren. Stripe Connect er ikke bekreftet aktivt ennå.`}
        </Text>
      </View>

      <View style={s.recentHead}>
        <Text style={s.section}>Nylige turer</Text>
        <Pressable onPress={() => router.push('/driver-trips')} testID="earnings-see-all">
          <Text style={s.seeAll}>Se alle</Text>
        </Pressable>
      </View>
      {isLoading ? (
        <View style={{ paddingTop: 30 }}><Loader /></View>
      ) : isError ? (
        <Text style={s.empty}>Kunne ikke hente oppdaterte inntektsdata. Tall skjules til serveren svarer.</Text>
      ) : trips.length ? (
        trips.slice(0, 6).map((t: any, i: number) => (
          <View key={t.trip_id || i} style={s.row}>
            <View style={s.rowIcon}><Icon name="navigation" size={16} color={colors.online} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle} numberOfLines={1}>{t.dropoff_address}</Text>
              <Text style={s.rowSub}>{t.distance_km} km · {t.duration_min} min</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.rowPrice}>{t.driver_earnings != null ? kr(t.driver_earnings) : 'Venter betaling'}</Text>
              <Text style={s.rowGross}>{kr(t.price)}</Text>
            </View>
          </View>
        ))
      ) : (
        <Text style={s.empty}>Ingen fullførte turer ennå.</Text>
      )}
    </ScrollView>
  );
}

function BreakRow({ label, value, muted, bold, accentGreen, s }: any) {
  return (
    <View style={s.breakRow}>
      <Text style={[s.breakLabel, bold && { color: colors.text, fontSize: 15 }]}>{label}</Text>
      <Text style={[s.breakValue, muted && { color: colors.textMuted }, accentGreen && { color: colors.online }, bold && { fontSize: 18, color: colors.text }]}>{value}</Text>
    </View>
  );
}

function ChartBars({ days, max }: { days: any[]; max: number }) {
  const [w, setW] = useState(0);
  const H = 120;
  const n = days.length || 7;
  const gap = 10;
  const bw = w ? (w - gap * (n - 1)) / n : 0;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: H }}>
      {w > 0 ? (
        <Svg width={w} height={H}>
          {days.map((d: any, i: number) => {
            const bh = Math.max(3, ((d.income || 0) / max) * (H - 10));
            const isToday = i === days.length - 1;
            return (
              <Rect key={i} x={i * (bw + gap)} y={H - bh} width={bw} height={bh} rx={5} fill={isToday ? colors.accent : colors.accentSoft} />
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  title: { color: c.text, fontFamily: font.semibold, fontSize: 24, marginBottom: 22, letterSpacing: -0.5 },
  segs: { flexDirection: 'row', backgroundColor: c.cardSubtle, borderRadius: 999, padding: 4, marginBottom: 18 },
  seg: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 999 },
  segOn: { backgroundColor: c.online },
  segText: { color: c.textMuted, fontSize: 13, fontFamily: font.semibold },
  segTextOn: { color: c.accentOn },
  hero: { borderRadius: 24, padding: 24 },
  heroLabel: { color: 'rgba(255,255,255,0.78)', fontSize: 10, letterSpacing: 1.7, fontFamily: font.mono },
  heroValue: { color: c.accentOn, fontFamily: font.semibold, fontSize: 36, lineHeight: 40, marginTop: 8 },
  heroRow: { flexDirection: 'row', gap: 24, marginTop: 14 },
  heroStat: { alignItems: 'center' },
  heroStatV: { color: c.accentOn, fontFamily: font.mono, fontSize: 14 },
  heroStatL: { color: 'rgba(255,255,255,0.75)', fontSize: 10, marginTop: 3 },
  card: { backgroundColor: c.driverCard, borderRadius: 20, borderWidth: 1, borderColor: c.line, padding: 18, marginTop: 12 },
  breakRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  breakLabel: { color: c.textSecondary, fontSize: 14 },
  breakValue: { color: c.text, fontFamily: font.mono, fontSize: 14 },
  breakDivider: { height: 1, backgroundColor: c.line, marginVertical: 6 },
  section: { color: c.textSecondary, fontSize: 14, fontFamily: font.semibold, marginTop: 26, marginBottom: 4 },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  chartLabel: { color: c.textMuted, fontSize: 10, flex: 1, textAlign: 'center' },
  payTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payLabel: { color: c.textMuted, fontSize: 12 },
  payValue: { color: c.text, fontFamily: font.display, fontSize: 28, marginTop: 2 },
  payBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.onlineSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  payBadgeText: { color: c.online, fontSize: 12 },
  payHint: { color: c.textMuted, fontSize: 12, marginTop: 10, lineHeight: 18 },
  recentHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  seeAll: { color: c.online, fontSize: 13, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.line },
  rowIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.onlineSoft, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { color: c.text, fontSize: 14 },
  rowSub: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  rowPrice: { color: c.text, fontFamily: font.mono, fontSize: 15 },
  rowGross: { color: c.textMuted, fontSize: 11, marginTop: 2, textDecorationLine: 'line-through' },
  empty: { color: c.textMuted, fontSize: 14, marginTop: 20 },
}));
