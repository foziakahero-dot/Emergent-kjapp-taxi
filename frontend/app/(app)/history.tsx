import React from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon } from '@/src/components/Icon';
import { Loader } from '@/src/components/ui';
import { tripsApi } from '@/src/lib/api';
import { kr } from '@/src/lib/format';

const STATUS_LABEL: Record<string, string> = {
  searching: 'Søker sjåfør',
  booking: 'Bestiller',
  driver_on_way: 'Sjåfør på vei',
  at_pickup: 'Sjåføren er fremme',
  in_trip: 'Underveis',
  arrived: 'Fullført',
  completed: 'Fullført',
  rated: 'Fullført',
  cancelled: 'Avbrutt',
  cancelled_by_driver: 'Avbrutt',
};

const ACTIVE_STATUSES = ['searching', 'booking', 'driver_on_way', 'at_pickup', 'in_trip'];
const COMPLETED_STATUSES = ['arrived', 'completed', 'rated'];

export default function History() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const router = useRouter();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['trips'],
    queryFn: tripsApi.list,
  });

  const trips = data?.trips || (Array.isArray(data) ? data : []);
  const total = trips
    .filter((t: any) => COMPLETED_STATUSES.includes(t.status))
    .reduce((sum: number, t: any) => sum + Number(t.price || 0), 0);

  const openTrip = (trip: any) => {
    if (ACTIVE_STATUSES.includes(trip.status)) {
      router.push(`/booking/${trip.trip_id}`);
      return;
    }
    router.push(`/receipt/${trip.trip_id}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Text style={s.title}>Turer</Text>
        <Text style={s.subtitle}>Dine reiser med KJAPP</Text>
      </View>

      {isLoading ? (
        <View style={s.center}><Loader label="Henter turer…" /></View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(t) => String(t.id || t.trip_id)}
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 110 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />}
          ListHeaderComponent={
            <View style={s.summaryCard} testID="history-summary">
              <View>
                <Text style={s.summaryLabel}>TOTALT BRUKT</Text>
                <Text style={s.summaryValue}>{kr(total)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.tripCountLabel}>TURER</Text>
                <Text style={s.tripCountValue}>{trips.length}</Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={s.center}>
              <View style={s.emptyOrb}><Icon name="history" size={28} color={colors.accent} /></View>
              <Text style={s.emptyText}>Ingen turer ennå.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [s.card, pressed && { opacity: 0.82 }]}
              testID={`trip-${item.trip_id}`}
              onPress={() => openTrip(item)}
            >
              <View style={s.routeRail}>
                <View style={s.pickupDot} />
                <View style={s.routeLine} />
                <View style={s.dropoffDot} />
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.address} numberOfLines={1}>{item.pickup_address}</Text>
                <Text style={[s.address, { marginTop: 5 }]} numberOfLines={1}>{item.dropoff_address}</Text>
                <Text style={s.meta} numberOfLines={1}>
                  {STATUS_LABEL[item.status] || item.status} · {new Date(item.created_at).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })}
                </Text>
              </View>

              <View style={s.priceCol}>
                <Text style={s.rowPrice}>{kr(item.price)}</Text>
                <Icon name="chevron-right" size={16} color={colors.textMuted} />
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { paddingHorizontal: 20, paddingBottom: 14 },
  title: { fontFamily: font.display, fontSize: 28, color: c.text },
  subtitle: { color: c.textMuted, fontSize: 14, marginTop: 5 },
  center: { alignItems: 'center', justifyContent: 'center', paddingTop: 64, gap: 12 },
  emptyOrb: { width: 58, height: 58, borderRadius: 29, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(203,163,101,0.22)' },
  emptyText: { color: c.textMuted, fontSize: 14 },
  summaryCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: c.card, borderRadius: 20, borderWidth: 1, borderColor: c.line, padding: 17, marginBottom: 14 },
  summaryLabel: { color: c.accent, fontSize: 9, letterSpacing: 1.8, fontWeight: '800' },
  summaryValue: { color: c.text, fontFamily: font.display, fontSize: 25, marginTop: 4 },
  tripCountLabel: { color: c.textMuted, fontSize: 9, letterSpacing: 1.6, fontWeight: '700' },
  tripCountValue: { color: c.text, fontFamily: font.display, fontSize: 25, marginTop: 4 },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 13, backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 15, marginBottom: 10 },
  routeRail: { width: 12, alignItems: 'center', paddingTop: 6 },
  pickupDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent },
  routeLine: { width: 1, height: 22, backgroundColor: c.lineStrong, marginVertical: 2 },
  dropoffDot: { width: 8, height: 8, borderRadius: 2, backgroundColor: c.text },
  address: { color: c.text, fontSize: 14 },
  meta: { color: c.textMuted, fontSize: 11, marginTop: 7 },
  priceCol: { alignItems: 'flex-end', gap: 8, paddingLeft: 4 },
  rowPrice: { color: c.text, fontFamily: font.mono, fontSize: 14 },
}));
