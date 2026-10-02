import { Text } from '@/src/components/Typography';
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon } from '@/src/components/Icon';
import { Button, Loader } from '@/src/components/ui';
import { payNative } from '@/src/lib/nativePayment';
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
    if (!tripId || trip?.payment_status !== 'paid' || trip?.status !== 'arrived') return;
    // Payment success normally closes the ride server-side. This is a safe fallback
    // for a legacy/in-flight record that became paid before the new transition existed.
    let cancelled = false;
    (async () => {
      try {
        await tripsApi.complete(tripId);
        if (!cancelled) await loadTrip();
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [tripId, trip?.payment_status, trip?.status, loadTrip]);

  useEffect(() => {
    if (!tripId || trip?.payment_status === 'paid') return;
    const timer = setInterval(() => {
      loadTrip();
    }, 5000);
    return () => clearInterval(timer);
  }, [tripId, trip?.payment_status, loadTrip]);

  const submitRating = async (stars: number) => {
    if (!tripId || trip?.payment_status !== 'paid') return;
    setRating(stars);
    try {
      await tripsApi.rate(tripId, { rating: stars, feedback: '' });
      setRated(true);
    } catch {
      await loadTrip();
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
      const nativeResult = await payNative(tripId);
      if (nativeResult !== null) {
        await loadTrip();
        if (!nativeResult) setPaymentError('Betalingen er ikke bekreftet. Du kan åpne betalingen igjen eller sjekke status.');
        return;
      }
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
  const paymentNeedsAction = trip.payment_status === 'requires_action' || trip.payment_status === 'failed';
  const paymentLabel = isPaid ? 'Betalt' : paymentNeedsAction ? 'Betaling må fullføres' : 'Venter på betaling';
  const paymentHint = paymentNeedsAction
    ? 'Automatisk betaling kunne ikke fullføres uten ny godkjenning. Du kan betale sikkert med kort nedenfor.'
    : 'Stripe åpnes i et sikkert betalingsvindu. Beløpet kommer fra turen på serveren.';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[s.screen, { paddingTop: insets.top + 22, paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={s.receiptHeader}>
        <View style={[s.statusCheck, !isPaid && s.pendingCircle]}>
          <Icon name={isPaid ? 'check' : 'card'} size={20} color={isPaid ? colors.accentOn : colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.receiptEyebrow, { color: isPaid ? colors.online : colors.warning }]}>
            {isPaid ? 'BETALT AUTOMATISK' : paymentLabel.toUpperCase()}
          </Text>
          <Text style={s.receiptTitle}>Takk for turen!</Text>
        </View>
      </View>

      <View style={s.fareCard}>
        <View style={s.fareRow}><Text style={s.fareLabel}>Avstand</Text><Text style={s.fareValue}>{trip.distance_km} km</Text></View>
        <View style={s.fareRow}><Text style={s.fareLabel}>Varighet</Text><Text style={s.fareValue}>{trip.duration_min} min</Text></View>
        <View style={s.fareRow}><Text style={s.fareLabel}>Kjøretøy</Text><Text style={s.fareValue}>{v.name}</Text></View>
        {trip.receipt_id ? <View style={s.fareRow}><Text style={s.fareLabel}>Kvittering</Text><Text style={s.fareValue} numberOfLines={1}>{trip.receipt_id}</Text></View> : null}
        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Totalt</Text>
          <Text style={s.totalValue}>{kr(trip.price)}</Text>
        </View>
        <View style={s.paymentFoot}>
          <Icon name="card" size={15} color={colors.textSecondary} />
          <Text style={s.paymentFootText}>{isPaid ? 'Betaling registrert' : paymentLabel}</Text>
        </View>
      </View>

      {!isPaid ? (
        <View style={s.paymentCard}>
          <View style={s.paymentHead}>
            <View style={s.paymentIcon}><Icon name="lock" size={18} color={colors.accent} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.paymentTitle}>Betal turen sikkert</Text>
              <Text style={s.paymentSub}>{paymentHint}</Text>
            </View>
          </View>
          <Button label={`Betal ${kr(trip.price)} med kort`} onPress={pay} loading={paying} testID="receipt-pay" style={{ marginTop: 16 }} />
          <Pressable onPress={loadTrip} disabled={paying} style={s.refreshPayment} testID="receipt-check-payment">
            <Icon name="history" size={15} color={colors.textSecondary} />
            <Text style={s.refreshText}>Sjekk betaling</Text>
          </Pressable>
          {paymentError ? <Text style={s.paymentError}>{paymentError}</Text> : null}
        </View>
      ) : null}

      <View style={s.ratingCard}>
        {trip.driver ? (
          <View style={s.driverRow}>
            <View style={s.driverAvatar}>
              <Text style={s.driverAvatarText}>{String(trip.driver.name || 'K').slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.driverName}>{trip.driver.name}</Text>
              <Text style={s.driverCar}>{trip.driver.car} · {trip.driver.plate}</Text>
            </View>
          </View>
        ) : null}
        <Text style={s.ratingPrompt}>{rated ? 'Takk for vurderingen!' : 'Hvordan var turen?'}</Text>
        {isPaid ? (
          <View style={s.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => !rated && submitRating(n)} disabled={rated} testID={`rate-star-${n}`} style={s.starHit} accessibilityRole="button" accessibilityLabel={`${n} stjerner`}>
                <Icon name="star" size={30} color={n <= rating ? colors.accent : colors.lineStrong} fill={n <= rating ? colors.accent : 'none'} />
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={s.ratingLocked}>Vurdering åpnes når betalingen er bekreftet.</Text>
        )}
      </View>

      {isPaid ? (
        <Button label="Ferdig" onPress={() => router.replace('/(app)/home')} testID="receipt-done" style={{ marginTop: 22 }} />
      ) : null}
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  loading: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  loadErrorIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: c.accentSoft, borderWidth: 1, borderColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  loadErrorTitle: { color: c.text, fontFamily: font.semibold, fontSize: 20, marginTop: 16, textAlign: 'center' },
  loadErrorSub: { color: c.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 8 },
  retryBtn: { minHeight: 50, borderRadius: 25, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, marginTop: 18 },
  retryBtnText: { color: c.accentOn, fontFamily: font.bold, fontSize: 14 },

  screen: { paddingHorizontal: 28, backgroundColor: c.bg },
  receiptHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusCheck: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.online },
  pendingCircle: { backgroundColor: c.accentSoft, borderWidth: 1, borderColor: c.accent },
  receiptEyebrow: { fontFamily: font.mono, fontSize: 10, letterSpacing: 1.4 },
  receiptTitle: { color: c.text, fontFamily: font.semibold, fontSize: 20, marginTop: 2 },

  fareCard: { marginTop: 24, borderRadius: 24, padding: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line },
  fareRow: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  fareLabel: { color: c.textSecondary, fontSize: 14 },
  fareValue: { maxWidth: '58%', color: c.text, fontFamily: font.medium, fontSize: 14, textAlign: 'right' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: c.line },
  totalLabel: { color: c.text, fontFamily: font.semibold, fontSize: 16 },
  totalValue: { color: c.text, fontFamily: font.semibold, fontSize: 16 },
  paymentFoot: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 10 },
  paymentFootText: { color: c.textSecondary, fontSize: 12 },

  paymentCard: { marginTop: 16, borderRadius: 20, borderWidth: 1, borderColor: c.line, padding: 18, backgroundColor: c.surface },
  paymentHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  paymentIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' },
  paymentTitle: { color: c.text, fontFamily: font.semibold, fontSize: 15 },
  paymentSub: { color: c.textMuted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  refreshPayment: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 6 },
  refreshText: { color: c.textSecondary, fontSize: 13 },
  paymentError: { color: c.danger, fontSize: 12, lineHeight: 17, marginTop: 4, textAlign: 'center' },

  ratingCard: { marginTop: 22, alignItems: 'center', borderRadius: 24, padding: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line },
  driverRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 12, backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line },
  driverAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent },
  driverAvatarText: { color: c.accentOn, fontFamily: font.bold, fontSize: 18 },
  driverName: { color: c.text, fontFamily: font.semibold, fontSize: 14 },
  driverCar: { color: c.textSecondary, fontFamily: font.mono, fontSize: 10.5, marginTop: 3 },
  ratingPrompt: { color: c.text, fontFamily: font.medium, fontSize: 14, marginTop: 16 },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 2, marginTop: 10 },
  starHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  ratingLocked: { color: c.textMuted, fontSize: 12, marginTop: 10, textAlign: 'center' },
}));


