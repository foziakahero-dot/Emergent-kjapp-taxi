import { BlurTargetView } from 'expo-blur';
import { useRouteReveal } from '@/src/components/useRouteReveal';
import { V10Entrance } from '@/src/components/V10Entrance';
import { V10Icon } from '@/src/components/V10Icon';
import { v10 } from '@/src/components/V10UI';
import { CustomerBookingView, confirmedPaymentMethod, confirmedWaitingPolicy, type BookingStage } from '@/src/components/CustomerBookingView';
import { recentDestinations } from '@/src/lib/recentPlaces';
import { validPosition } from '@/src/lib/carAvailability';
import { useAvailableCars } from '@/src/lib/useAvailableCars';
import { AvailabilityStatus } from '@/src/components/AvailabilityStatus';
import { ActiveTripCard, LIVE_TRIP_STATUSES } from '@/src/components/ActiveTripCard';
import { useHideTabBar } from '@/src/components/FloatingTabBar';
import { Text, TextInput } from '@/src/components/Typography';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { colors, font, useColorTheme } from '@/src/theme';
import { Map } from '@/src/components/Map';
import { mePlacesApi, paymentApi, placesApi, tripsApi } from '@/src/lib/api';
import { apiError } from '@/src/lib/format';
import { useAuth } from '@/src/context/AuthContext';

const OSLO = { lat: 59.9127, lng: 10.7461 };
export default function Home() {
  useColorTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { retryTripId } = useLocalSearchParams<{ retryTripId?: string }>();
  const insets = useSafeAreaInsets();

  const [activeTrip, setActiveTrip] = useState<any>(null);
  const [activeTripOffline, setActiveTripOffline] = useState(false);
  const [activeTripChecked, setActiveTripChecked] = useState(false);
  const [loc, setLoc] = useState<{ lat: number; lng: number }>(OSLO);
  const [selectedPickup, setSelectedPickup] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const pickupPoint = selectedPickup || loc;
  const [pickupLabel, setPickupLabel] = useState('Finner posisjonen din…');
  const [locDenied, setLocDenied] = useState(false);
  const [locationReady, setLocationReady] = useState(false);
  const [featured, setFeatured] = useState<any[]>([]);
  const [dropoff, setDropoff] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [estimate, setEstimate] = useState<any>(null);
  const [quotedAt, setQuotedAt] = useState<number | null>(null);
  const [quoteRevision, setQuoteRevision] = useState(0);
  const setQuote = useCallback((result: any) => { setEstimate(result); setQuotedAt(result ? Date.now() : null); }, []);
  const [waitingAccepted, setWaitingAccepted] = useState(false);
  const [selType, setSelType] = useState('ai-first');
  const bookingLock = useRef(false);
  const mapBlurTarget = useRef<View>(null);
  const locationSequence = useRef(0);
  const locationRequest = useRef(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(56);
  const [activeCardHeight, setActiveCardHeight] = useState(180);
  const [browseHeight, setBrowseHeight] = useState(100);
  const [mapFocusRevision, setMapFocusRevision] = useState(0);
  const [rideHeight, setRideHeight] = useState(400);
  useEffect(() => {
    if (dropoff) {
      setBookingStage('route');
    }
  }, [dropoff]);
  const [reviewing, setReviewing] = useState(false);
  const [bookingStage, setBookingStage] = useState<BookingStage>('route');
  useHideTabBar(Boolean(dropoff || searchOpen || reviewing));
  const [searchTarget, setSearchTarget] = useState<'pickup' | 'dropoff' | 'stop'>('dropoff');
  const [stops, setStops] = useState<any[]>([]);
  const [specialNeeds, setSpecialNeeds] = useState<string[]>([]);
  const [methods, setMethods] = useState<any[]>([]);
  const [myPlaces, setMyPlaces] = useState<any[]>([]);
  const [recentPlaces, setRecentPlaces] = useState<any[]>([]);
  const [quickPlacesIssue, setQuickPlacesIssue] = useState(false);
  const placesSequence = useRef(0);
  const methodsSequence = useRef(0);
  const searchingTrip = activeTrip && ['searching', 'booking'].includes(activeTrip.status) && !activeTrip.driver_id;
  const available = useAvailableCars({
    enabled: Boolean(searchingTrip || (!activeTrip && (locationReady || selectedPickup))),
    lat: searchingTrip ? activeTrip.pickup_lat : pickupPoint.lat,
    lng: searchingTrip ? activeTrip.pickup_lng : pickupPoint.lng,
    vehicleType: searchingTrip ? activeTrip.vehicle_type : undefined,
    specialNeeds: searchingTrip ? activeTrip.special_needs : specialNeeds,
    // Home quietly refreshes supply; only a real trip shows dispatch/search progress.
    continuous: true,
  });
  const cars = available.cars;

  useEffect(() => {
    if (!retryTripId) return;
    let mounted = true;
    void tripsApi.get(retryTripId).then(t => {
      if (!mounted || t.status !== 'cancelled' || t.cancel_reason !== 'no_driver_available') return;
      setSelectedPickup({ name: t.pickup_address, lat: t.pickup_lat, lng: t.pickup_lng });
      setDropoff({ name: t.dropoff_address, lat: t.dropoff_lat, lng: t.dropoff_lng });
      setSelType(t.vehicle_type || 'ai-first'); setSpecialNeeds(t.special_needs || []); setStops((t.stops || []).map((stop: any) => ({ ...stop, name: stop.address || stop.name })));
      setWaitingAccepted(false); setReviewing(false);
    }).catch(() => { if (mounted) setError('Kunne ikke hente forrige reisemål. Velg hentested og reisemål på nytt.'); });
    return () => { mounted = false; };
  }, [retryTripId]);

  const loadMethods = useCallback(() => {
    const sequence = ++methodsSequence.current;
    setMethods([]);
    paymentApi.list().then(r => { if (sequence === methodsSequence.current) setMethods(Array.isArray(r) ? r : (r?.payment_methods || r?.methods || [])); })
      .catch(() => { if (sequence === methodsSequence.current) setMethods([]); });
  }, [user?.id]);

  const loadPlaces = useCallback(async () => {
    const sequence = ++placesSequence.current;
    const [saved, history] = await Promise.allSettled([mePlacesApi.list(), tripsApi.list()]);
    if (sequence !== placesSequence.current) return;
    if (saved.status === 'fulfilled') setMyPlaces(saved.value.places || []);
    if (history.status === 'fulfilled') setRecentPlaces(recentDestinations(Array.isArray(history.value) ? history.value : (history.value?.trips || [])));
    setQuickPlacesIssue(saved.status === 'rejected' || history.status === 'rejected');
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setActiveTripChecked(false);
      loadMethods();
      loadPlaces();
      let fetching = false;
      const recover = async () => {
        if (fetching) return;
        fetching = true;
        try {
          const t = await tripsApi.active();
          if (active) {
            setActiveTrip(t?.trip_id ? t : null);
            setActiveTripOffline(false);
            setActiveTripChecked(true);
          }
        } catch { if (active) setActiveTripOffline(true); }
        finally { fetching = false; }
      };
      void recover();
      const timer = setInterval(() => { if (AppState.currentState === 'active') void recover(); }, 2500);
      const listener = AppState.addEventListener('change', state => { if (state === 'active') void recover(); });
      return () => { active = false; clearInterval(timer); listener.remove(); };
    }, [loadMethods, loadPlaces, router]),
  );

  const refreshLocation = useCallback(async (requestPermission = true) => {
    if (requestPermission && locationRequest.current) return false;
    if (requestPermission) locationRequest.current = true;
    const sequence = ++locationSequence.current;
    try {
      const { status } = requestPermission
        ? await Location.requestForegroundPermissionsAsync()
        : await Location.getForegroundPermissionsAsync();
      if (sequence !== locationSequence.current) return false;
      if (status !== 'granted') {
        setLocationReady(false);
        setLocDenied(true);
        setPickupLabel('Posisjon ikke tilgjengelig');
        return false;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (sequence !== locationSequence.current) return false;
      if (!validPosition(p)) throw new Error('Ugyldig posisjon');
      setLoc(p);
      setLocationReady(true);
      setLocDenied(false);
      setPickupLabel('Din posisjon');
      placesApi.reverse(p.lat, p.lng).then((r) => { if (sequence === locationSequence.current && r?.label) setPickupLabel(r.label); }).catch(() => {});
      return true;
    } catch {
      if (sequence !== locationSequence.current) return false;
      setLocationReady(false);
      setLocDenied(true);
      setPickupLabel('Posisjon ikke tilgjengelig');
      return false;
    } finally { if (requestPermission) locationRequest.current = false; }
  }, []);

  useEffect(() => {
    // Respect the manual-address choice; only an explicit location action opens the OS prompt.
    void refreshLocation(false);
    let current = true;
    placesApi.list(true).then((r) => { if (current) setFeatured(r.places || []); }).catch(() => {});
    return () => { current = false; locationSequence.current++; };
  }, [refreshLocation]);

  useEffect(() => {
    let current = true;
    setQuote(null);
    if (!dropoff || (!locationReady && !selectedPickup)) return;
    tripsApi.estimate({
      pickup_lat: pickupPoint.lat, pickup_lng: pickupPoint.lng,
      dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng,
      stops: stops.map((x) => ({ address: x.name, lat: x.lat, lng: x.lng })),
    }).then(result => { if (current) { setQuote(result); setError(''); } })
      .catch(error => { if (current) setError(apiError(error)); });
    return () => { current = false; };
  }, [dropoff, locationReady, selectedPickup, pickupPoint.lat, pickupPoint.lng, stops, quoteRevision]);

  const vehicleEtas: Record<string, number> = {};
  for (const car of cars) {
    const eta = Number(car.eta_min);
    if (typeof car.type === 'string' && Number.isFinite(eta) && eta > 0) vehicleEtas[car.type] = Math.min(vehicleEtas[car.type] ?? Infinity, eta);
  }
  const nearest = vehicleEtas[selType] ?? null;
  const priceFor = (type: string) => estimate?.options?.find((o: any) => o.vehicle_type === type)?.price;
  const waitingPolicy = estimate?.options?.find((o: any) => o.vehicle_type === selType)?.waiting_policy;
  useEffect(() => setWaitingAccepted(false), [estimate, selType]);
  const payMethod = confirmedPaymentMethod(methods);
  const quickPlaces = [...myPlaces, ...recentPlaces].filter(place => normalizeSearchPlace(place)).filter((place, index, all) => all.findIndex(other => other.name === place.name && other.lat === place.lat && other.lng === place.lng) === index);

  const openVoice = () => {
    setSearchOpen(false);
    router.push('/(app)/assist');
  };

  const book = async () => {
    if (bookingLock.current || activeTrip || !activeTripChecked || activeTripOffline) return;
    if (!dropoff) return;
    if (!locationReady && !selectedPickup) {
      setError('SNAR trenger en fersk posisjon før du kan bestille tur.');
      return;
    }
    if (!estimate || priceFor(selType) == null) {
      setError('Vi beregner fortsatt rute og pris. Prøv igjen om et øyeblikk.');
      return;
    }
    if (!confirmedWaitingPolicy(waitingPolicy)) {
      setError('Vilkårene for ventetid kunne ikke bekreftes. Oppdater tilbudet.');
      return;
    }
    if (!waitingAccepted) {
      setError('Bekreft ventetid og kortreservasjon før bestilling.');
      return;
    }
    if (!payMethod) {
      setError('Legg til et betalingskort før du bestiller.');
      router.push('/payment-methods');
      return;
    }
    setError('');
    bookingLock.current = true;
    setBooking(true);
    try {
      const trip = await tripsApi.request({
        pickup_address: selectedPickup?.name || pickupLabel,
        pickup_lat: pickupPoint.lat,
        pickup_lng: pickupPoint.lng,
        dropoff_address: dropoff.name,
        dropoff_lat: dropoff.lat,
        dropoff_lng: dropoff.lng,
        vehicle_type: selType,
        stops: stops.map((x) => ({ address: x.name, lat: x.lat, lng: x.lng })),
        special_needs: specialNeeds,
        ...(waitingPolicy ? {
          waiting_policy_token: waitingPolicy.token,
          quoted_price: priceFor(selType),
          quoted_pricing_version: estimate.pricing_version,
        } : {}),
      });
      if (typeof trip?.trip_id !== 'string' || !trip.trip_id.trim()) throw new Error('Bestillingen ble ikke bekreftet av SNAR.');
      router.push(`/booking/${trip.trip_id}`);
    } catch (e: any) {
      try {
        const active = await tripsApi.active();
        if (active?.trip_id) {
          router.replace(`/booking/${active.trip_id}`);
          return;
        }
      } catch {}
      if (e?.response?.data?.detail?.code === 'quote_changed') {
        setWaitingAccepted(false);
        setQuote(null);
        setError('Prisen er endret. Kontroller det nye tilbudet og bekreft på nytt.');
        const fresh = await tripsApi.estimate({
          pickup_lat: pickupPoint.lat, pickup_lng: pickupPoint.lng,
          dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng,
          stops: stops.map((x) => ({ address: x.name, lat: x.lat, lng: x.lng })),
        }).catch(() => null);
        setQuote(fresh);
      } else if (e?.response?.status === 402) {
        setError('Legg til et betalingskort før du bestiller.');
        setTimeout(() => router.push('/payment-methods'), 700);
      } else if (e?.response?.status === 409) {
        setError('En bestilling behandles allerede. SNAR sjekker den aktive turen automatisk.');
      } else {
        setError(apiError(e));
      }
    } finally {
      bookingLock.current = false;
      setBooking(false);
    }
  };

  const routeGeom = estimate?.geometry?.coordinates;
  const previewRoute = useRouteReveal(routeGeom, Boolean(!activeTrip && dropoff));
  // Payment and waiting consent are completed on the review screen.
  const canReview = !activeTrip && activeTripChecked && !activeTripOffline && Boolean((locationReady || selectedPickup) && dropoff && estimate && Number.isFinite(priceFor(selType)) && priceFor(selType) > 0 && !booking);
  const canBook = canReview && Boolean(payMethod && confirmedWaitingPolicy(waitingPolicy) && waitingAccepted);
  const selectedPrice = priceFor(selType);
  const firstName = user?.fullName?.trim().split(/\s+/)[0] || 'SNAR';
  const initials = (user?.fullName || 'SNAR').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <BlurTargetView ref={mapBlurTarget} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Map
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        user={locationReady ? loc : null}
        pickup={activeTrip ? { lat: activeTrip.pickup_lat, lng: activeTrip.pickup_lng } : (locationReady || selectedPickup) ? pickupPoint : null}
        dropoff={activeTrip ? { lat: activeTrip.dropoff_lat, lng: activeTrip.dropoff_lng } : dropoff}
        route={activeTrip ? activeTrip.geometry?.coordinates : previewRoute}
        focusRoute={!activeTrip && dropoff ? routeGeom : undefined}
        cars={activeTrip && !searchingTrip ? [] : cars}
        showControls={Boolean(activeTrip)}
        focusRevision={mapFocusRevision}
        focusMode={searchingTrip || (!activeTrip && !dropoff) ? 'nearby' : 'route'}
        contentInsets={{ top: insets.top + (activeTrip ? 16 + activeCardHeight : 12 + headerHeight) + 32,
          right: 48, bottom: Math.max(insets.bottom + 112, activeTrip ? 0 : dropoff ? rideHeight : browseHeight) + 32, left: 48 }}
        activeCar={activeTrip && LIVE_TRIP_STATUSES.includes(activeTrip.status) && activeTrip.driver_lat != null ? { lat: activeTrip.driver_lat, lng: activeTrip.driver_lng, heading: activeTrip.driver_heading } : null}
        testID="home-map"
      />
      </BlurTargetView>

      {activeTrip ? <View testID="home-active-card" onLayout={e => setActiveCardHeight(e.nativeEvent.layout.height)} style={{ position: 'absolute', top: insets.top + 16, left: 16, right: 16 }}>
        <ActiveTripCard trip={activeTrip} offline={activeTripOffline} onOpen={() => router.push(activeTrip.status === 'arrived' ? `/receipt/${activeTrip.trip_id}` : `/booking/${activeTrip.trip_id}`)} />
        {searchingTrip ? <AvailabilityStatus search={available} trip={activeTrip} /> : null}
      </View> : activeTripOffline ? <View style={{ position: 'absolute', top: insets.top + 78, left: 16, right: 16, padding: 12, backgroundColor: colors.surface, borderRadius: 16 }}><Text accessibilityRole="alert">Kan ikke bekrefte aktiv tur. Bestilling er midlertidig utilgjengelig.</Text></View> : null}
      {!activeTrip ? <CustomerBookingView
        stage={bookingStage} reviewing={reviewing} pickup={selectedPickup?.name || pickupLabel}
        destination={dropoff} estimate={estimate} quotedAt={quotedAt} vehicle={selType} price={selectedPrice}
        nearest={nearest} vehicleEtas={vehicleEtas} payment={payMethod} methods={methods} waitingPolicy={waitingPolicy}
        waitingAccepted={waitingAccepted} busy={booking} canReview={canReview} canBook={canBook}
        mapBlurTarget={mapBlurTarget} avatarVersion={user?.customer_photo_version} error={error} firstName={firstName} initials={initials} places={quickPlaces} placesIssue={quickPlacesIssue}
        locationReady={Boolean(locationReady || selectedPickup)} stops={stops}
        onStage={setBookingStage} onReview={setReviewing} onVehicle={setSelType}
        onSearch={target => { setSearchTarget(target); setReviewing(false); setSearchOpen(true); }}
        onPlace={place => { const destination = normalizeSearchPlace(place); if (destination) { setQuote(null); setMapFocusRevision(value => value + 1); setDropoff(destination); } }}
        onLocate={() => { setMapFocusRevision(value => value + 1); void refreshLocation(); }} onVoice={openVoice} onProfile={() => router.push('/(app)/profile')} onNotifications={() => router.push('/customer-notifications')}
        onPlaces={() => router.push('/saved-places')} onRetryPlaces={() => void loadPlaces()}
        onPayment={() => router.push('/payment-methods')} onConsent={() => setWaitingAccepted(value => !value)}
        onRetryQuote={() => { setQuote(null); setQuoteRevision(previous => previous + 1); }}
        onBook={() => void book()} onBack={() => { setDropoff(null); setQuote(null); setReviewing(false); }}
        onHeight={dropoff ? setRideHeight : setBrowseHeight}
        availability={(locationReady || selectedPickup) ? <AvailabilityStatus compact search={available} /> : null}
      /> : null}

      {searchOpen ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000000', opacity: .55 }} /> : null}
      {searchOpen ? (
        <SearchSheet
          onClose={() => setSearchOpen(false)}
          onVoice={openVoice}
          target={searchTarget}
          pickupLabel={selectedPickup?.name || pickupLabel}
          destinationLabel={dropoff?.name || ""}
          quickPlaces={quickPlaces}
          onPickup={() => setSearchTarget('pickup')}
          onDestination={() => setSearchTarget('dropoff')}
          onSelect={(d: any) => {
            const place = normalizeSearchPlace(d);
            if (!place) return;
            setQuote(null);
            setMapFocusRevision(value => value + 1);
            if (searchTarget === 'pickup') {
              setSelectedPickup(place);
            } else if (searchTarget === 'stop') {
              setStops((prev) => prev.length < 3 ? [...prev, place] : prev);
            } else {
              setDropoff(place);
              setReviewing(false);
            }
            setSearchTarget('dropoff');
            setSearchOpen(false);
          }}
          featured={featured}
          insets={insets}
        />
      ) : null}
    </View>
  );
}

export function SearchSheet({ onClose, onSelect, onVoice, featured, insets, target = 'dropoff', pickupLabel, onPickup, onDestination, destinationLabel = '', quickPlaces = [] }: any) {
  useColorTheme();
  const [q, setQ] = useState('');
  useEffect(() => setQ(''), [target]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [retrySearch, setRetrySearch] = useState(0);

  useEffect(() => {
    let current = true;
    setResults([]); setSearchError('');
    if (q.trim().length < 2) { setLoading(false); return; }
    setLoading(true);
    const timer = setTimeout(() => {
      placesApi.search(q.trim())
        .then((r) => { if (current) setResults(r.results || []); })
        .catch((error) => { if (current) setSearchError(apiError(error)); })
        .finally(() => { if (current) setLoading(false); });
    }, 350);
    return () => { current = false; clearTimeout(timer); };
  }, [q, retrySearch]);

  const items = q.trim().length < 2
    ? [...quickPlaces, ...(featured || [])].map((p: any) => ({ ...p, saved: true }))
    : results;
  const selectableItems = items.filter((place: any) => normalizeSearchPlace(place));

  const selectPlace = (place: any) => { const normalized = normalizeSearchPlace(place); if (normalized) onSelect(normalized); };
  return <V10Entrance sheet style={{ position: 'absolute', top: Math.max(54, insets.top + 6), bottom: 0, left: 0, right: 0 }}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 20, paddingTop: 10 }} testID="search-sheet">
    <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong, alignSelf: 'center', marginBottom: 14 }} />
    <Pressable onPress={onClose} testID="search-close" accessibilityRole="button" accessibilityLabel="Avbryt søk" style={{ position: 'absolute', top: -50, left: 20, width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}><V10Icon name="chevL" size={20} /></Pressable>
    <View style={{ gap: 8 }}>{['pickup', 'dropoff'].map(field => <View key={field} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ width: 20, alignItems: 'center' }}><View style={{ width: 10, height: 10, borderRadius: field === 'pickup' ? 5 : 3, backgroundColor: field === 'pickup' ? colors.accent : colors.text }} /></View>
      {target === field || (target === 'stop' && field === 'dropoff') ? <View style={{ flex: 1, height: 48, borderRadius: 16, backgroundColor: colors.cardSubtle, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: colors.text }}><TextInput testID="search-input" accessibilityLabel={target === 'pickup' ? 'Hentested' : 'Destinasjon'} autoFocus placeholder={target === 'pickup' ? 'Hvor skal du hentes?' : 'Hvor skal du?'} placeholderTextColor={colors.textMuted} underlineColorAndroid="transparent" style={[{ flex: 1, fontFamily: font.body, fontSize: 16, color: colors.text, minWidth: 0, paddingVertical: 0 }, Platform.OS === 'web' ? { outlineStyle: 'none' } as any : null]} value={q} onChangeText={setQ} returnKeyType="search" />{loading ? <ActivityIndicator color={colors.accent} /> : <Pressable testID="search-clear" onPress={() => setQ('')} accessibilityLabel="Tøm søk" style={{ padding: 6 }}><V10Icon name="x" size={18} /></Pressable>}</View>
      : <Pressable testID={field === 'pickup' ? 'search-pickup' : 'search-destination'} onPress={field === 'pickup' ? onPickup : onDestination} accessibilityRole="button" style={{ flex: 1, minHeight: 48, borderRadius: 16, backgroundColor: colors.cardSubtle, paddingHorizontal: 16, justifyContent: 'center' }}><Text style={[v10.secondary, { color: colors.text }]} numberOfLines={1}>{field === 'pickup' ? pickupLabel || 'Velg hentested' : destinationLabel || 'Velg destinasjon'}</Text></Pressable>}
    </View>)}</View>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 24 }}>
      {quickPlaces.some((place: any) => normalizeSearchPlace(place)) ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 16 }}>{quickPlaces.filter((place: any) => normalizeSearchPlace(place)).slice(0, 3).map((place: any, i: number) => <Pressable key={place.id || i} testID={`search-quick-${i}`} accessibilityRole="button" onPress={() => selectPlace(place)} style={{ minHeight: 36, borderRadius: 12, backgroundColor: colors.cardSubtle, paddingHorizontal: 12, justifyContent: 'center' }}><Text style={v10.secondary}>{place.label || place.name}</Text></Pressable>)}</ScrollView> : null}
      <Text style={[v10.overline, { marginBottom: 4 }]}>{q.trim().length >= 2 ? 'Resultater' : 'Faste og utvalgte steder'}</Text>
      {selectableItems.map((r: any, i: number) => <V10Entrance key={`${r.name}-${r.lat}-${r.lng}`} delay={Math.min(i, 2) * 60}><Pressable key={`${r.name}-${i}`} testID={`search-result-${i}`} accessibilityRole="button" onPress={() => selectPlace(r)} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 }}><View style={v10.icon}><V10Icon name={r.saved ? 'clock' : 'destination'} size={20} /></View><View style={{ flex: 1 }}><Text style={v10.body}>{r.name}</Text>{r.address || r.label ? <Text style={v10.caption}>{r.address || r.label}</Text> : null}</View></Pressable></V10Entrance>)}
      {searchError ? <View style={{ paddingVertical: 16 }}><Text testID="search-network-error" accessibilityRole="alert" style={{ color: colors.danger }}>{searchError}</Text><Pressable testID="search-retry" onPress={() => setRetrySearch(value => value + 1)}><Text style={{ color: colors.accent, paddingTop: 12 }}>Prøv igjen</Text></Pressable></View> : null}
      {!searchError && !selectableItems.length && q.trim().length >= 2 && !loading ? <View style={{ paddingVertical: 24 }}><Text style={v10.heading}>Fant ingen steder</Text><Text style={v10.secondary}>Prøv et annet søk.</Text></View> : null}
      <Pressable testID="search-voice" onPress={onVoice} accessibilityRole="button" style={{ flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 48, marginTop: 16 }}><V10Icon name="voice" /><Text style={v10.secondary}>Snakk med SNAR</Text></Pressable>
    </ScrollView>
  </KeyboardAvoidingView></V10Entrance>;
}

export function normalizeSearchPlace(place: any): { name: string; lat: number; lng: number; address?: string } | null {
  if (typeof place?.name !== 'string' || !place.name.trim() || place.lat == null || place.lng == null || place.lat === '' || place.lng === '') return null;
  const point = { lat: Number(place.lat), lng: Number(place.lng) };
  return validPosition(point) ? { name: place.name.trim(), ...point, ...(typeof place.address === 'string' && place.address ? { address: place.address } : {}) } : null;
}
