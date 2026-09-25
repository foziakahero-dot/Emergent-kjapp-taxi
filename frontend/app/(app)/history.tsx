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
  completed: 'Fullført',
  rated: 'Fullført',
  arrived: 'Fullført',
  cancelled: 'Avbrutt',
  cancelled_by_driver: 'Avbrutt',
  in_trip: 'Pågår',
  driver_on_way: 'Pågår',
  searching: 'Søker',
};

export default function History() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const router = useRouter();
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['trips'],
    queryFn: tripsApi.list,
  });

  const trips = (data?.trips || []).filter((t: any) => t.status !== 'searching' && t.status !== 'booking');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Text style={s.title}>Dine turer</Text>
      </View>
      {isLoading ? (
        <View style={s.center}><Loader label="Henter turer…" /></View>
      ) : isError ? (
        <View style={s.center} testID="history-load-error">
          <Icon name="history" size={40} color={colors.textMuted} />
          <Text style={s.emptyText}>Kunne ikke hente turhistorikken.</Text>
          <Pressable style={s.retry} onPress={() => refetch()} testID="history-retry">
            <Text style={s.retryText}>Prøv igjen</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(t) => t.id || t.trip_id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />}
          ListEmptyComponent={
            <View style={s.center}>
              <Icon name="history" size={40} color={colors.textMuted} />
              <Text style={s.emptyText}>Ingen turer ennå.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const receiptState = ['completed', 'rated', 'arrived'].includes(item.status);
            const statusLabel = item.status === 'arrived' && item.payment_status !== 'paid'
              ? 'Betaling gjenstår'
              : STATUS_LABEL[item.status] || item.status;
            return (
              <Pressable
                style={s.row}
                testID={`trip-${item.trip_id}`}
                onPress={() => receiptState && router.push(`/receipt/${item.trip_id}`)}
              >
                <View style={s.rowIcon}>
                  <Icon name="navigation" size={18} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle} numberOfLines={1}>{item.dropoff_address}</Text>
                  <Text style={s.rowSub} numberOfLines={1}>
                    {new Date(item.created_at).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })} · {statusLabel}
                  </Text>
                </View>
                <Text style={s.rowPrice}>{kr(item.price)}</Text>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontFamily: font.display, fontSize: 28, color: c.text },
  center: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { color: c.textMuted, fontSize: 14, textAlign: 'center' },
  retry: { minHeight: 44, borderRadius: 12, backgroundColor: c.accent, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  retryText: { color: c.accentOn, fontFamily: font.bold, fontSize: 13 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: c.line,
  },
  rowIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.cardSubtle, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { color: c.text, fontSize: 15 },
  rowSub: { color: c.textMuted, fontSize: 12, marginTop: 3 },
  rowPrice: { color: c.text, fontFamily: font.mono, fontSize: 15 },
}));
