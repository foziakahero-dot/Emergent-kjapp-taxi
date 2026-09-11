import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon } from '@/src/components/Icon';
import { Button, Loader } from '@/src/components/ui';
import { tripsApi } from '@/src/lib/api';
import { kr, vehicleMeta } from '@/src/lib/format';

export default function Receipt() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const router = useRouter();
  const [trip, setTrip] = useState<any>(null);
  const [rating, setRating] = useState(0);
  const [rated, setRated] = useState(false);

  useEffect(() => {
    tripsApi.get(tripId!).then((t) => {
      setTrip(t);
      if (t.passenger_rating) { setRating(t.passenger_rating); setRated(true); }
    }).catch(() => {});
  }, [tripId]);

  const submitRating = async (stars: number) => {
    setRating(stars);
    try {
      await tripsApi.rate(tripId!, { rating: stars, feedback: '' });
      setRated(true);
    } catch {}
  };

  if (!trip) return <View style={s.loading}><Loader label="Henter kvittering…" /></View>;

  const v = vehicleMeta(trip.vehicle_type);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
      <View style={[s.header, { paddingTop: insets.top + 20 }]}>
        <View style={s.checkCircle}><Icon name="check" size={34} color={colors.accentOn} /></View>
        <Text style={s.title}>Takk for turen</Text>
        <Text style={s.price}>{kr(trip.price)}</Text>
      </View>

      <View style={s.body}>
        <View style={s.card}>
          <Row label="Fra" value={trip.pickup_address} />
          <View style={s.sep} />
          <Row label="Til" value={trip.dropoff_address} />
          <View style={s.sep} />
          <Row label="Avstand" value={`${trip.distance_km} km`} />
          <View style={s.sep} />
          <Row label="Varighet" value={`${trip.duration_min} min`} />
          <View style={s.sep} />
          <Row label="Kjøretøy" value={v.name} />
        </View>

        {trip.driver ? (
          <View style={[s.card, { marginTop: 16 }]}>
            <Text style={s.overline}>Din sjåfør</Text>
            <Text style={s.driverName}>{trip.driver.name}</Text>
            <Text style={s.driverCar}>{trip.driver.car} · {trip.driver.plate}</Text>
          </View>
        ) : null}

        <View style={[s.card, { marginTop: 16, alignItems: 'center' }]}>
          <Text style={s.overline}>{rated ? 'Din vurdering' : 'Vurder turen'}</Text>
          <View style={s.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => !rated && submitRating(n)} disabled={rated} testID={`rate-star-${n}`}>
                <Icon name="star" size={34} color={n <= rating ? colors.accent : colors.line} fill={n <= rating ? colors.accent : 'none'} />
              </Pressable>
            ))}
          </View>
          {rated ? <Text style={s.thanks}>Takk for tilbakemeldingen!</Text> : null}
        </View>

        <Button label="Ferdig" onPress={() => router.replace('/(app)/home')} testID="receipt-done" style={{ marginTop: 24 }} />
      </View>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const s = useStyles();
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  loading: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' },
  header: { alignItems: 'center', paddingBottom: 28 },
  checkCircle: { width: 76, height: 76, borderRadius: 38, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { color: c.text, fontFamily: font.display, fontSize: 24 },
  price: { color: c.accent, fontFamily: font.display, fontSize: 40, marginTop: 8 },
  body: { paddingHorizontal: 20 },
  card: { backgroundColor: c.card, borderRadius: 20, borderWidth: 1, borderColor: c.line, padding: 18 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  rowLabel: { color: c.textMuted, fontSize: 13 },
  rowValue: { color: c.text, fontSize: 14, flex: 1, textAlign: 'right' },
  sep: { height: 1, backgroundColor: c.line, marginVertical: 12 },
  overline: { color: c.accent, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },
  driverName: { color: c.text, fontSize: 16, fontWeight: '600', marginTop: 6 },
  driverCar: { color: c.textMuted, fontSize: 13, marginTop: 2 },
  stars: { flexDirection: 'row', gap: 10, marginTop: 14 },
  thanks: { color: c.textMuted, fontSize: 13, marginTop: 12 },
}));
