import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Rect } from 'react-native-svg';
import { useQuery } from '@tanstack/react-query';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon } from '@/src/components/Icon';
import { Loader } from '@/src/components/ui';
import { driverApi, KJAPP_DEFAULT_COMMISSION_PCT } from '@/src/lib/api';
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
  const [period, setPeriod] = useState<Period>('today');

  const { data: summary } = useQuery({ queryKey: ['driver-summary'], queryFn: driverApi.summary });
  const { data: weekly } = useQuery({ queryKey: ['driver-weekly'], queryFn: driverApi.weekly });
  const { data: payouts } = useQuery({ queryKey: ['driver-payouts'], queryFn: driverApi.payouts });
  const { data: hist, isLoading } = useQuery({ queryKey: ['driver-history'], queryFn: driverApi.history });

  const trips = hist?.trips || hist?.history || (Array.isArray(hist) ? hist : []);
  const days = weekly?.days || [];
  const commissionPct = payouts?.commission_pct ?? KJAPP_DEFAULT_COMMISSION_PCT;
  const commission = commissionPct / 100;

  const period_data = useMemo(() => {
    if (period === 'today') {
      const gross = summary?.trip_income ?? 0;
      const bonus = summary?.bonus ?? 0;
      return { gross, bonus, trips: summary?.trips ?? 0, minutes: summary?.online_minutes ?? 0, net: Math.round(gross * (1 - commission)) + bonus };
    }
    if (period === 'week') {
      const gross = days.reduce((a: number, d: any) => a + (d.income || 0), 0);
      const t = days.reduce((a: number, d: any) => a + (d.trips || 0), 0);
      return { gross, bonus: 0, trips: t, minutes: null, net: Math.round(gross * (1 - commission)) };
    }
    const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString();
    const mt = trips.filter((t: any) => (t.created_at || '') >= monthAgo && ['arrived', 'completed', 'rated'].includes(t.status));
    const gross = mt.reduce((a: number, t: any) => a + (t.price || 0), 0);
    return { gross, bonus: 0, trips: mt.length, minutes: null, net: Math.round(gross * (1 - commission)) };
  }, [period, summary, days, trips, commission]);

  const maxIncome = Math.max(1, ...days.map((d: any) => d.income || 0));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.driverBg }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24, paddingHorizontal: 20 }}>
      <Text style={s.title}>Inntekt</Text>

      <View style={s.segs}>
        {PERIODS.map((p) => (
          <Pressable key={p.key} onPress={() => setPeriod(p.key)} style={[s.seg, period === p.key && s.segOn]} testID={`earnings-period-${p.key}`}>
            <Text style={[s.segText, period === p.key && s.segTextOn]}>{p.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={s.hero}>
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
      </View>

      <View style={s.card}>
        <BreakRow label="Bruttoinntekt" value={kr(period_data.gross)} s={s} />
        <BreakRow label="KJAPP serviceavgift" value={`− ${kr(Math.round(period_data.gross * commission))}`} muted s={s} />
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

      <Text style={s.section}>Utbetaling</Text>
      <View style={s.card}>
        <View style={s.payTop}>
          <View>
            <Text style={s.payLabel}>Til utbetaling</Text>
            <Text style={s.payValue}>{kr(payouts?.pending_net ?? 0)}</Text>
          </View>
          <View style={s.payBadge}>
            <Icon name="clock" size={14} color={colors.online} />
            <Text style={s.payBadgeText}>{payouts?.pending_trips ?? 0} turer</Text>
          </View>
        </View>
        <Text style={s.payHint}>Brutto {kr(payouts?.pending_gross ?? 0)} · utbetales ukentlig{(payouts?.next_payout_date || payouts?.next_payout) ? ` · neste ${new Date(payouts.next_payout_date || payouts.next_payout).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })}` : ''}</Text>
      </View>

      <View style={s.recentHead}>
        <Text style={s.section}>Nylige turer</Text>
        <Pressable onPress={() => router.push('/driver-trips')} testID="earnings-see-all">
          <Text style={s.seeAll}>Se alle</Text>
        </Pressable>
      </View>
      {isLoading ? (
        <View style={{ paddingTop: 30 }}><Loader /></View>
      ) : trips.length ? (
        trips.slice(0, 6).map((t: any, i: number) => (
          <View key={t.trip_id || i} style={s.row}>
            <View style={s.rowIcon}><Icon name="navigation" size={16} color={colors.online} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle} numberOfLines={1}>{t.dropoff_address}</Text>
              <Text style={s.rowSub}>{t.distance_km} km · {t.duration_min} min</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.rowPrice}>{kr(Math.round((t.price || 0) * (1 - commission)))}</Text>
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
              <Rect key={i} x={i * (bw + gap)} y={H - bh} width={bw} height={bh} rx={5} fill={isToday ? colors.online : 'rgba(57,229,140,0.30)'} />
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  title: { color: c.text, fontFamily: font.display, fontSize: 28, marginBottom: 16 },
  segs: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 999, padding: 4, marginBottom: 18 },
  seg: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 999 },
  segOn: { backgroundColor: c.online },
  segText: { color: c.textMuted, fontSize: 13, fontFamily: font.semibold },
  segTextOn: { color: c.accentOn },
  hero: { backgroundColor: c.driverCard, borderRadius: 24, borderWidth: 1, borderColor: c.line, padding: 24, alignItems: 'center' },
  heroLabel: { color: c.online, fontSize: 11, letterSpacing: 3, fontFamily: font.bold },
  heroValue: { color: c.text, fontFamily: font.display, fontSize: 44, marginTop: 8 },
  heroRow: { flexDirection: 'row', gap: 28, marginTop: 20 },
  heroStat: { alignItems: 'center' },
  heroStatV: { color: c.text, fontFamily: font.mono, fontSize: 16 },
  heroStatL: { color: c.textMuted, fontSize: 11, marginTop: 4 },
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