import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon } from '@/src/components/Icon';
import { Button, Loader } from '@/src/components/ui';
import { paymentApi, tripsApi } from '@/src/lib/api';
import { apiError, kr, vehicleMeta } from '@/src/lib/format';

const CHECKOUT_ORIGIN = process.env.EXPO_PUBLIC_CHECKOUT_ORIGIN || 'https://kjappapp.no';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function Receipt() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const router = useRouter();
  const [trip, setTrip] = useState<any>(null);
  const [rating, setRating] = useState(0);
  const [rated, setRated] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [loadError, setLoadError] = useState(false);

  const loadTrip = useCallback(async () => {
    if (!tripId) return null;
    try {
      const t = await tripsApi.get(tripId);
      setTrip(t);
      setLoadError(false);
      if (t.passenger_rating) {
        setRating(t.passenger_rating);
        setRated(true);
      }
      return t;
    } catch {
      setLoadError(true);
      return null;
    }
  }, [tripId]);

  useEffect(() => {
    loadTrip();
  }, [loadTrip]);

  useEffect(() => {
    if (!tripId || trip?.payment_status === 'paid') return;
    const timer = setInterval(() => {
      loadTrip();
    }, 5000);
    return () => clearInterval(timer);
  }, [tripId, trip?.payment_status, loadTrip]);

  const submitRating = async (stars: number) => {
    setRating(stars);
    try {
      await tripsApi.rate(tripId!, { rating: stars, feedback: '' });
      setRated(true);
    } catch {}
  };

  const verifyCheckout = async (sessionId: string) => {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      try {
        const status = await paymentApi.checkoutStatus(sessionId);
        if (status?.payment_status === 'paid') {
          await loadTrip();
          return true;
        }
        if (status?.payment_status === 'failed' || status?.payment_status === 'expired') {
          return false;
        }
      } catch {}
      await sleep(1500);
    }
    const latest = await loadTrip();
    return latest?.payment_status === 'paid';
  };

  const pay = async () => {
    if (!tripId || paying) return;
    setPaymentError('');
    setPaying(true);
    try {
      const result = await paymentApi.checkout(tripId, CHECKOUT_ORIGIN);
      if (!result?.checkout_url || !result?.session_id) throw new Error('Stripe svarte uten betalingslenke.');

      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') window.location.assign(result.checkout_url);
        return;
      }

      await WebBrowser.openBrowserAsync(result.checkout_url);
      const paid = await verifyCheckout(result.session_id);
      if (!paid) {
        setPaymentError('Betalingen er ikke bekreftet ennå. Hvis du betalte, vent noen sekunder og prøv «Sjekk betaling».');
      }
    } catch (e) {
      setPaymentError(apiError(e));
    } finally {
      setPaying(false);
    }
  };

  if (!trip) {
    if (loadError) {
      return (
        <View style={s.loading} testID="receipt-load-error">
          <View style={s.loadErrorIcon}><Icon name="file-text" size={24} color={colors.accent} /></View>
          <Text style={s.loadErrorTitle}>Kunne ikke hente kvitteringen</Text>
          <Text style={s.loadErrorSub}>Sjekk nettet ditt og prøv igjen. Ingen betaling startes på nytt automatisk.</Text>
          <Pressable style={s.retryBtn} onPress={loadTrip} testID="receipt-retry">
            <Text style={s.retryBtnText}>Prøv igjen</Text>
          </Pressable>
        </View>
      );
    }
    return <View style={s.loading}><Loader label="Henter kvittering…" /></View>;
  }

  const v = vehicleMeta(trip.vehicle_type);
  const isPaid = trip.payment_status === 'paid';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
      <View style={[s.header, { paddingTop: insets.top + 20 }]}>
        <View style={[s.checkCircle, !isPaid && s.pendingCircle]}>
          <Icon name={isPaid ? 'check' : 'card'} size={34} color={isPaid ? colors.accentOn : colors.accent} />
        </View>
        <Text style={s.title}>Takk for turen</Text>
        <Text style={s.price}>{kr(trip.price)}</Text>
        <Text style={[s.paymentStatus, { color: isPaid ? colors.online : colors.warning }]} testID="receipt-payment-status">
          {isPaid ? 'Betalt' : 'Venter på betaling'}
        </Text>
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

        {!isPaid ? (
          <View style={[s.card, s.paymentCard]}>
            <View style={s.paymentHead}>
              <View style={s.paymentIcon}><Icon name="lock" size={18} color={colors.accent} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.paymentTitle}>Betal turen sikkert</Text>
                <Text style={s.paymentSub}>Stripe åpnes i et sikkert betalingsvindu. Beløpet kommer fra turen på serveren.</Text>
              </View>
            </View>
            <Button label={`Betal ${kr(trip.price)} med kort`} onPress={pay} loading={paying} testID="receipt-pay" style={{ marginTop: 16 }} />
            <Pressable onPress={loadTrip} disabled={paying} style={s.refreshPayment} testID="receipt-check-payment">
              <Icon name="history" size={15} color={colors.textSecondary} />
              <Text style={s.refreshText}>Sjekk betaling</Text>
            </Pressable>
            {paymentError ? <Text style={s.paymentError}>{paymentError}</Text> : null}
          </View>
        ) : (
          <View style={[s.card, s.paidCard]} testID="receipt-paid-banner">
            <View style={s.paidIcon}><Icon name="check" size={18} color={colors.bg} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.paidTitle}>Betaling fullført</Text>
              <Text style={s.paidSub}>Kvitteringen er registrert på turen.</Text>
            </View>
          </View>
        )}

        {trip.driver ? (
          <View style={[s.card, { marginTop: 16 }]}>
            <Text style={s.overline}>DIN SJÅFØR</Text>
            <Text style={s.driverName}>{trip.driver.name}</Text>
            <Text style={s.driverCar}>{trip.driver.car} · {trip.driver.plate}</Text>
          </View>
        ) : null}

        <View style={[s.card, { marginTop: 16, alignItems: 'center' }]}>
          <Text style={s.overline}>{rated ? 'DIN VURDERING' : 'VURDER TUREN'}</Text>
          <View style={s.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => !rated && submitRating(n)} disabled={rated} testID={`rate-star-${n}`} style={s.starHit} accessibilityRole="button" accessibilityLabel={`${n} stjerner`}>
                <Icon name="star" size={30} color={n <= rating ? colors.accent : colors.lineStrong} fill={n <= rating ? colors.accent : 'none'} />
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
  loading: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  loadErrorIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: c.accentSoft, borderWidth: 1, borderColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  loadErrorTitle: { color: c.text, fontFamily: font.display, fontSize: 20, marginTop: 16, textAlign: 'center' },
  loadErrorSub: { color: c.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 8 },
  retryBtn: { minHeight: 50, borderRadius: 14, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, marginTop: 18 },
  retryBtnText: { color: c.accentOn, fontFamily: font.bold, fontSize: 14 },
  header: { alignItems: 'center', paddingBottom: 28 },
  checkCircle: { width: 76, height: 76, borderRadius: 38, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  pendingCircle: { backgroundColor: c.accentSoft, borderWidth: 1, borderColor: c.accent },
  title: { color: c.text, fontFamily: font.display, fontSize: 24 },
  price: { color: c.accent, fontFamily: font.mono, fontSize: 38, marginTop: 8 },
  paymentStatus: { fontFamily: font.bold, fontSize: 11, letterSpacing: 1.2, marginTop: 5 },
  body: { paddingHorizontal: 20 },
  card: { backgroundColor: c.card, borderRadius: 20, borderWidth: 1, borderColor: c.line, padding: 18 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  rowLabel: { color: c.textMuted, fontSize: 13 },
  rowValue: { color: c.text, fontFamily: font.medium, fontSize: 14, flex: 1, textAlign: 'right' },
  sep: { height: 1, backgroundColor: c.line, marginVertical: 12 },
  paymentCard: { marginTop: 16, borderColor: 'rgba(0,229,245,0.35)' },
  paymentHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  paymentIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' },
  paymentTitle: { color: c.text, fontFamily: font.semibold, fontSize: 15 },
  paymentSub: { color: c.textMuted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  refreshPayment: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 6 },
  refreshText: { color: c.textSecondary, fontSize: 13 },
  paymentError: { color: c.danger, fontSize: 12, lineHeight: 17, marginTop: 4, textAlign: 'center' },
  paidCard: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: 'rgba(57,229,140,0.32)' },
  paidIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.online, alignItems: 'center', justifyContent: 'center' },
  paidTitle: { color: c.text, fontFamily: font.semibold, fontSize: 15 },
  paidSub: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  overline: { color: c.accent, fontFamily: font.bold, fontSize: 9, letterSpacing: 1.7 },
  driverName: { color: c.text, fontFamily: font.semibold, fontSize: 16, marginTop: 6 },
  driverCar: { color: c.textMuted, fontSize: 13, marginTop: 2 },
  stars: { flexDirection: 'row', gap: 4, marginTop: 10 },
  starHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  thanks: { color: c.textMuted, fontSize: 13, marginTop: 8 },
}));