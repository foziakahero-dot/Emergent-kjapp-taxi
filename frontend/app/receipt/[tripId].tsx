import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Share } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Loader } from '@/src/components/ui';
import { CustomerReceiptView } from '@/src/components/CustomerReceiptView';
import { V10Screen, V10State } from '@/src/components/V10UI';
import { payNative } from '@/src/lib/nativePayment';
import { paymentApi, tripsApi, tripDriverPhotoSource } from '@/src/lib/api';
import { apiError, kr } from '@/src/lib/format';

const CHECKOUT_ORIGIN = process.env.EXPO_PUBLIC_CHECKOUT_ORIGIN || 'https://kjappapp.no';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function Receipt() {
  const { tripId, view } = useLocalSearchParams<{ tripId: string; view?: string }>();
  const router = useRouter();
  const [trip, setTrip] = useState<any>(null);
  const [rating, setRating] = useState(0);
  const [rated, setRated] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [loadError, setLoadError] = useState(false);
  const [ratingBusy, setRatingBusy] = useState(false), [ratingError, setRatingError] = useState('');
  const [photo, setPhoto] = useState<any>(null);
  const ratingLock = useRef(false), loadSequence = useRef(0), mounted = useRef(true), currentRoute = useRef(tripId);
  currentRoute.current = tripId;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; loadSequence.current++; }; }, []);
  const routeIsCurrent = () => mounted.current && currentRoute.current === tripId;

  const loadTrip = useCallback(async () => {
    if (!tripId) return null;
    const request = ++loadSequence.current;
    try {
      const t = await tripsApi.get(tripId);
      if (!routeIsCurrent() || request !== loadSequence.current) return null;
      if (t?.trip_id !== tripId) throw new Error('Turen ble ikke bekreftet.');
      setTrip(t);
      setLoadError(false);
      if (t.passenger_rating) {
        setRating(t.passenger_rating);
        setRated(true);
      }
      return t;
    } catch {
      if (routeIsCurrent() && request === loadSequence.current) setLoadError(true);
      return null;
    }
  }, [tripId]);

  useEffect(() => { setTrip(null); setRating(0); setRated(false); setRatingError(''); setPaymentError(''); void loadTrip(); }, [loadTrip]);
  useEffect(() => {
    let active = true;
    setPhoto(null);
    if (trip?.driver_id) void tripDriverPhotoSource(tripId!).then(source => { if (active) setPhoto(source); }).catch(() => {});
    return () => { active = false; };
  }, [tripId, trip?.driver_id]);

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

  const submitRating = async (feedback: string) => {
    if (!tripId || ratingLock.current || rated || trip?.payment_status !== 'paid' || !['arrived', 'completed'].includes(trip?.status) || !Number.isInteger(rating) || rating < 1 || rating > 5) return;
    ratingLock.current = true; setRatingBusy(true); setRatingError('');
    try {
      const confirmed = await tripsApi.rate(tripId, { rating, feedback });
      if (confirmed?.ok !== true) throw new Error('Vurderingen ble ikke bekreftet.');
      if (routeIsCurrent()) { setRated(true); setTrip((previous: any) => ({ ...previous, passenger_rating: rating, status: 'rated' })); }
    } catch (error) {
      const canonical = await loadTrip();
      if (routeIsCurrent() && !canonical?.passenger_rating) setRatingError(`Vurderingen ble ikke lagret. ${apiError(error)}`);
    } finally { ratingLock.current = false; if (routeIsCurrent()) setRatingBusy(false); }
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

  const paymentLock = useRef(false);
  const pay = async () => {
    if (!tripId || paying || paymentLock.current || trip?.payment_status === 'paid' || trip?.payment_flow === 'reservation' || !['arrived', 'completed'].includes(trip?.status)) return;
    paymentLock.current = true;
    setPaymentError('');
    setPaying(true);
    try {
      const nativeResult = await payNative(tripId);
      if (nativeResult !== null) {
        await loadTrip();
        if (!nativeResult && routeIsCurrent()) setPaymentError('Betalingen er ikke bekreftet. Du kan åpne betalingen igjen eller sjekke status.');
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
      if (!paid && routeIsCurrent()) {
        setPaymentError('Betalingen er ikke bekreftet ennå. Hvis du betalte, vent noen sekunder og prøv «Sjekk betaling».');
      }
    } catch (e) {
      if (routeIsCurrent()) setPaymentError(apiError(e));
    } finally {
      paymentLock.current = false;
      if (routeIsCurrent()) setPaying(false);
    }
  };

  const home = () => router.replace('/(app)/home');
  if (!trip) return <V10Screen>{loadError ? <V10State warning icon="wifiOff" title="Kunne ikke hente kvitteringen" body="Sjekk forbindelsen og prøv igjen. Ingen betaling startes på nytt automatisk." action="Prøv igjen" onAction={() => void loadTrip()} /> : <Loader label="Henter kvittering…" />}</V10Screen>;
  if (!['arrived', 'completed', 'rated'].includes(trip.status)) return <V10Screen><V10State icon="trip" title="Turen er ikke avsluttet" body="Åpne turen for å se bekreftet status." action="Åpne tur" onAction={() => router.replace(`/booking/${tripId}`)} /></V10Screen>;
  const shareReceipt = async () => {
    try { await Share.share({ message: [`SNAR · ${trip.receipt_id || trip.trip_id}`, trip.pickup_address, `Til ${trip.dropoff_address || 'destinasjon'}`, kr(trip.price), trip.payment_status === 'paid' ? 'Betaling registrert' : 'Betaling ikke bekreftet'].filter(Boolean).join('\n') }); }
    catch (error) { if (routeIsCurrent()) setPaymentError(`Kunne ikke åpne deling. ${apiError(error)}`); }
  };
  return <CustomerReceiptView key={tripId} trip={trip} initialReceipt={view === 'receipt'} rating={rating} rated={rated}
    ratingBusy={ratingBusy} ratingError={ratingError} paymentBusy={paying} paymentError={paymentError} refreshError={loadError} photo={photo}
    onPhotoError={() => setPhoto(null)} onRating={setRating} onSubmit={feedback => void submitRating(feedback)} onPay={() => void pay()}
    onRefresh={() => void loadTrip()} onHome={home} onBack={() => router.back()} onSupport={() => router.push('/support')}
    onShare={() => void shareReceipt()} />;
}
