import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, makeStyles, radius } from '@/src/theme';
import { Icon, IconName } from '@/src/components/Icon';
import { Map } from '@/src/components/Map';
import { Avatar } from '@/src/components/Avatar';
import { CarSvg, CAR_ACTIVE, CAR_IDLE } from '@/src/components/CarMarker';
import { SignatureSheet, SignatureSheetSnap } from '@/src/components/SignatureSheet';
import { useAuth } from '@/src/context/AuthContext';
import { carsApi, mePlacesApi, paymentApi, placesApi, tripsApi } from '@/src/lib/api';
import { apiError, greeting, kr, VEHICLES } from '@/src/lib/format';

const OSLO = { lat: 59.9127, lng: 10.7461 };

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { user } = useAuth();

  const [loc, setLoc] = useState<{ lat: number; lng: number }>(OSLO);
  const [pickupLabel, setPickupLabel] = useState('Din posisjon');
  const [locDenied, setLocDenied] = useState(false);
  const [cars, setCars] = useState<any[]>([]);
  const [featured, setFeatured] = useState<any[]>([]);
  const [dropoff, setDropoff] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [estimate, setEstimate] = useState<any>(null);
  const [selType, setSelType] = useState('ai-first');
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');
  const [methods, setMethods] = useState<any[]>([]);
  const [myPlaces, setMyPlaces] = useState<any[]>([]);
  const [sheetSnap, setSheetSnap] = useState<SignatureSheetSnap>('half');
  const [searchMode, setSearchMode] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef<any>(null);

  const loadMethods = useCallback(() => {
    paymentApi.list().then((r) => setMethods(Array.isArray(r) ? r : (r?.payment_methods || []))).catch(() => {});
  }, []);

  const loadPlaces = useCallback(() => {
    mePlacesApi.list().then((r) => setMyPlaces(r.places || [])).catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadMethods();
      loadPlaces();
      tripsApi.active().then((t) => {
        if (active && t?.trip_id) router.replace(`/booking/${t.trip_id}`);
      }).catch(() => {});
      return () => { active = false; };
    }, [router, loadMethods, loadPlaces]),
  );

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setLoc(p);
          placesApi.reverse(p.lat, p.lng).then((r) => r?.label && setPickupLabel(r.label)).catch(() => {});
        } else {
          setLocDenied(true);
        }
      } catch {
        setLocDenied(true);
      }
    })();
    placesApi.list(true).then((r) => setFeatured(r.places || [])).catch(() => {});
    loadMethods();
    loadPlaces();
  }, [loadMethods, loadPlaces]);

  useEffect(() => {
    let mounted = true;
    const load = () => carsApi.nearby(loc.lat, loc.lng).then((r) => mounted && setCars(r.cars || [])).catch(() => {});
    load();
    const i = setInterval(load, 8000);
    return () => { mounted = false; clearInterval(i); };
  }, [loc.lat, loc.lng]);

  useEffect(() => {
    if (!dropoff) { setEstimate(null); return; }
    tripsApi.estimate({
      pickup_lat: loc.lat, pickup_lng: loc.lng,
      dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng,
    }).then(setEstimate).catch(() => setEstimate(null));
  }, [dropoff, loc.lat, loc.lng]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (searchQ.trim().length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchTimer.current = setTimeout(() => {
      placesApi.search(searchQ.trim())
        .then((r) => setSearchResults(r.results || []))
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, 280);
    return () => searchTimer.current && clearTimeout(searchTimer.current);
  }, [searchQ]);

  const nearest = cars.length ? Math.min(...cars.map((c) => c.eta_min || 3)) : null;
  const priceFor = (type: string) => estimate?.options?.find((o: any) => o.vehicle_type === type)?.price;
  const payMethod = methods.find((m) => m.is_default) || methods[0];
  const quickPlaces = myPlaces.length ? myPlaces : featured;

  const openSearch = () => {
    Haptics.selectionAsync().catch(() => {});
    setSearchMode(true);
    setSheetSnap('full');
  };

  const closeSearch = () => {
    setSearchMode(false);
    setSearchQ('');
    setSearchResults([]);
    setSheetSnap('half');
  };

  const chooseDestination = (d: { name: string; lat: number; lng: number }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setDropoff(d);
    setSearchMode(false);
    setSearchQ('');
    setSearchResults([]);
    setSheetSnap('half');
  };

  const chooseVehicle = (type: string) => {
    setSelType(type);
    Haptics.selectionAsync().catch(() => {});
  };

  const book = async () => {
    if (!dropoff) return;
    setError('');
    setBooking(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const trip = await tripsApi.request({
        pickup_address: pickupLabel,
        pickup_lat: loc.lat,
        pickup_lng: loc.lng,
        dropoff_address: dropoff.name,
        dropoff_lat: dropoff.lat,
        dropoff_lng: dropoff.lng,
        vehicle_type: selType,
      });
      router.push(`/booking/${trip.trip_id}`);
    } catch (e: any) {
      if (e?.response?.status === 402) {
        setError('Legg til en verifisert betalingsmåte før du bestiller.');
        setTimeout(() => router.push('/payment-methods'), 700);
      } else {
        setError(apiError(e));
      }
    } finally {
      setBooking(false);
    }
  };

  const routeGeom = estimate?.geometry?.coordinates;
  const searchItems = searchQ.trim().length < 2
    ? (featured || []).map((p: any) => ({ name: p.name, lat: p.lat, lng: p.lng, saved: true }))
    : searchResults;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Map
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        user={locDenied ? null : loc}
        pickup={dropoff ? loc : null}
        dropoff={dropoff}
        route={routeGeom}
        cars={dropoff ? [] : cars}
        testID="home-map"
      />

      <View pointerEvents="none" style={s.topVignette} />

      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={s.brandPill} testID="home-brand">
          <Text style={s.brand}>KJ<Text style={{ color: colors.accent }}>A</Text>PP</Text>
          <Text style={s.brandSub}>NORDIC TAXI</Text>
        </View>
        <Avatar
          name={user?.fullName || user?.email}
          uri={(user as any)?.avatar_url}
          size={44}
          onPress={() => router.push('/(app)/profile')}
          testID="home-profile-btn"
        />
      </View>

      <SignatureSheet
        snap={sheetSnap}
        onSnapChange={setSheetSnap}
        peekHeight={searchMode ? 116 : 154}
        halfRatio={dropoff ? 0.58 : 0.43}
        fullRatio={0.88}
        testID="customer-signature-sheet"
      >
        {searchMode ? (
          <View style={{ flex: 1 }}>
            <View style={s.searchTopRow}>
              <Pressable onPress={closeSearch} style={s.circleBtn} testID="search-close">
                <Icon name="chevron-down" size={19} color={colors.text} />
              </Pressable>
              <View style={s.searchField}>
                <Icon name="search" size={18} color={colors.textMuted} />
                <TextInput
                  testID="search-input"
                  autoFocus={sheetSnap === 'full'}
                  placeholder="Hvor vil du?"
                  placeholderTextColor={colors.textMuted}
                  style={s.searchInput}
                  value={searchQ}
                  onFocus={() => setSheetSnap('full')}
                  onChangeText={setSearchQ}
                  returnKeyType="search"
                />
                {searchLoading ? <ActivityIndicator color={colors.accent} size="small" /> : null}
                {searchQ ? (
                  <Pressable onPress={() => setSearchQ('')} hitSlop={10}>
                    <Icon name="x" size={17} color={colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>
            </View>

            <View style={s.pickupInline}>
              <View style={s.beacon} />
              <View style={{ flex: 1 }}>
                <Text style={s.microLabel}>HENTES FRA</Text>
                <Text style={s.pickupInlineText} numberOfLines={1}>{pickupLabel}</Text>
              </View>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 36 }}
              showsVerticalScrollIndicator={false}
            >
              {!searchQ.trim() ? <Text style={s.sectionLabel}>FORESLÅTT</Text> : null}
              {searchItems.map((r: any, i: number) => (
                <Pressable
                  key={`${r.name}-${i}`}
                  style={s.resultRow}
                  testID={`search-result-${i}`}
                  onPress={() => chooseDestination({ name: r.name, lat: r.lat, lng: r.lng })}
                >
                  <View style={s.resultIcon}>
                    <Icon name={r.saved ? 'star' : 'map-pin'} size={17} color={colors.accent} fill={r.saved ? colors.accent : 'none'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.resultText} numberOfLines={1}>{r.name}</Text>
                    <Text style={s.resultSub}>{r.saved ? 'Forslag' : 'Adresse eller sted'}</Text>
                  </View>
                  <Icon name="chevron-right" size={18} color={colors.textMuted} />
                </Pressable>
              ))}
              {!searchItems.length && searchQ.trim().length >= 2 && !searchLoading ? (
                <View style={s.emptySearch}>
                  <Icon name="search" size={22} color={colors.textMuted} />
                  <Text style={s.hint}>Ingen treff. Prøv et annet gatenavn eller sted.</Text>
                </View>
              ) : null}
            </ScrollView>
          </View>
        ) : !dropoff ? (
          <View style={{ flex: 1, paddingHorizontal: 18 }}>
            <Pressable onPress={openSearch} style={s.whereTo} testID="home-where-to">
              <View style={{ flex: 1 }}>
                <Text style={s.greeting}>{greeting(user?.fullName)}</Text>
                <Text style={s.whereTitle}>Hvor vil du?</Text>
              </View>
              <View style={s.searchBtn}>
                <Icon name="search" size={19} color={colors.accentOn} />
              </View>
            </Pressable>

            <View style={s.locationStatus}>
              <View style={s.beacon} />
              <View style={{ flex: 1 }}>
                <Text style={s.microLabel}>DIN POSISJON</Text>
                <Text style={s.pickupText} numberOfLines={1}>{pickupLabel}</Text>
              </View>
              <View style={s.carsBadge}>
                <View style={[s.dot, { backgroundColor: cars.length ? colors.online : colors.textMuted }]} />
                <Text style={s.carsBadgeText}>{cars.length ? `${nearest} min` : 'Søker'}</Text>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow}>
              {quickPlaces.map((p: any) => (
                <Pressable
                  key={p.id || p.slug}
                  style={s.chip}
                  testID={`quick-${p.label}`}
                  onPress={() => chooseDestination({ name: p.name, lat: p.lat, lng: p.lng })}
                >
                  <Icon name={(p.icon === 'home' ? 'home' : p.icon === 'briefcase' ? 'briefcase' : 'map-pin') as IconName} size={15} color={colors.accent} />
                  <Text style={s.chipText}>{p.label}</Text>
                </Pressable>
              ))}
              <Pressable style={s.chipEdit} testID="quick-edit-places" onPress={() => router.push('/saved-places')}>
                <Icon name={myPlaces.length ? 'settings' : 'plus'} size={15} color={colors.textSecondary} />
                <Text style={s.chipEditText}>{myPlaces.length ? 'Rediger' : 'Legg til'}</Text>
              </Pressable>
            </ScrollView>

            {locDenied ? (
              <View style={s.permissionHint}>
                <Icon name="map-pin" size={16} color={colors.warning} />
                <Text style={s.permissionText}>Slå på posisjon for presis henting og biler rundt deg.</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 26 }}
          >
            <View style={s.bookingHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.microLabel}>DIN REISE</Text>
                <Text style={s.bookingTitle}>Velg bil</Text>
              </View>
              <Pressable onPress={openSearch} style={s.editDestination} testID="booking-change-dest">
                <Icon name="search" size={15} color={colors.accent} />
                <Text style={s.editDestinationText}>Endre</Text>
              </Pressable>
            </View>

            <View style={s.endpoints} testID="booking-endpoints">
              <View style={s.epRow}>
                <View style={s.beacon} />
                <Text style={s.epText} numberOfLines={1}>{pickupLabel}</Text>
              </View>
              <View style={s.epLine} />
              <View style={s.epRow}>
                <View style={s.square} />
                <Text style={s.epText} numberOfLines={1}>{dropoff.name}</Text>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.vehiclesRow}>
              {VEHICLES.map((v) => {
                const active = selType === v.type;
                const price = priceFor(v.type);
                return (
                  <Pressable
                    key={v.type}
                    testID={`vehicle-${v.type}`}
                    onPress={() => chooseVehicle(v.type)}
                    style={[s.vehicle, active && s.vehicleActive]}
                  >
                    <View style={s.vehicleVisual}>
                      <CarSvg size={38} {...(active ? CAR_ACTIVE : CAR_IDLE)} />
                      {active ? <View style={s.selectedDot}><Icon name="check" size={11} color={colors.accentOn} /></View> : null}
                    </View>
                    <Text style={[s.vName, active && { color: colors.text }]}>{v.name}</Text>
                    <Text style={s.vTag}>{v.tagline}</Text>
                    <View style={s.vPriceRow}>
                      <Text style={[s.vPrice, active && { color: colors.accent }]}>{price != null ? kr(price) : '…'}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={s.tripMeta}>
              <View>
                <Text style={s.microLabel}>ESTIMERT</Text>
                <Text style={s.tripMetaValue}>{estimate ? `${estimate.distance_km} km · ${estimate.duration_min} min` : 'Beregner…'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.microLabel}>PRIS</Text>
                <Text style={s.summaryPrice}>{kr(priceFor(selType))}</Text>
              </View>
            </View>

            <Pressable style={s.payRow} onPress={() => router.push('/payment-methods')} testID="booking-payment-row">
              <View style={s.payIcon}>
                <Icon name={payMethod?.type === 'vipps' ? 'wallet' : 'card'} size={17} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.microLabel}>BETALING</Text>
                <Text style={s.payText} numberOfLines={1}>
                  {payMethod ? (payMethod.type === 'vipps' ? 'Vipps' : `${payMethod.label} •••• ${payMethod.last4}`) : 'Legg til betalingsmåte'}
                </Text>
              </View>
              <Icon name="chevron-right" size={18} color={colors.textMuted} />
            </Pressable>

            {error ? <Text style={s.error} testID="home-error">{error}</Text> : null}

            <Pressable
              style={({ pressed }) => [s.confirm, pressed && { transform: [{ scale: 0.985 }] }, booking && { opacity: 0.6 }]}
              onPress={book}
              disabled={booking}
              testID="booking-confirm"
            >
              {booking ? (
                <ActivityIndicator color={colors.accentOn} />
              ) : (
                <Text style={s.confirmText}>Bestill {VEHICLES.find((v) => v.type === selType)?.name || 'KJAPP'} · {kr(priceFor(selType))}</Text>
              )}
            </Pressable>
          </ScrollView>
        )}
      </SignatureSheet>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  topVignette: { position: 'absolute', top: 0, left: 0, right: 0, height: 150, backgroundColor: 'rgba(3,6,8,0.25)' },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 8,
  },
  brandPill: {
    backgroundColor: 'rgba(8,13,17,0.88)', borderWidth: 1, borderColor: c.lineStrong,
    borderRadius: 999, paddingHorizontal: 18, paddingVertical: 8,
  },
  brand: { fontFamily: font.display, fontSize: 20, color: c.text, letterSpacing: 1 },
  brandSub: { color: c.accent, fontSize: 7, letterSpacing: 2.7, marginTop: 1 },
  whereTo: {
    minHeight: 78, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(244,244,240,0.045)',
    borderRadius: radius.xl, paddingHorizontal: 18, marginBottom: 14, borderWidth: 1, borderColor: c.line,
  },
  greeting: { color: c.accent, fontSize: 11, marginBottom: 3, letterSpacing: 0.5, textTransform: 'uppercase' },
  whereTitle: { color: c.text, fontFamily: font.display, fontSize: 26, lineHeight: 31 },
  searchBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  locationStatus: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, marginBottom: 14 },
  beacon: { width: 11, height: 11, borderRadius: 6, backgroundColor: c.accent, shadowColor: c.accent, shadowOpacity: 0.5, shadowRadius: 8 },
  microLabel: { color: c.textMuted, fontSize: 9, letterSpacing: 1.8, fontWeight: '700' },
  pickupText: { color: c.text, fontSize: 14, marginTop: 2 },
  carsBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: c.cardSubtle },
  dot: { width: 7, height: 7, borderRadius: 4 },
  carsBadgeText: { color: c.textSecondary, fontSize: 11, fontWeight: '600' },
  chipsRow: { gap: 9, paddingBottom: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line, borderRadius: 999, paddingHorizontal: 15, height: 42 },
  chipText: { color: c.text, fontSize: 13 },
  chipEdit: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, paddingHorizontal: 15, height: 42, borderWidth: 1, borderColor: c.line, borderStyle: 'dashed' },
  chipEditText: { color: c.textSecondary, fontSize: 13 },
  permissionHint: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 2, padding: 10, borderRadius: 12, backgroundColor: 'rgba(251,191,36,0.08)' },
  permissionText: { color: c.textMuted, fontSize: 11, flex: 1, lineHeight: 16 },
  searchTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  circleBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line },
  searchField: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.lineStrong, borderRadius: 17, paddingHorizontal: 14, height: 52 },
  searchInput: { flex: 1, color: c.text, fontSize: 16, height: '100%' },
  pickupInline: { marginHorizontal: 18, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.025)', borderRadius: 14 },
  pickupInlineText: { color: c.textSecondary, fontSize: 13, marginTop: 2 },
  sectionLabel: { color: c.textMuted, fontSize: 9, letterSpacing: 2, marginTop: 8, marginBottom: 8, fontWeight: '700' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: c.line },
  resultIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: c.cardSubtle, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.line },
  resultText: { color: c.text, fontSize: 15, fontWeight: '600' },
  resultSub: { color: c.textMuted, fontSize: 11, marginTop: 3 },
  emptySearch: { alignItems: 'center', gap: 10, paddingTop: 40 },
  hint: { color: c.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  bookingHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  bookingTitle: { color: c.text, fontFamily: font.display, fontSize: 25, marginTop: 2 },
  editDestination: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: c.accentSoft },
  editDestinationText: { color: c.accent, fontSize: 12, fontWeight: '700' },
  endpoints: { backgroundColor: c.cardSubtle, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: 14, marginBottom: 14 },
  epRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  epText: { color: c.text, fontSize: 13, flex: 1 },
  epLine: { width: 1, height: 14, backgroundColor: c.lineStrong, marginLeft: 5, marginVertical: 3 },
  square: { width: 11, height: 11, borderRadius: 2, backgroundColor: c.text },
  vehiclesRow: { gap: 11, paddingBottom: 14 },
  vehicle: { width: 132, minHeight: 146, backgroundColor: c.cardSubtle, borderRadius: 20, borderWidth: 1, borderColor: c.line, padding: 14 },
  vehicleActive: { borderColor: c.accent, backgroundColor: c.accentSoft },
  vehicleVisual: { height: 48, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  selectedDot: { position: 'absolute', top: 0, right: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  vName: { color: c.textSecondary, fontSize: 14, fontWeight: '700', marginTop: 4 },
  vTag: { color: c.textMuted, fontSize: 10, marginTop: 3, minHeight: 14 },
  vPriceRow: { marginTop: 8 },
  vPrice: { color: c.text, fontFamily: font.mono, fontSize: 15 },
  tripMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 },
  tripMetaValue: { color: c.textSecondary, fontSize: 13, marginTop: 4 },
  summaryPrice: { color: c.text, fontFamily: font.display, fontSize: 25, marginTop: 2 },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line, borderRadius: 17, paddingHorizontal: 14, minHeight: 58, marginBottom: 12 },
  payIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' },
  payText: { color: c.text, fontSize: 13, marginTop: 2 },
  error: { color: c.danger, fontSize: 12, marginBottom: 10 },
  confirm: { height: 58, borderRadius: 999, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', shadowColor: c.accent, shadowOpacity: 0.35, shadowRadius: 22, shadowOffset: { width: 0, height: 8 }, elevation: 7 },
  confirmText: { color: c.accentOn, fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
}));
