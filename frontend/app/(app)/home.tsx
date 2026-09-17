import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { colors, font, makeStyles, radius } from '@/src/theme';
import { Icon, IconName } from '@/src/components/Icon';
import { Map } from '@/src/components/Map';
import { VehicleArtwork } from '@/src/components/VehicleArtwork';
import { VoiceGlyph } from '@/src/components/VoiceGlyph';
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [methods, setMethods] = useState<any[]>([]);
  const [myPlaces, setMyPlaces] = useState<any[]>([]);

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

  const nearest = cars.length ? Math.min(...cars.map((c) => c.eta_min || 3)) : null;
  const priceFor = (type: string) => estimate?.options?.find((o: any) => o.vehicle_type === type)?.price;
  const payMethod = methods.find((m) => m.is_default) || methods[0];
  const quickPlaces = myPlaces.length ? myPlaces : featured;

  const book = async () => {
    if (!dropoff) return;
    setError('');
    setBooking(true);
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
        setError('Legg til et betalingskort før du bestiller.');
        setTimeout(() => router.push('/payment-methods'), 700);
      } else {
        setError(apiError(e));
      }
    } finally {
      setBooking(false);
    }
  };

  const openVoice = () => router.push('/(app)/assist');
  const routeGeom = estimate?.geometry?.coordinates;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Map
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        user={loc}
        pickup={dropoff ? loc : null}
        dropoff={dropoff}
        route={routeGeom}
        cars={dropoff ? [] : cars}
        testID="home-map"
      />

      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={s.pill}>
          <Text style={s.brand}>KJ<Text style={{ color: colors.accent }}>A</Text>PP</Text>
        </View>
        <Pressable
          style={s.profileButton}
          testID="home-profile-btn"
          onPress={() => router.push('/(app)/profile')}
          accessibilityRole="button"
          accessibilityLabel="Åpne profil"
        >
          <Icon name="user" size={19} color={colors.text} />
        </Pressable>
      </View>

      <View style={[s.sheet, { paddingBottom: insets.bottom + 8 }]}>
        <View style={s.handle} />

        <View style={s.pickupRow} testID="home-pickup-row">
          <View style={s.beacon} />
          <Text style={s.pickupText} numberOfLines={1}>{pickupLabel}</Text>
        </View>
        <View style={s.carsRow} testID="home-cars-nearby-status">
          <View style={[s.dot, { backgroundColor: cars.length ? colors.online : colors.textMuted }]} />
          <Text style={s.carsText}>
            {cars.length
              ? `${cars.length} biler i nærheten · nærmeste ${nearest} min`
              : 'Søker etter ledige biler…'}
          </Text>
        </View>

        {!dropoff ? (
          <>
            <Text style={s.greeting}>{greeting(user?.fullName)}</Text>
            <View style={s.destinationField}>
              <Pressable
                style={s.destinationMain}
                onPress={() => setSearchOpen(true)}
                testID="home-where-to"
                accessibilityRole="button"
                accessibilityLabel="Søk etter destinasjon"
              >
                <View style={s.searchGlyph}>
                  <Icon name="search" size={20} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.whereTitle}>Hvor skal du?</Text>
                  <Text style={s.whereHint}>Søk adresse eller sted</Text>
                </View>
              </Pressable>
              <View style={s.destinationDivider} />
              <Pressable
                style={s.voiceButton}
                onPress={openVoice}
                testID="home-voice-destination"
                accessibilityRole="button"
                accessibilityLabel="Bestill med stemmen"
                accessibilityHint="Åpner KJAPP taleassistent for destinasjonsbestilling"
              >
                <VoiceGlyph size={22} color={colors.accentOn} />
              </Pressable>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow}>
              {quickPlaces.map((p: any) => (
                <Pressable
                  key={p.id || p.slug}
                  style={s.chip}
                  testID={`quick-${p.label}`}
                  onPress={() => setDropoff({ name: p.name, lat: p.lat, lng: p.lng })}
                  accessibilityRole="button"
                  accessibilityLabel={`Kjør til ${p.label || p.name}`}
                >
                  <Icon name={(p.icon === 'home' ? 'home' : p.icon === 'briefcase' ? 'briefcase' : 'map-pin') as IconName} size={16} color={colors.accent} />
                  <Text style={s.chipText}>{p.label}</Text>
                </Pressable>
              ))}
              <Pressable style={s.chipEdit} testID="quick-edit-places" onPress={() => router.push('/saved-places')}>
                <Icon name={myPlaces.length ? 'settings' : 'plus'} size={16} color={colors.textSecondary} />
                <Text style={s.chipEditText}>{myPlaces.length ? 'Rediger' : 'Legg til'}</Text>
              </Pressable>
            </ScrollView>

            {locDenied ? (
              <Text style={s.hint}>Slå på posisjon for å se biler rundt deg — vi bruker Oslo sentrum inntil videre.</Text>
            ) : null}
          </>
        ) : (
          <>
            <View style={s.endpoints} testID="booking-endpoints">
              <View style={s.epRow}>
                <View style={s.beacon} />
                <Text style={s.epText} numberOfLines={1}>{pickupLabel}</Text>
              </View>
              <View style={s.epLine} />
              <View style={s.epRow}>
                <View style={s.square} />
                <Text style={s.epText} numberOfLines={1}>{dropoff.name}</Text>
                <Pressable onPress={() => { setDropoff(null); setEstimate(null); }} testID="booking-change-dest">
                  <Text style={s.change}>Endre</Text>
                </Pressable>
              </View>
            </View>

            <Text style={s.sectionLabel}>VELG BIL</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.vehiclesRow}>
              {VEHICLES.map((v) => {
                const active = selType === v.type;
                const price = priceFor(v.type);
                return (
                  <Pressable
                    key={v.type}
                    testID={`vehicle-${v.type}`}
                    onPress={() => setSelType(v.type)}
                    style={[s.vehicle, active && s.vehicleActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${v.name}, ${v.tagline}, ${v.seats} seter, ${price != null ? kr(price) : 'pris beregnes'}`}
                  >
                    <View style={s.vehicleArtwork}>
                      <VehicleArtwork variant={v.type} active={active} width={124} height={64} />
                    </View>
                    <View style={s.vehicleTitleRow}>
                      <Text style={[s.vName, active && { color: colors.text }]}>{v.name}</Text>
                      <Text style={s.vSeats}>{v.seats} seter</Text>
                    </View>
                    <Text style={s.vTag}>{v.tagline}</Text>
                    <Text style={[s.vPrice, active && { color: colors.accent }]}>
                      {price != null ? kr(price) : '…'}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={s.summary} testID="booking-price-summary">
              <Text style={s.summaryLeft}>
                {estimate ? `${estimate.distance_km} km · ca. ${estimate.duration_min} min` : 'Beregner rute…'}
              </Text>
              <Text style={s.summaryPrice}>{kr(priceFor(selType))}</Text>
            </View>

            <Pressable style={s.payRow} onPress={() => router.push('/payment-methods')} testID="booking-payment-row">
              <Icon name={payMethod?.type === 'vipps' ? 'wallet' : 'card'} size={18} color={colors.accent} />
              <Text style={s.payText}>
                {payMethod ? (payMethod.type === 'vipps' ? 'Vipps' : `${payMethod.label} •••• ${payMethod.last4}`) : 'Legg til betaling'}
              </Text>
              <Text style={s.change}>Endre</Text>
            </Pressable>

            {error ? <Text style={s.error} testID="home-error">{error}</Text> : null}

            <Pressable
              style={[s.confirm, booking && { opacity: 0.6 }]}
              onPress={book}
              disabled={booking}
              testID="booking-confirm"
              accessibilityRole="button"
              accessibilityLabel={`Bestill ${VEHICLES.find((v) => v.type === selType)?.name || 'KJAPP'} for ${kr(priceFor(selType))}`}
            >
              {booking ? (
                <ActivityIndicator color={colors.accentOn} />
              ) : (
                <Text style={s.confirmText}>Bestill {VEHICLES.find((v) => v.type === selType)?.name || 'KJAPP'} · {kr(priceFor(selType))}</Text>
              )}
            </Pressable>
          </>
        )}
      </View>

      {searchOpen && (
        <SearchSheet
          onClose={() => setSearchOpen(false)}
          onSelect={(d: any) => { setDropoff(d); setSearchOpen(false); }}
          onVoice={() => { setSearchOpen(false); openVoice(); }}
          featured={featured}
          insets={insets}
        />
      )}
    </View>
  );
}

function SearchSheet({ onClose, onSelect, onVoice, featured, insets }: any) {
  const s = useStyles();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<any>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    timer.current = setTimeout(() => {
      placesApi.search(q.trim())
        .then((r) => setResults(r.results || []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 350);
    return () => timer.current && clearTimeout(timer.current);
  }, [q]);

  const items = q.trim().length < 2
    ? (featured || []).map((p: any) => ({ name: p.name, lat: p.lat, lng: p.lng, saved: true }))
    : results;

  return (
    <View style={[s.searchOverlay, { paddingTop: insets.top + 12 }]} testID="search-sheet">
      <View style={s.searchHeader}>
        <View style={s.searchField}>
          <Icon name="search" size={18} color={colors.textMuted} />
          <TextInput
            testID="search-input"
            autoFocus
            placeholder="Hvor skal du?"
            placeholderTextColor={colors.textMuted}
            style={s.searchInput}
            value={q}
            onChangeText={setQ}
            returnKeyType="search"
          />
          {loading ? <ActivityIndicator color={colors.accent} /> : null}
          <Pressable
            style={s.searchVoice}
            onPress={onVoice}
            testID="search-voice"
            accessibilityRole="button"
            accessibilityLabel="Bruk stemmen"
          >
            <VoiceGlyph size={20} color={colors.accent} />
          </Pressable>
        </View>
        <Pressable onPress={onClose} testID="search-close" style={s.searchClose} accessibilityRole="button" accessibilityLabel="Lukk søk">
          <Text style={{ color: colors.accent, fontSize: 15 }}>Avbryt</Text>
        </Pressable>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
        {items.map((r: any, i: number) => (
          <Pressable
            key={`${r.name}-${i}`}
            style={s.resultRow}
            testID={`search-result-${i}`}
            onPress={() => onSelect({ name: r.name, lat: r.lat, lng: r.lng })}
          >
            <View style={s.resultIcon}>
              <Icon name={r.saved ? 'star' : 'map-pin'} size={16} color={colors.accent} fill={r.saved ? colors.accent : 'none'} />
            </View>
            <Text style={s.resultText} numberOfLines={1}>{r.name}</Text>
          </Pressable>
        ))}
        {!items.length && q.trim().length >= 2 && !loading ? (
          <Text style={s.hint}>Ingen treff. Prøv et annet søk.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 8,
  },
  pill: {
    backgroundColor: 'rgba(9,17,25,0.92)', borderWidth: 1, borderColor: c.line,
    borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 10,
  },
  brand: { fontFamily: font.display, fontSize: 19, fontWeight: '700', color: c.text, letterSpacing: 1.1 },
  profileButton: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(9,17,25,0.92)', borderWidth: 1, borderColor: c.line,
  },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: c.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: c.line, paddingHorizontal: 18, paddingTop: 10,
  },
  handle: { alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: c.lineStrong, marginBottom: 14 },
  pickupRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  beacon: { width: 12, height: 12, borderRadius: 6, backgroundColor: c.accent },
  pickupText: { color: c.text, fontSize: 15, flex: 1 },
  carsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  carsText: { color: c.textMuted, fontSize: 13 },
  greeting: { color: c.textSecondary, fontSize: 12, marginBottom: 8, letterSpacing: 0.2 },
  destinationField: {
    minHeight: 68, flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface,
    borderRadius: radius.lg, marginBottom: 16, borderWidth: 1, borderColor: c.lineStrong,
  },
  destinationMain: { flex: 1, minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 10 },
  searchGlyph: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  whereTitle: { color: c.text, fontFamily: font.display, fontSize: 20, fontWeight: '650' as any },
  whereHint: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  destinationDivider: { width: 1, height: 38, backgroundColor: c.line, marginHorizontal: 2 },
  voiceButton: { width: 52, height: 52, marginHorizontal: 8, borderRadius: 16, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  chipsRow: { gap: 10, paddingBottom: 12 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.line,
    borderRadius: radius.pill, paddingHorizontal: 16, height: 44,
  },
  chipText: { color: c.text, fontSize: 14 },
  chipEdit: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0, borderRadius: radius.pill, paddingHorizontal: 16, height: 44, borderWidth: 1, borderColor: c.line, borderStyle: 'dashed' },
  chipEditText: { color: c.textSecondary, fontSize: 14 },
  hint: { color: c.textMuted, fontSize: 12, marginTop: 8, lineHeight: 18 },
  endpoints: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: 14, marginBottom: 12 },
  epRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  epText: { color: c.text, fontSize: 14, flex: 1 },
  epLine: { width: 1, height: 16, backgroundColor: c.lineStrong, marginLeft: 5.5, marginVertical: 4 },
  square: { width: 12, height: 12, borderRadius: 2, backgroundColor: c.text },
  change: { color: c.accent, fontSize: 13, fontWeight: '600' },
  sectionLabel: { color: c.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 1.4, marginBottom: 8 },
  vehiclesRow: { gap: 10, paddingBottom: 14 },
  vehicle: {
    width: 154, minHeight: 154, flexShrink: 0, backgroundColor: c.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: c.line, padding: 12,
  },
  vehicleActive: { borderColor: c.accent, backgroundColor: c.accentSoft },
  vehicleArtwork: { height: 68, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  vehicleTitleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  vName: { color: c.textSecondary, fontSize: 15, fontWeight: '650' as any, flexShrink: 1 },
  vSeats: { color: c.textMuted, fontSize: 10 },
  vTag: { color: c.textMuted, fontSize: 11, marginTop: 2 },
  vPrice: { color: c.text, fontFamily: font.body, fontVariant: ['tabular-nums'], fontSize: 17, fontWeight: '650' as any, marginTop: 6 },
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  summaryLeft: { color: c.textMuted, fontSize: 13, flex: 1 },
  summaryPrice: { color: c.text, fontFamily: font.display, fontVariant: ['tabular-nums'], fontWeight: '650' as any, fontSize: 24 },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: radius.md, paddingHorizontal: 16, height: 52, marginBottom: 12 },
  payText: { color: c.text, fontSize: 14, flex: 1 },
  error: { color: c.danger, fontSize: 13, marginBottom: 10 },
  confirm: {
    height: 56, borderRadius: radius.md, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center',
    shadowColor: c.accent, shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 3,
  },
  confirmText: { color: c.accentOn, fontSize: 16, fontWeight: '700' },
  searchOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.bg, paddingHorizontal: 16, zIndex: 50 },
  searchHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  searchField: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.surface,
    borderWidth: 1, borderColor: c.lineStrong, borderRadius: radius.md, paddingLeft: 14, paddingRight: 6, height: 54,
  },
  searchInput: { flex: 1, color: c.text, fontSize: 16, height: '100%' },
  searchVoice: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentSoft },
  searchClose: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.line },
  resultIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
  resultText: { color: c.text, fontSize: 15, flex: 1 },
}));