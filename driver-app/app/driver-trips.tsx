import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon } from '@/src/components/Icon';
import { Loader } from '@/src/components/ui';
import { driverApi, KJAPP_DEFAULT_COMMISSION_PCT } from '@/src/lib/api';
import { kr } from '@/src/lib/format';

type Filter = 'all' | 'week' | 'today';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'today', label: 'I dag' },
  { key: 'week', label: 'Uke' },
  { key: 'all', label: 'Alle' },
];

const STATUS: Record<string, { label: string; color: string }> = {
  arrived: { label: 'Fullført', color: colors.online },
  completed: { label: 'Fullført', color: colors.online },
  rated: { label: 'Fullført', color: colors.online },
  cancelled_by_driver: { label: 'Avbrutt', color: colors.danger },
  cancelled: { label: 'Avbrutt', color: colors.danger },
};

const EARNING_STATUSES = new Set(['arrived', 'completed', 'rated']);

function fmtDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('no-NO', { day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' });
}

export default function DriverTrips() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [detail, setDetail] = useState<any>(null);

  const { data: hist, isLoading } = useQuery({ queryKey: ['driver-history'], queryFn: driverApi.history });
  const { data: payouts } = useQuery({ queryKey: ['driver-payouts'], queryFn: driverApi.payouts });
  const commissionPct = payouts?.commission_pct ?? KJAPP_DEFAULT_COMMISSION_PCT;
  const commission = commissionPct / 100;
  const all = hist?.trips || hist?.history || (Array.isArray(hist) ? hist : []);

  const trips = useMemo(() => {
    if (filter === 'all') return all;
    const since = filter === 'today'
      ? new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
      : new Date(Date.now() - 7 * 864e5).toISOString();
    return all.filter((t: any) => (t.created_at || '') >= since);
  }, [all, filter]);

  const net = (p: number) => Math.round((p || 0) * (1 - commission));
  const isEarned = (t: any) => EARNING_STATUSES.has(t?.status);

  return (
    <View style={{ flex: 1, backgroundColor: colors.driverBg }}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={s.back} testID="driver-trips-back">
          <Icon name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <View>
          <Text style={s.title}>Turhistorikk</Text>
          <Text style={s.subtitle}>Fullførte og avbrutte KJAPP-turer</Text>
        </View>
      </View>

      <View style={s.segs}>
        {FILTERS.map((f) => (
          <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[s.seg, filter === f.key && s.segOn]} testID={`trips-filter-${f.key}`}>
            <Text style={[s.segText, filter === f.key && s.segTextOn]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 28 }}>
        {isLoading ? (
          <View style={{ paddingTop: 60 }}><Loader /></View>
        ) : trips.length ? (
          trips.map((t: any, i: number) => {
            const st = STATUS[t.status] || { label: t.status, color: colors.textMuted };
            const earned = isEarned(t);
            return (
              <Pressable key={t.trip_id || i} style={({ pressed }) => [s.card, pressed && { opacity: 0.84 }]} onPress={() => setDetail(t)} testID={`trip-row-${i}`}>
                <View style={s.statusRow}>
                  <View style={[s.statusBadge, { backgroundColor: `${st.color}18`, borderColor: `${st.color}45` }]}>
                    <Icon name={st.label === 'Fullført' ? 'check' : 'x'} size={11} color={st.color} />
                    <Text style={[s.statusText, { color: st.color }]}>{st.label.toUpperCase()}</Text>
                  </View>
                  <Text style={s.dateText}>{fmtDate(t.created_at)}</Text>
                </View>

                <View style={s.routeRow}>
                  <View style={s.routeRail}>
                    <View style={s.beacon} />
                    <View style={s.epLine} />
                    <View style={s.square} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.address} numberOfLines={1}>{t.pickup_address}</Text>
                    <Text style={[s.address, { marginTop: 7 }]} numberOfLines={1}>{t.dropoff_address}</Text>
                  </View>
                  <View style={s.priceCol}>
                    <Text style={[s.rowPrice, !earned && { color: colors.textMuted }]}>{earned ? kr(net(t.price)) : kr(0)}</Text>
                    <Text style={s.rowGross}>{earned ? `${kr(t.price)} brutto` : 'Ingen inntekt'}</Text>
                    <Text style={s.distance}>{t.distance_km} km</Text>
                  </View>
                </View>
              </Pressable>
            );
          })
        ) : (
          <View style={s.emptyCard}>
            <Icon name="history" size={28} color={colors.textMuted} />
            <Text style={s.empty}>Ingen turer i denne perioden.</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={!!detail} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <View style={s.sheetBackdrop}>
          <Pressable style={{ flex: 1 }} onPress={() => setDetail(null)} />
          <View style={[s.detailSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={s.handle} />
            {detail ? (
              <>
                <Text style={s.detailDate}>{fmtDate(detail.created_at)}</Text>
                <View style={[s.epRow, { marginTop: 14 }]}><View style={s.beacon} /><Text style={s.epText} numberOfLines={2}>{detail.pickup_address}</Text></View>
                <View style={s.detailLine} />
                <View style={s.epRow}><View style={s.square} /><Text style={s.epText} numberOfLines={2}>{detail.dropoff_address}</Text></View>

                <View style={s.metrics}>
                  <Metric label="Avstand" value={`${detail.distance_km} km`} s={s} />
                  <View style={s.mDiv} />
                  <Metric label="Tid" value={`${detail.duration_min} min`} s={s} />
                  <View style={s.mDiv} />
                  <Metric label="Ref" value={String(detail.trip_id || '').slice(0, 6)} s={s} />
                </View>

                <View style={s.breakCard}>
                  <BreakRow label="Bruttopris" value={isEarned(detail) ? kr(detail.price) : kr(0)} s={s} />
                  <BreakRow label={`Provisjon (${commissionPct}%)`} value={isEarned(detail) ? `− ${kr(Math.round((detail.price || 0) * commission))}` : kr(0)} muted s={s} />
                  <View style={s.breakDivider} />
                  <BreakRow label="Din inntekt" value={isEarned(detail) ? kr(net(detail.price)) : kr(0)} bold s={s} />
                  {!isEarned(detail) ? <Text style={s.noIncomeNote}>Avbrutte turer regnes ikke som opptjent inntekt.</Text> : null}
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Metric({ label, value, s }: any) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={s.mLabel}>{label}</Text>
      <Text style={s.mValue}>{value}</Text>
    </View>
  );
}
function BreakRow({ label, value, muted, bold, s }: any) {
  return (
    <View style={s.breakRow}>
      <Text style={[s.breakLabel, bold && { color: colors.text, fontSize: 15 }]}>{label}</Text>
      <Text style={[s.breakValue, muted && { color: colors.textMuted }, bold && { fontSize: 18, color: colors.online }]}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { paddingHorizontal: 20, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 14 },
  back: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: c.line },
  title: { fontFamily: font.display, fontSize: 25, color: c.text },
  subtitle: { color: c.textMuted, fontSize: 11, marginTop: 2 },
  segs: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 999, padding: 4, marginHorizontal: 18, marginBottom: 12 },
  seg: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 999 },
  segOn: { backgroundColor: c.online },
  segText: { color: c.textMuted, fontSize: 13, fontWeight: '600' },
  segTextOn: { color: '#04120A' },
  card: { backgroundColor: c.driverCard, borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 14, marginBottom: 10 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 9, letterSpacing: 1.2, fontWeight: '800' },
  dateText: { color: c.textMuted, fontSize: 10 },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  routeRail: { width: 12, alignItems: 'center', paddingTop: 5 },
  beacon: { width: 9, height: 9, borderRadius: 5, backgroundColor: c.online },
  epLine: { width: 1, height: 22, backgroundColor: c.lineStrong, marginVertical: 2 },
  square: { width: 9, height: 9, borderRadius: 2, backgroundColor: c.text },
  address: { color: c.text, fontSize: 13 },
  priceCol: { alignItems: 'flex-end', paddingLeft: 4 },
  rowPrice: { color: c.text, fontFamily: font.mono, fontSize: 14 },
  rowGross: { color: c.textMuted, fontSize: 9, marginTop: 3 },
  distance: { color: c.textMuted, fontSize: 10, marginTop: 5 },
  emptyCard: { alignItems: 'center', justifyContent: 'center', paddingTop: 70, gap: 12 },
  empty: { color: c.textMuted, fontSize: 14 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(3,6,7,0.6)' },
  detailSheet: { backgroundColor: c.elevated, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: c.line, paddingHorizontal: 22, paddingTop: 10 },
  handle: { alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: c.lineStrong, marginBottom: 14 },
  detailDate: { color: c.textMuted, fontSize: 13 },
  epRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailLine: { width: 1, height: 16, backgroundColor: c.lineStrong, marginLeft: 5, marginVertical: 3 },
  epText: { color: c.text, fontSize: 14, flex: 1 },
  metrics: { flexDirection: 'row', alignItems: 'center', marginTop: 18, paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.line },
  mDiv: { width: 1, height: 28, backgroundColor: c.line },
  mLabel: { color: c.textMuted, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' },
  mValue: { color: c.text, fontFamily: font.mono, fontSize: 14, marginTop: 4 },
  breakCard: { marginTop: 18 },
  breakRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 },
  breakLabel: { color: c.textSecondary, fontSize: 14 },
  breakValue: { color: c.text, fontFamily: font.mono, fontSize: 14 },
  breakDivider: { height: 1, backgroundColor: c.line, marginVertical: 6 },
  noIncomeNote: { color: c.textMuted, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 8 },
}));