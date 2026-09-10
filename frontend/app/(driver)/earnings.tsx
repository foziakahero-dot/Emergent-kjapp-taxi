import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon } from '@/src/components/Icon';
import { Loader } from '@/src/components/ui';
import { driverApi } from '@/src/lib/api';
import { kr } from '@/src/lib/format';

export default function DriverEarnings() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { data: summary } = useQuery({ queryKey: ['driver-summary'], queryFn: driverApi.summary });
  const { data: hist, isLoading } = useQuery({ queryKey: ['driver-history'], queryFn: driverApi.history });

  const trips = hist?.trips || hist?.history || (Array.isArray(hist) ? hist : []);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.driverBg }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24, paddingHorizontal: 20 }}>
      <Text style={s.title}>Inntekt</Text>

      <View style={s.hero}>
        <Text style={s.heroLabel}>I DAG</Text>
        <Text style={s.heroValue}>{kr(summary?.earnings ?? summary?.total ?? 0)}</Text>
        <View style={s.heroRow}>
          <View style={s.heroStat}><Text style={s.heroStatV}>{summary?.trips ?? 0}</Text><Text style={s.heroStatL}>turer</Text></View>
          <View style={s.heroStat}><Text style={s.heroStatV}>{summary?.hours ?? summary?.online_hours ?? 0}</Text><Text style={s.heroStatL}>timer</Text></View>
          <View style={s.heroStat}><Text style={s.heroStatV}>{summary?.distance_km ?? 0}</Text><Text style={s.heroStatL}>km</Text></View>
        </View>
      </View>

      <Text style={s.section}>Nylige turer</Text>
      {isLoading ? (
        <View style={{ paddingTop: 40 }}><Loader /></View>
      ) : trips.length ? (
        trips.map((t: any, i: number) => (
          <View key={t.trip_id || i} style={s.row}>
            <View style={s.rowIcon}><Icon name="navigation" size={16} color={colors.online} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle} numberOfLines={1}>{t.dropoff_address}</Text>
              <Text style={s.rowSub}>{t.distance_km} km · {t.duration_min} min</Text>
            </View>
            <Text style={s.rowPrice}>{kr(t.price)}</Text>
          </View>
        ))
      ) : (
        <Text style={s.empty}>Ingen fullførte turer ennå.</Text>
      )}
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  title: { color: c.text, fontFamily: font.display, fontSize: 28, marginBottom: 20 },
  hero: { backgroundColor: c.driverCard, borderRadius: 24, borderWidth: 1, borderColor: c.line, padding: 24, alignItems: 'center' },
  heroLabel: { color: c.online, fontSize: 11, letterSpacing: 3, fontWeight: '700' },
  heroValue: { color: c.text, fontFamily: font.display, fontSize: 44, marginTop: 8 },
  heroRow: { flexDirection: 'row', gap: 32, marginTop: 20 },
  heroStat: { alignItems: 'center' },
  heroStatV: { color: c.text, fontFamily: font.mono, fontSize: 18 },
  heroStatL: { color: c.textMuted, fontSize: 11, marginTop: 4 },
  section: { color: c.textSecondary, fontSize: 14, fontWeight: '600', marginTop: 28, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.line },
  rowIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.onlineSoft, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { color: c.text, fontSize: 14 },
  rowSub: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  rowPrice: { color: c.text, fontFamily: font.mono, fontSize: 15 },
  empty: { color: c.textMuted, fontSize: 14, marginTop: 20 },
}));
