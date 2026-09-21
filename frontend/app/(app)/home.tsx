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
import { VehicleAsset, VehicleKind } from '@/src/components/VehicleAsset';
import { useAuth } from '@/src/context/AuthContext';
import { carsApi, mePlacesApi, paymentApi, placesApi, tripsApi } from '@/src/lib/api';
import { apiError, greeting, kr, VEHICLES } from '@/src/lib/format';

const OSLO = { lat: 59.9127, lng: 10.7461 };
const GOLD_VEHICLE_TYPES: VehicleKind[] = ['ai-first', 'trygg', 'premium'];

function vehicleCopy(type: string) {
  if (type === 'trygg') return { name: 'KJAPP XL', tagline: 'Mer plass · 7 seter' };
  if (type === 'premium') return { name: 'Premium', tagline: 'Executive comfort' };
  return { name: 'KJAPP', tagline: 'Rask og enkel' };
}

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
  const [searchTarget, setSearchTarget] = useState<'dropoff' | 'stop'>('dropoff');
  const [stops, setStops] = useState<any[]>([]);
  const [specialNeeds, setSpecialNeeds] = useState<string[]>([]);
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
    }, [loadMethods, loadPlaces, router]),
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
      stops: stops.map((x) => ({ address: x.name, lat: x.lat, lng: x.lng })),
    }).then(setEstimate).catch(() => setEstimate(null));
  }, [dropoff, loc.lat, loc.lng, stops]);

  const nearest = cars.length ? Math.min(...cars.map((c) => c.eta_min || 3)) : null;
  const priceFor = (type: string) => estimate?.options?.find((o: any) => o.vehicle_type === type)?.price;
  const payMethod = methods.find((m) => m.is_default) || methods[0];
  const quickPlaces = myPlaces.length ? myPlaces : featured;
  const goldVehicles = VEHICLES.filter((v) => GOLD_VEHICLE_TYPES.includes(v.type as VehicleKind));

  const openVoice = () => {
    setSearchOpen(false);
    router.push('/(app)/assist');
  };

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
        stops: stops.map((x) => ({ address: x.name, lat: x.lat, lng: x.lng })),
        special_needs: specialNeeds,
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
        <View style={s.brandPill}>
          <Text style={s.brand}>KJ<Text style={{ color: colors.accent }}>A</Text>PP</Text>
        </View>
        <Pressable
          style={s.iconControl}
          testID="home-profile-btn"
          onPress={() => router.push('/(app)/profile')}
          accessibilityRole="button"
          accessibilityLabel="Åpne profil"
        >
          <Icon name="user" size={20} color={colors.text} />
        </Pressable>
      </View>

      {!dropoff && !cars.length && !searchOpen ? (
        <View style={[s.searchingGlass, { top: insets.top + 68 }]} pointerEvents="none" testID="home-searching-indicator">
          <ActivityIndicator color={colors.accent} size="small" />
          <View style={{ flex: 1 }}><Text style={s.searchingTitle}>Søker etter ledige biler…</Text><Text style={s.searchingSub}>Oppdaterer nærområdet ditt</Text></View>
        </View>
      ) : null}

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
            <View style={s.destinationCard} testID="home-destination-entry">
              <Pressable
                style={s.destinationMain}
                onPress={() => setSearchOpen(true)}
                testID="home-where-to"
                accessibilityRole="button"
                accessibilityLabel="Søk etter destinasjon"
              >
                <Text style={s.greeting}>{greeting(user?.fullName)}</Text>
                <Text style={s.whereTitle}>Hvor skal du?</Text>
                <Text style={s.whereHint}>Søk adresse, sted eller flyplass</Text>
              </Pressable>
              <View style={s.destinationActions}>
                <Pressable
                  style={s.voiceBtn}
                  onPress={openVoice}
                  testID="home-voice"
                  accessibilityRole="button"
                  accessibilityLabel="Bestill med stemmen"
                >
                  <Icon name="mic" size={21} color={colors.accent} />
                </Pressable>
                <Pressable
                  style={s.searchBtn}
                  onPress={() => setSearchOpen(true)}
                  testID="home-search"
                  accessibilityRole="button"
                  accessibilityLabel="Åpne destinasjonssøk"
                >
                  <Icon name="search" size={20} color={colors.accentOn} />
                </Pressable>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow}>
              {quickPlaces.map((p: any) => (
                <Pressable
                  key={p.id || p.slug}
                  style={s.chip}
                  testID={`quick-${p.label}`}
                  onPress={() => setDropoff({ name: p.name, lat: p.lat, lng: p.lng })}
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

            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Velg bil</Text>
              <Text style={s.sectionMeta}>{estimate ? `ca. ${estimate.duration_min} min` : 'Beregner…'}</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.vehiclesRow}>
              {goldVehicles.map((v) => {
                const active = selType === v.type;
                const price = priceFor(v.type);
                const copy = vehicleCopy(v.type);
                return (
                  <Pressable
                    key={v.type}
                    testID={`vehicle-${v.type}`}
                    onPress={() => setSelType(v.type)}
                    style={[s.vehicle, active && s.vehicleActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${copy.name}, ${copy.tagline}, ${price != null ? kr(price) : 'pris beregnes'}`}
                  >
                    <View style={s.vehicleArtwork}>
                      <VehicleAsset kind={v.type as VehicleKind} selected={active} width={126} height={66} />
                    </View>
                    <View style={s.vehicleCopyRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.vName, active && { color: colors.text }]}>{copy.name}</Text>
                        <Text style={s.vTag}>{copy.tagline}</Text>
                      </View>
                      <Text style={[s.vPrice, active && { color: colors.accent }]}>
                        {price != null ? kr(price) : '…'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={s.summary} testID="booking-price-summary">
              <View style={{ flex: 1 }}>
                <Text style={s.summaryLeft}>
                  {estimate ? `${estimate.distance_km} km · estimert kjøretid ${estimate.duration_min} min` : 'Beregner rute…'}
                </Text>
                {estimate?.commission_rate != null ? (
                  <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 3 }} testID="booking-service-fee">
                    KJAPP serviceavgift {Math.round(Number(estimate.commission_rate) * 100)} % · inkludert i vist totalpris
                  </Text>
                ) : null}
              </View>
              <Text style={s.summaryPrice}>{kr(priceFor(selType))}</Text>
            </View>

            <View style={{ gap: 8, marginBottom: 10 }} testID="booking-options">
              {stops.map((stop, idx) => (
                <View key={`${stop.name}-${idx}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icon name="map-pin" size={14} color={colors.accent} />
                  <Text style={{ color: colors.textSecondary, fontSize: 12, flex: 1 }} numberOfLines={1}>Stopp {idx + 1}: {stop.name}</Text>
                  <Pressable onPress={() => setStops((prev) => prev.filter((_, i) => i !== idx))} accessibilityLabel={`Fjern stopp ${idx + 1}`}>
                    <Icon name="x" size={15} color={colors.textMuted} />
                  </Pressable>
                </View>
              ))}
              {stops.length < 3 ? (
                <Pressable
                  style={s.payRow}
                  onPress={() => { setSearchTarget('stop'); setSearchOpen(true); }}
                  testID="booking-add-stop"
                  accessibilityRole="button"
                  accessibilityLabel="Legg til stopp"
                >
                  <Icon name="plus" size={17} color={colors.accent} />
                  <Text style={s.payText}>Legg til stopp</Text>
                  <Text style={s.change}>{stops.length}/3</Text>
                </Pressable>
              ) : null}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {[
                  ['wheelchair', 'Rullestol'], ['large_luggage', 'Stor bagasje'], ['pet', 'Kjæledyr'],
                  ['hearing_impaired', 'Hørselsbehov'], ['visual_impaired', 'Synsbehov'], ['child_seat', 'Barnesete'],
                ].map(([id, label]) => {
                  const active = specialNeeds.includes(id);
                  return (
                    <Pressable
                      key={id}
                      onPress={() => setSpecialNeeds((prev) => active ? prev.filter((x) => x !== id) : [...prev, id])}
                      style={[s.chip, active && { borderColor: colors.accent, backgroundColor: 'rgba(45,212,191,0.10)' }]}
                      testID={`need-${id}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[s.chipText, active && { color: colors.accent }]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
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
            >
              {booking ? (
                <ActivityIndicator color={colors.accentOn} />
              ) : (
                <Text style={s.confirmText}>Bekreft KJAPP · {kr(priceFor(selType))}</Text>
              )}
            </Pressable>
          </>
        )}
      </View>

      {searchOpen && (
        <SearchSheet
          onClose={() => setSearchOpen(false)}
          onVoice={openVoice}
          onSelect={(d: any) => {
            if (searchTarget === 'stop') {
              setStops((prev) => prev.length < 3 ? [...prev, d] : prev);
            } else {
              setDropoff(d);
            }
            setSearchTarget('dropoff');
            setSearchOpen(false);
          }}
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
        <Pressable onPress={onClose} testID="search-back" style={s.searchBack} accessibilityRole="button" accessibilityLabel="Tilbake til kartet">
          <Icon name="arrow-left" size={20} color={colors.text} />
        </Pressable>
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
          {loading ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Pressable
              onPress={onVoice}
              style={s.searchVoice}
              testID="search-voice"
              accessibilityRole="button"
              accessibilityLabel="Bruk stemmen"
            >
              <Icon name="mic" size={19} color={colors.accent} />
            </Pressable>
          )}
        </View>
        <Pressable onPress={onClose} testID="search-close" style={s.searchClose}>
          <Text style={{ color: colors.accent, fontSize: 15 }}>Avbryt</Text>
        </Pressable>
      </View>
      <Text style={s.searchPrompt}>Skriv eller si destinasjonen. Du bekrefter alltid bil og pris før turen opprettes.</Text>
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
  brandPill: {
    backgroundColor: 'rgba(5,10,15,0.88)', borderWidth: 1, borderColor: c.line,
    borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9,
  },
  brand: { fontFamily: font.display, fontSize: 19, fontWeight: '700', color: c.text, letterSpacing: 1.1 },
  iconControl: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(5,10,15,0.88)', borderWidth: 1, borderColor: c.line,
  },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(9,17,25,0.97)', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: c.line, paddingHorizontal: 18, paddingTop: 10,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.lineStrong, marginBottom: 14 },
  pickupRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 7 },
  beacon: { width: 11, height: 11, borderRadius: 6, backgroundColor: c.accent },
  pickupText: { color: c.text, fontSize: 14, flex: 1 },
  carsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 15 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  carsText: { color: c.textMuted, fontSize: 12 },
  searchingGlass: { position: 'absolute', left: 16, right: 16, zIndex: 8, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, backgroundColor: 'rgba(8,20,28,0.74)', borderWidth: 1, borderColor: 'rgba(0,229,245,0.28)' },
  searchingTitle: { color: c.text, fontFamily: font.semibold, fontSize: 13 },
  searchingSub: { color: c.textMuted, fontSize: 11, marginTop: 2 },
  destinationCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: c.cardSubtle,
    borderRadius: radius.lg, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: c.line,
  },
  destinationMain: { flex: 1, paddingVertical: 2 },
  destinationActions: { flexDirection: 'row', gap: 8, alignItems: 'center', marginLeft: 12 },
  greeting: { color: c.accent, fontSize: 12, marginBottom: 3, letterSpacing: 0.4, fontWeight: '600' },
  whereTitle: { color: c.text, fontFamily: font.display, fontWeight: '650' as any, fontSize: 24, lineHeight: 29 },
  whereHint: { color: c.textMuted, fontSize: 12, marginTop: 4 },
  voiceBtn: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: c.accentSoft,
    borderWidth: 1, borderColor: 'rgba(0,229,245,0.22)', alignItems: 'center', justifyContent: 'center',
  },
  searchBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  chipsRow: { gap: 10, paddingBottom: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0,
    backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line,
    borderRadius: 999, paddingHorizontal: 15, height: 44,
  },
  chipText: { color: c.text, fontSize: 14 },
  chipEdit: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0, borderRadius: 999, paddingHorizontal: 15, height: 44, borderWidth: 1, borderColor: c.line, borderStyle: 'dashed' },
  chipEditText: { color: c.textSecondary, fontSize: 14 },
  hint: { color: c.textMuted, fontSize: 12, marginTop: 8, lineHeight: 18 },
  endpoints: { backgroundColor: c.cardSubtle, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: 14, marginBottom: 12 },
  epRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  epText: { color: c.text, fontSize: 14, flex: 1 },
  epLine: { width: 1, height: 16, backgroundColor: c.lineStrong, marginLeft: 5, marginVertical: 4 },
  square: { width: 11, height: 11, borderRadius: 2, backgroundColor: c.text },
  change: { color: c.accent, fontSize: 13, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9, paddingHorizontal: 2 },
  sectionTitle: { color: c.text, fontSize: 15, fontWeight: '650' as any },
  sectionMeta: { color: c.textMuted, fontSize: 12 },
  vehiclesRow: { gap: 10, paddingBottom: 13 },
  vehicle: {
    width: 162, minHeight: 132, flexShrink: 0, backgroundColor: c.cardSubtle, borderRadius: radius.lg,
    borderWidth: 1, borderColor: c.line, paddingHorizontal: 12, paddingTop: 7, paddingBottom: 12,
  },
  vehicleActive: { borderColor: c.accent, backgroundColor: c.accentSoft },
  vehicleArtwork: { height: 68, alignItems: 'center', justifyContent: 'center' },
  vehicleCopyRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  vName: { color: c.textSecondary, fontSize: 14, fontWeight: '700', marginTop: 1 },
  vTag: { color: c.textMuted, fontSize: 10.5, marginTop: 2 },
  vPrice: { color: c.text, fontFamily: font.mono, fontSize: 14, fontWeight: '600' },
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  summaryLeft: { color: c.textMuted, fontSize: 12, flex: 1 },
  summaryPrice: { color: c.text, fontFamily: font.display, fontWeight: '650' as any, fontSize: 22 },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line, borderRadius: radius.md, paddingHorizontal: 15, height: 52, marginBottom: 12 },
  payText: { color: c.text, fontSize: 14, flex: 1 },
  error: { color: c.danger, fontSize: 13, marginBottom: 10 },
  confirm: {
    height: 56, borderRadius: radius.lg, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center',
    shadowColor: c.accent, shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 3,
  },
  confirmText: { color: c.accentOn, fontSize: 16, fontWeight: '700' },
  searchOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.bg, paddingHorizontal: 16, zIndex: 50 },
  searchHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  searchBack: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line },
  searchField: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.card,
    borderWidth: 1, borderColor: c.lineStrong, borderRadius: radius.md, paddingLeft: 14, paddingRight: 6, height: 54,
  },
  searchInput: { flex: 1, color: c.text, fontSize: 16, height: '100%' },
  searchVoice: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentSoft },
  searchClose: { minWidth: 52, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  searchPrompt: { color: c.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 12, paddingHorizontal: 2 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, borderBottomWidth: 1, borderBottomColor: c.line },
  resultIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.cardSubtle, alignItems: 'center', justifyContent: 'center' },
  resultText: { color: c.text, fontSize: 15, flex: 1 },
}));
