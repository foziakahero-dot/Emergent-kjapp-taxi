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
  const [rating, setRating] = useState(5);
  const [rated, setRated] = useState(false);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const loadTrip = useCallback(async () => {
    if (!tripId) return null;
    try {
      const t = await tripsApi.get(tripId);
      setTrip(t);
      if (t.passenger_rating) {
        setRating(t.passenger_rating);
        setRated(true);
      }
      return t;
    } catch {
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

  const submitRating = async () => {
    if (rated || ratingBusy || !rating) return;
    setRatingBusy(true);
    try {
      await tripsApi.rate(tripId!, { rating, feedback: '' });
      setRated(true);
    } catch {
      // Keep the selected stars so the passenger can retry.
    } finally {
      setRatingBusy(false);
    }
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

  if (!trip) return <View style={s.loading}><Loader label="Henter kvittering…" /></View>;

  const v = vehicleMeta(trip.vehicle_type);
  const isPaid = trip.payment_status === 'paid';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}>
      <View style={[s.header, { paddingTop: insets.top + 24 }]}>
        <View style={[s.checkCircle, !isPaid && s.pendingCircle]}>
          <Icon name={isPaid ? 'check' : 'card'} size={30} color={isPaid ? colors.accentOn : colors.accent} />
        </View>
        <Text style={s.receiptLabel}>KVITTERING</Text>
        <Text style={s.title}>Takk for turen</Text>
        <Text style={s.price} testID="receipt-total">{kr(trip.price)}</Text>
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
          {trip.driver?.name ? (
            <>
              <View style={s.sep} />
              <Row label="Sjåfør" value={`${trip.driver.name}${trip.driver.car ? ` · ${trip.driver.car}` : ''}`} />
            </>
          ) : null}
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
            <View style={s.paidIcon}><Icon name="check" size={18} color={colors.accentOn} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.paidTitle}>Betaling fullført</Text>
              <Text style={s.paidSub}>Kvitteringen er registrert på turen.</Text>
            </View>
          </View>
        )}

        <View style={[s.card, s.ratingCard]}>
          <Text style={s.ratingTitle}>{rated ? 'Din vurdering' : 'Vurder turen'}</Text>
          <Text style={s.ratingSub}>{rated ? 'Takk for tilbakemeldingen' : 'Hvordan var opplevelsen?'}</Text>
          <View style={s.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => !rated && setRating(n)} disabled={rated} testID={`rate-star-${n}`}>
                <Icon name="star" size={34} color={n <= rating ? colors.accent : colors.textMuted} fill={n <= rating ? colors.accent : 'none'} />
              </Pressable>
            ))}
          </View>
          {!rated ? (
            <Pressable style={[s.ratingSubmit, ratingBusy && { opacity: 0.6 }]} onPress={submitRating} disabled={ratingBusy} testID="rate-submit">
              <Text style={s.ratingSubmitText}>{ratingBusy ? 'Sender…' : 'Send vurdering'}</Text>
            </Pressable>
          ) : null}
        </View>

        <Pressable style={s.doneBtn} onPress={() => router.replace('/(app)/home')} testID="receipt-done">
          <Text style={s.doneText}>Ferdig</Text>
        </Pressable>
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
  header: { alignItems: 'center', paddingBottom: 30 },
  checkCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 14, shadowColor: c.accent, shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  pendingCircle: { backgroundColor: c.accentSoft, borderWidth: 1, borderColor: c.accent, shadowOpacity: 0 },
  receiptLabel: { color: c.accent, fontSize: 10, letterSpacing: 2.2, fontWeight: '800' },
  title: { color: c.text, fontSize: 18, fontWeight: '600', marginTop: 4 },
  price: { color: c.text, fontFamily: font.display, fontSize: 52, marginTop: 18 },
  paymentStatus: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  body: { paddingHorizontal: 20 },
  card: { backgroundColor: c.card, borderRadius: 20, borderWidth: 1, borderColor: c.line, padding: 18 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  rowLabel: { color: c.textMuted, fontSize: 13 },
  rowValue: { color: c.text, fontSize: 14, flex: 1, textAlign: 'right' },
  sep: { height: 1, backgroundColor: c.line, marginVertical: 12 },
  paymentCard: { marginTop: 16, borderColor: 'rgba(203,163,101,0.35)' },
  paymentHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  paymentIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' },
  paymentTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
  paymentSub: { color: c.textMuted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  refreshPayment: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 12, marginTop: 6 },
  refreshText: { color: c.textSecondary, fontSize: 13 },
  paymentError: { color: c.danger, fontSize: 12, lineHeight: 17, marginTop: 4, textAlign: 'center' },
  paidCard: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: 'rgba(47,224,140,0.32)' },
  paidIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.online, alignItems: 'center', justifyContent: 'center' },
  paidTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
  paidSub: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  ratingCard: { marginTop: 16, alignItems: 'center' },
  ratingTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
  ratingSub: { color: c.textMuted, fontSize: 13, marginTop: 4 },
  stars: { flexDirection: 'row', gap: 10, marginTop: 16 },
  ratingSubmit: { alignSelf: 'stretch', marginTop: 18, height: 48, borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.cardSubtle, alignItems: 'center', justifyContent: 'center' },
  ratingSubmitText: { color: c.text, fontSize: 14, fontWeight: '600' },
  doneBtn: { marginTop: 20, height: 52, borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: c.cardSubtle, alignItems: 'center', justifyContent: 'center' },
  doneText: { color: c.text, fontSize: 15, fontWeight: '600' },
}));