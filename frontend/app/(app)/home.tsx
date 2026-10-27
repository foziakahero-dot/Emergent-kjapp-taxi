import { SheetFrame, SheetHandle } from '@/src/components/snar10/Sheet';
import { Chip } from '@/src/components/snar10/Chip';
import { BlurTargetView } from 'expo-blur';
import { useRouteReveal } from '@/src/components/useRouteReveal';
import { V10Entrance } from '@/src/components/V10Entrance';
import { V10Icon } from '@/src/components/V10Icon';
import { v10 } from '@/src/components/V10UI';
import { CustomerBookingView, confirmedPaymentMethod, confirmedWaitingPolicy, type BookingStage } from '@/src/components/CustomerBookingView';
import { recentDestinations } from '@/src/lib/recentPlaces';
import { validPosition } from '@/src/lib/carAvailability';
import { readPickupLocation, locationIssueText } from '@/src/lib/pickupLocation';
import { useAvailableCars } from '@/src/lib/useAvailableCars';
import { useAssignedVehicle } from '@/src/lib/useAssignedVehicle';
import { AvailabilityStatus } from '@/src/components/AvailabilityStatus';
import { ActiveTripCard, LIVE_TRIP_STATUSES } from '@/src/components/ActiveTripCard';
import { useHideTabBar } from '@/src/components/FloatingTabBar';
import { Text, TextInput } from '@/src/components/Typography';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { colors, font, useColorTheme } from '@/src/theme';
import { Map } from '@/src/components/Map';
import { mePlacesApi, paymentApi, placesApi, tripsApi } from '@/src/lib/api';
import { apiError } from '@/src/lib/format';
import { nativeWalletAvailability, setupNativePaymentMethod } from '@/src/lib/nativePayment';
import { useAuth } from '@/src/context/AuthContext';

const OSLO = { lat: 59.9127, lng: 10.7461 };
export default function Home() {
  useColorTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { retryTripId } = useLocalSearchParams<{ retryTripId?: string }>();
  const insets = useSafeAreaInsets();
  const [mapOnly, setMapOnly] = useState(false);

  const queryClient = useQueryClient();
  // GlobalCustomerShell owns polling. This observer only reads its shared state.
  const activeTripQuery = useQuery<any>({
    queryKey: ['customer-active-trip', user?.id],
    queryFn: async () => { const trip = await tripsApi.active(); return trip?.trip_id ? trip : null; },
    enabled: false,
  });
  const activeTrip = activeTripQuery.data?.trip_id ? activeTripQuery.data : null;
  const assignedVehicle = useAssignedVehicle(activeTrip);
  const activeTripOffline = activeTripQuery.isError;
  const activeTripChecked = activeTripQuery.data !== undefined;
  const [loc, setLoc] = useState<{ lat: number; lng: number }>(OSLO);
  const [selectedPickup, setSelectedPickup] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const pickupPoint = selectedPickup || loc;
  const [pickupLabel, setPickupLabel] = useState('Finner posisjonen din…');
  const [locationHint, setLocationHint] = useState('');
  const [locationReady, setLocationReady] = useState(false);
  const [featured, setFeatured] = useState<any[]>([]);
  const [dropoff, setDropoff] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [estimate, setEstimate] = useState<any>(null);
  const [quotedAt, setQuotedAt] = useState<number | null>(null);
  const [quoteRevision, setQuoteRevision] = useState(0);
  const setQuote = useCallback((result: any) => { setEstimate(result); setQuotedAt(result ? Date.now() : null); }, []);
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
  const { data: wallet } = useQuery({ queryKey: ['native-wallet', user?.id], queryFn: () => nativeWalletAvailability(),
    enabled: !!user?.id && bookingStage === 'payment' });
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
    locationRevision: mapFocusRevision,
    enabled: Boolean(searchingTrip || (!activeTrip && (locationReady || selectedPickup))),
    vehicleType: searchingTrip ? activeTrip.vehicle_type : dropoff ? selType : undefined,
    specialNeeds: searchingTrip ? activeTrip.special_needs : specialNeeds,
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
      setReviewing(false);
    }).catch(() => { if (mounted) setError('Kunne ikke hente forrige reisemål. Velg hentested og reisemål på nytt.'); });
    return () => { mounted = false; };
  }, [retryTripId]);

  const loadMethods = useCallback(() => {
    const sequence = ++methodsSequence.current;
    setMethods([]);
    paymentApi.list().then(r => { if (sequence === methodsSequence.current) setMethods(Array.isArray(r) ? r : (r?.payment_methods || r?.methods || [])); })
      .catch(() => { if (sequence === methodsSequence.current) setMethods([]); });
  }, [user?.id]);

  const setupWallet = async () => {
    if (bookingLock.current || !wallet) return;
    bookingLock.current = true; setBooking(true); setError('');
    try {
      const card = await setupNativePaymentMethod(true);
      if (!card) return;
      const result = await paymentApi.setDefault(card.id);
      if (result.default_payment_method_id !== card.id) throw new Error('Betalingsmåten ble ikke bekreftet.');
      loadMethods(); setBookingStage('vehicles');
    } catch (error) { setError(apiError(error)); }
    finally { bookingLock.current = false; setBooking(false); }
  };

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
      loadMethods();
      void loadPlaces();
      void queryClient.invalidateQueries({ queryKey: ['customer-active-trip', user?.id] });
    }, [loadMethods, loadPlaces, queryClient, user?.id]),
  );

  const refreshLocation = useCallback(async (requestPermission = true) => {
    if (requestPermission && locationRequest.current) return false;
    if (requestPermission) locationRequest.current = true;
    const sequence = ++locationSequence.current;
    try {
      const result = await readPickupLocation(Location, requestPermission);
      if (sequence !== locationSequence.current) return false;
      if (!result.point) {
        setLocationReady(false);
        setLocationHint(locationIssueText[result.issue || 'unavailable']);
        setPickupLabel('Velg hentested');
        return false;
      }
      const p = result.point;
      setLoc(p);
      setLocationReady(true);
      setLocationHint('');
      setPickupLabel('Din posisjon');
      placesApi.reverse(p.lat, p.lng).then((r) => { if (sequence === locationSequence.current && r?.label) setPickupLabel(r.label); }).catch(() => {});
      return true;
    } catch {
      if (sequence !== locationSequence.current) return false;
      setLocationReady(false);
      setLocationHint(locationIssueText.unavailable);
      setPickupLabel('Velg hentested');
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
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && !selectedPickup) void refreshLocation(false);
    });
    return () => subscription.remove();
  }, [refreshLocation, selectedPickup]);

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
        setError('Velg hentested manuelt, eller del posisjonen din før du bestiller.');
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
        payment_provider: payMethod?.wallet === 'google_pay' ? 'google_pay' : 'card',
        ...(waitingPolicy ? {
          waiting_policy_token: waitingPolicy.token,
          quoted_price: priceFor(selType),
          quoted_pricing_version: estimate.pricing_version,
        } : {}),
      });
      if (typeof trip?.trip_id !== 'string' || !trip.trip_id.trim()) throw new Error('Bestillingen ble ikke bekreftet av SNAR.');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      queryClient.setQueryData(['customer-trip', trip.trip_id], trip);
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
  // The final booking action confirms the displayed quote and reservation terms.
  const canReview = !activeTrip && activeTripChecked && !activeTripOffline && Boolean((locationReady || selectedPickup) && dropoff && estimate && Number.isFinite(priceFor(selType)) && priceFor(selType) > 0 && !booking);
  const canBook = canReview && Boolean(payMethod && confirmedWaitingPolicy(waitingPolicy));
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
        showControls={Boolean(activeTrip || mapOnly || searchOpen)}
        focusRevision={mapFocusRevision}
        focusMode={searchingTrip || (!activeTrip && (mapOnly || searchOpen || !dropoff)) ? 'nearby' : 'route'}
        contentInsets={{ top: searchOpen ? Math.max(54, insets.top + 4) : insets.top + (activeTrip ? 16 + activeCardHeight : 12 + headerHeight) + 16,
          right: 48, bottom: mapOnly || searchOpen ? insets.bottom + 96 : Math.max(insets.bottom + 112, activeTrip ? 0 : dropoff ? rideHeight : browseHeight) + 32, left: 48 }}
        activeCar={assignedVehicle}
        testID="home-map"
      />
      </BlurTargetView>

      {activeTrip ? <View testID="home-active-card" onLayout={e => setActiveCardHeight(e.nativeEvent.layout.height)} style={{ position: 'absolute', top: insets.top + 16, left: 16, right: 16 }}>
        <ActiveTripCard trip={activeTrip} offline={activeTripOffline} onOpen={() => router.push(activeTrip.status === 'arrived' ? `/receipt/${activeTrip.trip_id}` : `/booking/${activeTrip.trip_id}`)} />
        {searchingTrip ? <AvailabilityStatus search={available} trip={activeTrip} /> : null}
      </View> : activeTripOffline ? <View style={{ position: 'absolute', top: insets.top + 78, left: 16, right: 16, padding: 12, backgroundColor: colors.surface, borderRadius: 16 }}><Text accessibilityRole="alert">Kan ikke bekrefte aktiv tur. Bestilling er midlertidig utilgjengelig.</Text></View> : null}
      {!activeTrip && !mapOnly && !searchOpen ? <CustomerBookingView
        stage={bookingStage} reviewing={reviewing} pickup={selectedPickup?.name || pickupLabel}
        destination={dropoff} estimate={estimate} quotedAt={quotedAt} vehicle={selType} price={selectedPrice}
        nearest={nearest} availableDrivers={cars} driverPosition={available.center} vehicleEtas={vehicleEtas} payment={payMethod} methods={methods} waitingPolicy={waitingPolicy} wallet={wallet} onWallet={() => void setupWallet()}
        onWalletSaved={async card => {
          const selected = await paymentApi.setDefault(card.id);
          if (selected.default_payment_method_id !== card.id) throw new Error('Lommeboken ble ikke valgt.');
          loadMethods(); setBookingStage('vehicles');
        }}
        busy={booking} canReview={canReview} canBook={canBook}
        mapBlurTarget={mapBlurTarget} avatarVersion={user?.customer_photo_version} error={error} firstName={firstName} initials={initials} places={quickPlaces} placesIssue={quickPlacesIssue}
        locationReady={Boolean(locationReady || selectedPickup)} locationHint={selectedPickup ? '' : locationHint} stops={stops}
        onStage={setBookingStage} onReview={setReviewing} onVehicle={setSelType}
        onSearch={target => { setSearchTarget(target); setReviewing(false); setSearchOpen(true); }}
        onPlace={place => { const destination = normalizeSearchPlace(place); if (destination) { setQuote(null); setMapFocusRevision(value => value + 1); setDropoff(destination); } }}
        onLocate={() => { void refreshLocation().then(confirmed => { if (confirmed) { setSelectedPickup(null); setMapFocusRevision(value => value + 1); } }); }} onVoice={openVoice} onProfile={() => router.push('/(app)/profile')} onNotifications={() => router.push('/customer-notifications')} onSchedule={() => router.push('/scheduled-trip')}
        onPlaces={() => router.push('/saved-places')} onRetryPlaces={() => void loadPlaces()}
        onPayment={() => router.push('/payment-methods')}
        onRetryQuote={() => { setQuote(null); setQuoteRevision(previous => previous + 1); }}
        onBook={() => void book()} onBack={() => { setDropoff(null); setQuote(null); setReviewing(false); setMapOnly(true); }}
        onHeight={dropoff ? setRideHeight : setBrowseHeight}
        onMinimize={() => { Keyboard.dismiss(); setMapOnly(true); }}
        availability={(locationReady || selectedPickup) ? <AvailabilityStatus compact search={available} /> : null}
      /> : null}

      {!activeTrip && !searchOpen && mapOnly ? <View style={{ position: 'absolute', top: insets.top + 12, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }} pointerEvents="box-none">
        <Pressable testID="home-search-toggle" accessibilityRole="button" accessibilityLabel={mapOnly ? 'Åpne søk' : 'Minimer til kart'} accessibilityState={{ expanded: !mapOnly }} onPress={() => {
          Keyboard.dismiss();
          if (mapOnly) { setSearchTarget('dropoff'); setSearchOpen(true); }
          else setMapOnly(true);
        }} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', minHeight: 44, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
          <V10Icon name={mapOnly ? 'search' : 'chevDown'} size={18} /><Text style={v10.secondary}>{mapOnly ? 'Hvor skal du?' : 'Vis kart'}</Text>
        </Pressable>
        {mapOnly ? <Pressable testID="map-profile" accessibilityRole="button" accessibilityLabel="Åpne profilen" onPress={() => router.push('/(app)/profile')} style={{ minWidth: 44, minHeight: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}><Text style={v10.secondary}>{initials}</Text></Pressable> : null}
      </View> : null}
      {!activeTrip && mapOnly && !searchOpen ? <View pointerEvents="box-none" style={{ position: 'absolute', bottom: insets.bottom + 100, left: 16, right: 64 }}>
        {dropoff ? <Pressable testID="map-resume-booking" accessibilityRole="button" onPress={() => setMapOnly(false)} style={{ padding: 12, borderRadius: 16, backgroundColor: colors.surface }}><Text style={v10.body}>Fortsett tur til {dropoff.name}</Text></Pressable> : null}
        {!locationReady ? <Pressable testID="map-enable-location" accessibilityRole="button" onPress={() => void refreshLocation(true).then(confirmed => { if (confirmed) setMapFocusRevision(value => value + 1); })} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={v10.body}>Aktiver min posisjon</Text></Pressable> : null}
        <AvailabilityStatus compact search={available} />
      </View> : null}
      {!activeTrip ? <SearchSheet
          visible={searchOpen}
          onClose={() => { Keyboard.dismiss(); setSearchOpen(false); setMapOnly(true); }}
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
              locationSequence.current++;
              setSelectedPickup(place);
            } else if (searchTarget === 'stop') {
              setStops((prev) => prev.length < 3 ? [...prev, place] : prev);
            } else {
              setDropoff(place);
              setReviewing(false);
            }
            setSearchTarget('dropoff');
            Keyboard.dismiss(); setSearchOpen(false); setMapOnly(false);
          }}
          featured={featured}
          insets={insets}
        /> : null}
    </View>
  );
}

export function SearchSheet({ visible = true, onClose, onSelect, onVoice, featured, insets, target = 'dropoff', pickupLabel, onPickup, onDestination, destinationLabel = '', quickPlaces = [] }: any) {
  useColorTheme();
  const dimensions = useWindowDimensions();
  const input = useRef<any>(null);
  useEffect(() => { if (visible) input.current?.focus(); }, [visible, target]);
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { Keyboard.dismiss(); onClose(); return true; });
    return () => sub.remove();
  }, [visible, onClose]);
  const [q, setQ] = useState('');
  useEffect(() => setQ(''), [target]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [retrySearch, setRetrySearch] = useState(0);

  useEffect(() => {
    let current = true;
    setResults([]); setSearchError('');
    if (!visible) { setLoading(false); return; }
    if (q.trim().length < 2) { setLoading(false); return; }
    setLoading(true);
    const timer = setTimeout(() => {
      placesApi.search(q.trim())
        .then((r) => { if (current) setResults(r.results || []); })
        .catch((error) => { if (current) setSearchError(apiError(error)); })
        .finally(() => { if (current) setLoading(false); });
    }, 350);
    return () => { current = false; clearTimeout(timer); };
  }, [q, retrySearch, visible]);

  const items = q.trim().length < 2
    ? [...quickPlaces, ...(featured || [])].map((p: any) => ({ ...p, saved: true }))
    : results;
  const selectableItems = items.filter((place: any) => normalizeSearchPlace(place));

  const selectPlace = (place: any) => { const normalized = normalizeSearchPlace(place); if (normalized) onSelect(normalized); };
  if (!visible) return null;
  const inputRow = <View style={{ height: 48, flex: 1, borderRadius: 16, backgroundColor: colors.cardSubtle,
    borderWidth: 1.5, borderColor: colors.text, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
    <TextInput ref={input} testID="search-input" accessibilityLabel={target === 'pickup' ? 'Hentested' : 'Destinasjon'}
      placeholder={target === 'pickup' ? 'Hvor skal du hentes?' : 'Hvor skal du?'} placeholderTextColor={colors.textMuted}
      underlineColorAndroid="transparent" style={[{ flex: 1, fontFamily: font.body, fontSize: 16, color: colors.text, minWidth: 0, paddingVertical: 0 }, Platform.OS === 'web' ? { outlineStyle: 'none' } as any : null]}
      value={q} onChangeText={setQ} returnKeyType="search" />
    {loading ? <ActivityIndicator color={colors.accent} /> : <Pressable testID="search-clear" onPress={() => setQ('')} accessibilityRole="button" accessibilityLabel="Tøm søk" hitSlop={8}><V10Icon name="x" size={18} /></Pressable>}
  </View>;
  return <KeyboardAvoidingView pointerEvents="box-none" behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    style={{ position: 'absolute', inset: 0 }}>
    <View testID="search-map-dim" pointerEvents="none" style={{ position: 'absolute', inset: 0, backgroundColor: colors.bg, opacity: .16 }} />
    <SheetFrame testID="search-sheet" style={{ top: Math.max(54, insets.top + 4), bottom: undefined, height: dimensions.height * .52, maxHeight: '52%', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, paddingTop: 0 }}>
      <Pressable onPress={onClose} testID="search-close" accessibilityRole="button" accessibilityLabel="Minimer søk" style={{ minHeight: 44, justifyContent: 'center' }}><SheetHandle /></Pressable>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Math.max(34, insets.bottom) }}>
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 20, alignItems: 'center' }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent }} /></View>
            {target === 'pickup' ? inputRow : <Pressable testID="search-pickup" accessibilityRole="button" accessibilityLabel="Endre hentested" onPress={onPickup}
              style={{ height: 48, flex: 1, borderRadius: 16, backgroundColor: colors.cardSubtle, paddingHorizontal: 16, justifyContent: 'center' }}>
              <Text numberOfLines={1} style={[v10.secondary, { color: colors.text }]}>{pickupLabel || 'Velg hentested'}</Text>
            </Pressable>}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 20, alignItems: 'center' }}><View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: colors.surfaceInverse }} /></View>
            {target !== 'pickup' ? inputRow : <Pressable testID="search-destination" accessibilityRole="button" accessibilityLabel="Endre destinasjon" onPress={onDestination}
              style={{ height: 48, flex: 1, borderRadius: 16, backgroundColor: colors.cardSubtle, paddingHorizontal: 16, justifyContent: 'center' }}>
              <Text numberOfLines={1} style={v10.secondary}>{destinationLabel || 'Hvor skal du?'}</Text>
            </Pressable>}
          </View>
        </View>
        {quickPlaces.some((place: any) => normalizeSearchPlace(place)) ? <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingTop: 16, paddingBottom: 8 }}>
          {quickPlaces.filter((place: any) => normalizeSearchPlace(place)).slice(0, 3).map((place: any, i: number) =>
            <Chip key={place.id || i} testID={`search-quick-${i}`} label={place.label || place.name} onPress={() => selectPlace(place)} />)}
        </ScrollView> : null}
        <Text style={[v10.overline, { marginTop: 16, marginBottom: 4 }]}>{q.trim().length >= 2 ? 'Resultater' : 'Faste og utvalgte steder'}</Text>
        {selectableItems.map((r: any, i: number) => <V10Entrance key={`${r.name}-${r.lat}-${r.lng}`} delay={Math.min(i, 2) * 60}>
          <Pressable testID={`search-result-${i}`} accessibilityRole="button" onPress={() => selectPlace(r)} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 }}>
            <View style={v10.icon}><V10Icon name={r.saved ? 'clock' : 'destination'} size={20} /></View>
            <View style={{ flex: 1 }}><Text style={v10.body}>{r.name}</Text>{r.address || r.label ? <Text style={v10.caption}>{r.address || r.label}</Text> : null}</View>
          </Pressable>
        </V10Entrance>)}
        {searchError ? <View style={{ paddingVertical: 16 }}><Text testID="search-network-error" accessibilityRole="alert" style={{ color: colors.danger }}>{searchError}</Text>
          <Pressable testID="search-retry" onPress={() => setRetrySearch(value => value + 1)}><Text style={{ color: colors.accent, paddingTop: 12 }}>Prøv igjen</Text></Pressable></View> : null}
        {!searchError && !selectableItems.length && q.trim().length >= 2 && !loading ? <View style={{ paddingVertical: 24 }}><Text style={v10.heading}>Fant ingen steder</Text><Text style={v10.secondary}>Prøv et annet søk.</Text></View> : null}
        <Pressable testID="search-voice" onPress={onVoice} accessibilityRole="button" style={{ flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 48, marginTop: 16 }}><V10Icon name="voice" /><Text style={v10.secondary}>Snakk med SNAR</Text></Pressable>
      </ScrollView>
    </SheetFrame>
  </KeyboardAvoidingView>;
}

export function normalizeSearchPlace(place: any): { name: string; lat: number; lng: number; address?: string } | null {
  if (typeof place?.name !== 'string' || !place.name.trim() || place.lat == null || place.lng == null || place.lat === '' || place.lng === '') return null;
  if (![place.lat, place.lng].every(value => typeof value === 'number' || (typeof value === 'string' && value.trim().length > 0))) return null;
  const point = { lat: Number(place.lat), lng: Number(place.lng) };
  return validPosition(point) ? { name: place.name.trim(), ...point, ...(typeof place.address === 'string' && place.address ? { address: place.address } : {}) } : null;
}
