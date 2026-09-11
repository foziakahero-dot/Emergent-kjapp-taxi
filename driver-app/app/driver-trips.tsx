import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon } from '@/src/components/Icon';
import { Loader } from '@/src/components/ui';
import { driverApi } from '@/src/lib/api';
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
  const commission = (payouts?.commission_pct ?? 20) / 100;
  const all = hist?.trips || hist?.history || (Array.isArray(hist) ? hist : []);

  const trips = useMemo(() => {
    if (filter === 'all') return all;
    const since = filter === 'today'
      ? new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
      : new Date(Date.now() - 7 * 864e5).toISOString();
    return all.filter((t: any) => (t.created_at || '') >= since);
  }, [all, filter]);

  const net = (p: number) => Math.round((p || 0) * (1 - commission));

  return (
    <View style={{ flex: 1, backgroundColor: colors.driverBg }}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={s.back} testID="driver-trips-back">
          <Icon name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text style={s.title}>Mine turer</Text>
      </View>

      <View style={s.segs}>
        {FILTERS.map((f) => (
          <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[s.seg, filter === f.key && s.segOn]} testID={`trips-filter-${f.key}`}>
            <Text style={[s.segText, filter === f.key && s.segTextOn]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}>
        {isLoading ? (
          <View style={{ paddingTop: 60 }}><Loader /></View>
        ) : trips.length ? (
          trips.map((t: any, i: number) => {
            const st = STATUS[t.status] || { label: t.status, color: colors.textMuted };
            return (
              <Pressable key={t.trip_id || i} style={s.row} onPress={() => setDetail(t)} testID={`trip-row-${i}`}>
                <View style={s.rowIcon}><Icon name="navigation" size={16} color={st.color} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle} numberOfLines={1}>{t.dropoff_address}</Text>
                  <Text style={s.rowSub}>{fmtDate(t.created_at)} · {t.distance_km} km</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.rowPrice}>{kr(net(t.price))}</Text>
                  <Text style={[s.rowStatus, { color: st.color }]}>{st.label}</Text>
                </View>
              </Pressable>
            );
          })
        ) : (
          <Text style={s.empty}>Ingen turer i denne perioden.</Text>
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
                <View style={s.epLine} />
                <View style={s.epRow}><View style={s.square} /><Text style={s.epText} numberOfLines={2}>{detail.dropoff_address}</Text></View>

                <View style={s.metrics}>
                  <Metric label="Avstand" value={`${detail.distance_km} km`} s={s} />
                  <View style={s.mDiv} />
                  <Metric label="Tid" value={`${detail.duration_min} min`} s={s} />
                  <View style={s.mDiv} />
                  <Metric label="Ref" value={String(detail.trip_id || '').slice(0, 6)} s={s} />
                </View>

                <View style={s.breakCard}>
                  <BreakRow label="Bruttopris" value={kr(detail.price)} s={s} />
                  <BreakRow label={`Provisjon (${payouts?.commission_pct ?? 20}%)`} value={`− ${kr(Math.round((detail.price || 0) * commission))}`} muted s={s} />
                  <View style={s.breakDivider} />
                  <BreakRow label="Din inntekt" value={kr(net(detail.price))} bold s={s} />
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
  header: { paddingHorizontal: 20, paddingBottom: 14, gap: 16 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: c.line },
  title: { fontFamily: font.display, fontSize: 26, color: c.text },
  segs: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 999, padding: 4, marginHorizontal: 20, marginBottom: 8 },
  seg: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 999 },
  segOn: { backgroundColor: c.online },
  segText: { color: c.textMuted, fontSize: 13, fontWeight: '600' },
  segTextOn: { color: '#04120A' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.line },
  rowIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  rowTitle: { color: c.text, fontSize: 14 },
  rowSub: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  rowPrice: { color: c.text, fontFamily: font.mono, fontSize: 15 },
  rowStatus: { fontSize: 11, marginTop: 2 },
  empty: { color: c.textMuted, fontSize: 14, marginTop: 40, textAlign: 'center' },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(3,6,7,0.6)' },
  detailSheet: { backgroundColor: c.elevated, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: c.line, paddingHorizontal: 22, paddingTop: 10 },
  handle: { alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: c.lineStrong, marginBottom: 14 },
  detailDate: { color: c.textMuted, fontSize: 13 },
  epRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  epLine: { width: 1, height: 16, backgroundColor: c.lineStrong, marginLeft: 5, marginVertical: 3 },
  beacon: { width: 11, height: 11, borderRadius: 6, backgroundColor: c.online },
  square: { width: 11, height: 11, borderRadius: 2, backgroundColor: c.text },
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
}));
