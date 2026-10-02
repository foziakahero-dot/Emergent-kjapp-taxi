import { useHideTabBar } from '@/src/components/FloatingTabBar';
import { VehicleGlyph } from '@/src/components/VehicleGlyph';
import { FigmaGradient } from '@/src/components/FigmaGradient';
import { Rise, Collapse } from '@/src/components/Motion';
import { Text, TextInput } from '@/src/components/Typography';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon, IconName } from '@/src/components/Icon';
import { Map } from '@/src/components/Map';
import { VehicleAsset, VehicleKind } from '@/src/components/VehicleAsset';
import { carsApi, mePlacesApi, paymentApi, placesApi, tripsApi } from '@/src/lib/api';
import { apiError, kr, VEHICLES } from '@/src/lib/format';

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

  const [loc, setLoc] = useState<{ lat: number; lng: number }>(OSLO);
  const [pickupLabel, setPickupLabel] = useState('Finner posisjonen din…');
  const [locDenied, setLocDenied] = useState(false);
  const [locationReady, setLocationReady] = useState(false);
  const [cars, setCars] = useState<any[]>([]);
  const [featured, setFeatured] = useState<any[]>([]);
  const [dropoff, setDropoff] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [estimate, setEstimate] = useState<any>(null);
  const [selType, setSelType] = useState('ai-first');
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  useHideTabBar(reviewing);
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

  const refreshLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationReady(false);
        setLocDenied(true);
        setPickupLabel('Posisjon ikke tilgjengelig');
        return false;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setLoc(p);
      setLocationReady(true);
      setLocDenied(false);
      setPickupLabel('Din posisjon');
      placesApi.reverse(p.lat, p.lng).then((r) => r?.label && setPickupLabel(r.label)).catch(() => {});
      return true;
    } catch {
      setLocationReady(false);
      setLocDenied(true);
      setPickupLabel('Posisjon ikke tilgjengelig');
      return false;
    }
  }, []);

  useEffect(() => {
    void refreshLocation();
    placesApi.list(true).then((r) => setFeatured(r.places || [])).catch(() => {});
    loadMethods();
    loadPlaces();
  }, [loadMethods, loadPlaces, refreshLocation]);

  useEffect(() => {
    let mounted = true;
    if (!locationReady) {
      setCars([]);
      return () => { mounted = false; };
    }
    const load = () => carsApi.nearby(loc.lat, loc.lng).then((r) => mounted && setCars(r.cars || [])).catch(() => {});
    load();
    const i = setInterval(load, 8000);
    return () => { mounted = false; clearInterval(i); };
  }, [locationReady, loc.lat, loc.lng]);

  useEffect(() => {
    if (!dropoff || !locationReady) { setEstimate(null); return; }
    tripsApi.estimate({
      pickup_lat: loc.lat, pickup_lng: loc.lng,
      dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng,
      stops: stops.map((x) => ({ address: x.name, lat: x.lat, lng: x.lng })),
    }).then(setEstimate).catch(() => setEstimate(null));
  }, [dropoff, locationReady, loc.lat, loc.lng, stops]);

  const etaValues = cars.map((car) => Number(car.eta_min)).filter((n) => Number.isFinite(n) && n > 0);
  const nearest = etaValues.length ? Math.min(...etaValues) : null;
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
    if (!locationReady) {
      setError('KJAPP trenger en fersk posisjon før du kan bestille tur.');
      return;
    }
    if (!estimate || priceFor(selType) == null) {
      setError('Vi beregner fortsatt rute og pris. Prøv igjen om et øyeblikk.');
      return;
    }
    if (!payMethod) {
      setError('Legg til et betalingskort før du bestiller.');
      router.push('/payment-methods');
      return;
    }
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
      // The request may have reached the server even if the response was lost.
      // Reconcile against canonical backend state before presenting a failure or allowing another booking.
      try {
        const active = await tripsApi.active();
        if (active?.trip_id) {
          router.replace(`/booking/${active.trip_id}`);
          return;
        }
      } catch {}
      if (e?.response?.status === 402) {
        setError('Legg til et betalingskort før du bestiller.');
        setTimeout(() => router.push('/payment-methods'), 700);
      } else if (e?.response?.status === 409) {
        setError('En bestilling behandles allerede. KJAPP sjekker den aktive turen automatisk.');
      } else {
        setError(apiError(e));
      }
    } finally {
      setBooking(false);
    }
  };

  const routeGeom = estimate?.geometry?.coordinates;
  const canBook = Boolean(locationReady && dropoff && estimate && priceFor(selType) != null && payMethod && !booking);
  const selectedCopy = vehicleCopy(selType);
  const selectedPrice = priceFor(selType);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Map
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        user={locationReady ? loc : null}
        pickup={dropoff && locationReady ? loc : null}
        dropoff={dropoff}
        route={routeGeom}
        cars={dropoff ? [] : cars}
        testID="home-map"
      />

      {!reviewing ? (
        <>
          <View style={[s.searchBarWrap, { top: insets.top + 12 }]}>
            <Pressable
              style={s.floatingSearch}
              onPress={() => setSearchOpen(true)}
              testID="home-where-to"
              accessibilityRole="button"
              accessibilityLabel="Søk etter destinasjon"
            >
              <Icon name="search" size={20} color={colors.textMuted} />
              <Text style={[s.floatingSearchText, dropoff && { color: colors.text }]} numberOfLines={1}>
                {dropoff?.name || 'Hvor skal du?'}
              </Text>
            </Pressable>
          </View>

          <Pressable
            style={[
              s.locationFab,
              {
                bottom: dropoff
                  ? insets.bottom + 372
                  : insets.bottom + (sheetCollapsed ? 94 : 300),
              },
            ]}
            onPress={() => void refreshLocation()}
            testID="home-recenter"
            accessibilityRole="button"
            accessibilityLabel="Sentrer kartet på min posisjon"
          >
            <Icon name="crosshair" size={21} color={colors.accent} />
          </Pressable>

          {!dropoff ? (
            <View style={[s.browseSheet, { paddingBottom: insets.bottom + (sheetCollapsed ? 32 : 112) }]} testID="home-browse-sheet">
              <Pressable
                style={s.sheetHandleButton}
                onPress={() => setSheetCollapsed((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={sheetCollapsed ? 'Utvid nylige steder' : 'Minimer nylige steder'}
              >
                <View style={s.handle} />
              </Pressable>

              <Pressable style={s.sheetTitleRow} onPress={() => setSheetCollapsed((v) => !v)}>
                <Text style={s.sheetEyebrow}>NYLIG OG FAVORITTER</Text>
                <Icon name={sheetCollapsed ? 'chevron-up' : 'chevron-down'} size={17} color={colors.textMuted} />
              </Pressable>

              <Collapse open={!sheetCollapsed}>
                <View style={s.placeList}>
                  {quickPlaces.slice(0, 4).map((p: any, i: number) => (
                    <Pressable
                      key={p.id || p.slug || `${p.name}-${i}`}
                      style={s.placeRow}
                      testID={`quick-${p.label || i}`}
                      onPress={() => setDropoff({ name: p.name, lat: p.lat, lng: p.lng })}
                    >
                      <View style={s.placeIcon}>
                        <Icon
                          name={(p.icon === 'home' ? 'home' : p.icon === 'briefcase' ? 'briefcase' : 'clock') as IconName}
                          size={18}
                          color={colors.textSecondary}
                        />
                      </View>
                      <View style={s.placeTextWrap}>
                        <Text style={s.placeTitle} numberOfLines={1}>{p.label || p.name}</Text>
                        <Text style={s.placeSub} numberOfLines={1}>{p.name}</Text>
                      </View>
                    </Pressable>
                  ))}
                  <Pressable style={s.managePlaces} onPress={() => router.push('/saved-places')}>
                    <Icon name={myPlaces.length ? 'settings' : 'plus'} size={17} color={colors.accent} />
                    <Text style={s.managePlacesText}>{myPlaces.length ? 'Rediger faste steder' : 'Legg til fast sted'}</Text>
                  </Pressable>
                  {locDenied ? (
                    <View style={s.locationWarning} testID="home-location-required">
                      <Text style={s.hint}>KJAPP trenger posisjonen din for korrekt hentested og biler i nærheten.</Text>
                      <View style={s.locationActions}>
                        <Pressable style={s.locationAction} onPress={() => void refreshLocation()}>
                          <Text style={s.locationActionText}>Prøv igjen</Text>
                        </Pressable>
                        <Pressable style={s.locationAction} onPress={() => Linking.openSettings().catch(() => {})}>
                          <Text style={s.locationActionText}>Innstillinger</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                </View>
              </Collapse>
            </View>
          ) : (
            <View style={[s.rideSheet, { paddingBottom: insets.bottom + 112 }]} testID="home-ride-sheet">
              <Pressable style={s.sheetHandleButton} onPress={() => setSheetCollapsed((v) => !v)}>
                <View style={s.handle} />
              </Pressable>

              <View style={s.rideHeader}>
                <Text style={s.rideTitle}>Velg reise</Text>
                <Pressable
                  onPress={() => {
                    setReviewing(false);
                    setDropoff(null);
                    setEstimate(null);
                  }}
                  testID="booking-change-dest"
                >
                  <Text style={s.changeMono}>ENDRE</Text>
                </Pressable>
              </View>

              <View style={s.vehicleList}>
                {goldVehicles.map((v) => {
                  const active = selType === v.type;
                  const price = priceFor(v.type);
                  const copy = vehicleCopy(v.type);
                  return (
                    <Pressable
                      key={v.type}
                      testID={`vehicle-${v.type}`}
                      onPress={() => setSelType(v.type)}
                      style={[s.vehicleRow, active && s.vehicleRowActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <View style={[s.vehicleIconBox, active && s.vehicleIconBoxActive]}>
                        <VehicleGlyph selected={active} />
                      </View>
                      <View style={s.vehicleInfo}>
                        <View style={s.vehicleNameRow}>
                          <Text style={s.vehicleName}>
                            {v.type === 'ai-first' ? 'KJAPP Standard' : v.type === 'trygg' ? 'KJAPP Comfort' : 'KJAPP Premium'}
                          </Text>
                          {v.type === 'ai-first' ? <Text style={s.vehicleBadge}>Mest valgt</Text> : null}
                        </View>
                        <Text style={s.vehicleMeta}>
                          {copy.tagline}{nearest != null ? ` · ${nearest} min` : ''}{v.type === 'trygg' ? ' · 7 pers.' : ' · 4 pers.'}
                        </Text>
                      </View>
                      <Text style={s.vehiclePrice}>{price != null ? kr(price) : '…'}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                style={[s.reviewButton, !canBook && s.buttonDisabled]}
                onPress={() => canBook && setReviewing(true)}
                disabled={!canBook}
                testID="booking-review"
              >
                <FigmaGradient pointerEvents="none" colors={['#FF3B3B', '#FF0000']} style={{ position: 'absolute', inset: 0, borderRadius: 999 }} />
                <Text style={s.reviewButtonText}>Se over · {selectedCopy.name}</Text>
              </Pressable>
              {error ? <Text style={s.error} testID="home-error">{error}</Text> : null}
            </View>
          )}
        </>
      ) : (
        <View style={[s.reviewScreen, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 32 }]} testID="booking-review-screen">
          <FigmaGradient pointerEvents="none" angle={180} colors={['#FFFFFF', '#F2F5FA']} style={StyleSheet.absoluteFill} />
          <View style={s.reviewHeader}>
            <Pressable style={s.backButton} onPress={() => setReviewing(false)} accessibilityLabel="Tilbake til bilvalg">
              <Icon name="chevron-left" size={20} color={colors.text} />
            </Pressable>
            <Text style={s.reviewTitle}>Bekreft tur</Text>
          </View>

          <View style={s.routeCard}>
            <View style={s.routeRow}>
              <View style={[s.routeDot, { backgroundColor: colors.online }]} />
              <Text style={s.routeText} numberOfLines={1}>{pickupLabel}</Text>
            </View>
            <View style={s.routeConnector} />
            <View style={s.routeRow}>
              <View style={[s.routeDot, { backgroundColor: colors.accent }]} />
              <Text style={s.routeText} numberOfLines={2}>{dropoff?.name}</Text>
            </View>
          </View>

          <View style={s.fareCard}>
            <View style={s.fareHead}>
              <Text style={s.fareVehicle}>{selectedCopy.name}</Text>
              <Text style={s.fastPriceBadge}>Fastpris</Text>
            </View>
            <View style={s.fareRows}>
              <View style={s.fareRow}>
                <Text style={s.fareLabel}>Avstand</Text>
                <Text style={s.fareValue}>{estimate ? `${estimate.distance_km} km` : '—'}</Text>
              </View>
              <View style={s.fareRow}>
                <Text style={s.fareLabel}>Estimert kjøretid</Text>
                <Text style={s.fareValue}>{estimate ? `${estimate.duration_min} min` : '—'}</Text>
              </View>
              <View style={s.fareTotalRow}>
                <Text style={s.fareTotalLabel}>Totalt</Text>
                <Text style={s.fareTotalValue}>{selectedPrice != null ? kr(selectedPrice) : '—'}</Text>
              </View>
            </View>
          </View>

          <Pressable style={s.paymentRow} onPress={() => router.push('/payment-methods')} testID="booking-payment-row">
            <Icon name={payMethod?.type === 'vipps' ? 'wallet' : 'card'} size={19} color={colors.textSecondary} />
            <Text style={s.paymentText} numberOfLines={1}>
              {payMethod ? (payMethod.type === 'vipps' ? 'Vipps' : `${payMethod.label} ••${payMethod.last4}`) : 'Legg til betalingsmåte'}
            </Text>
            <Text style={s.changeMono}>ENDRE</Text>
          </Pressable>

          {error ? <Text style={s.error} testID="home-error">{error}</Text> : null}
          <Pressable
            style={[s.confirmButton, !canBook && s.buttonDisabled]}
            onPress={book}
            disabled={!canBook}
            testID="booking-confirm"
          >
            <FigmaGradient pointerEvents="none" colors={['#FF3B3B', '#FF0000']} style={{ position: 'absolute', inset: 0, borderRadius: 999 }} />
            {booking ? <ActivityIndicator color={colors.accentOn} /> : <Text style={s.confirmButtonText}>Bekreft tur</Text>}
          </Pressable>
        </View>
      )}

      {searchOpen && !reviewing ? (
        <SearchSheet
          onClose={() => setSearchOpen(false)}
          onVoice={openVoice}
          onSelect={(d: any) => {
            if (searchTarget === 'stop') {
              setStops((prev) => prev.length < 3 ? [...prev, d] : prev);
            } else {
              setDropoff(d);
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
          <Icon name="search" size={19} color={colors.textMuted} />
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
          ) : q ? (
            <Pressable onPress={() => setQ('')} style={s.clearButton} accessibilityLabel="Tøm søk">
              <Icon name="x" size={12} color={colors.accentOn} strokeWidth={2.4} />
            </Pressable>
          ) : (
            <Pressable onPress={onVoice} style={s.voiceInline} accessibilityLabel="Bestill med stemmen">
              <Icon name="mic" size={18} color={colors.accent} />
            </Pressable>
          )}
        </View>
        <Pressable onPress={onClose} testID="search-close" style={s.cancelButton}>
          <Text style={s.cancelText}>Avbryt</Text>
        </Pressable>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.searchResults}>
        {items.map((r: any, i: number) => (
          <Pressable
            key={`${r.name}-${i}`}
            style={s.resultRow}
            testID={`search-result-${i}`}
            onPress={() => onSelect({ name: r.name, lat: r.lat, lng: r.lng })}
          >
            <View style={s.resultIcon}>
              <Icon name={r.saved ? 'star' : 'map-pin'} size={17} color={colors.textSecondary} fill={r.saved ? colors.textSecondary : 'none'} />
            </View>
            <View style={s.resultTextWrap}>
              <Text style={s.resultText} numberOfLines={1}>{r.name}</Text>
            </View>
          </Pressable>
        ))}
        {!items.length && q.trim().length >= 2 && !loading ? (
          <View style={s.emptySearch}>
            <View style={s.emptySearchIcon}><Icon name="search" size={24} color={colors.textMuted} /></View>
            <Text style={s.emptyTitle}>Fant ingen steder</Text>
            <Text style={s.emptySub}>Prøv et annet søk</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  searchBarWrap: { position: 'absolute', left: 16, right: 16, zIndex: 20 },
  floatingSearch: {
    minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1, borderColor: c.line, shadowColor: '#0B0E14', shadowOpacity: 0.10,
    shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  floatingSearchText: { flex: 1, color: c.textMuted, fontFamily: font.medium, fontSize: 15 },
  locationFab: {
    position: 'absolute', right: 16, zIndex: 21, width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1, borderColor: c.line, shadowColor: '#0B0E14', shadowOpacity: 0.12,
    shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  browseSheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20,
    backgroundColor: 'rgba(255,255,255,0.98)', borderTopLeftRadius: 30, borderTopRightRadius: 30,
    borderTopWidth: 1, borderColor: c.line, paddingHorizontal: 24, paddingTop: 16,
    shadowColor: '#0B0E14', shadowOpacity: 0.12, shadowRadius: 25, shadowOffset: { width: 0, height: -10 }, elevation: 9,
  },
  rideSheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20,
    backgroundColor: 'rgba(255,255,255,0.98)', borderTopLeftRadius: 30, borderTopRightRadius: 30,
    borderTopWidth: 1, borderColor: c.line, paddingHorizontal: 24, paddingTop: 16,
    shadowColor: '#0B0E14', shadowOpacity: 0.12, shadowRadius: 25, shadowOffset: { width: 0, height: -10 }, elevation: 9,
  },
  sheetHandleButton: { alignSelf: 'center', width: 64, height: 24, marginBottom: 12, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.lineStrong },
  sheetTitleRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetEyebrow: { color: c.textMuted, fontFamily: font.mono, fontSize: 10, letterSpacing: 1.6 },
  placeList: { paddingBottom: 2 },
  placeRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 12 },
  placeIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cardSubtle },
  placeTextWrap: { flex: 1, minHeight: 82, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: c.line },
  placeTitle: { color: c.text, fontFamily: font.semibold, fontSize: 14 },
  placeSub: { color: c.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 2 },
  managePlaces: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 4 },
  managePlacesText: { color: c.accent, fontFamily: font.medium, fontSize: 13 },
  locationWarning: { marginTop: 8, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: c.warning, backgroundColor: c.warning + '10' },
  hint: { color: c.textSecondary, fontSize: 12, lineHeight: 17 },
  locationActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  locationAction: { minHeight: 38, paddingHorizontal: 14, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.lineStrong, backgroundColor: c.surface },
  locationActionText: { color: c.text, fontFamily: font.medium, fontSize: 12 },
  rideHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  rideTitle: { color: c.text, fontFamily: font.semibold, fontSize: 18, lineHeight: 28, letterSpacing: -0.36 },
  changeMono: { color: c.accent, fontFamily: font.mono, fontSize: 10, letterSpacing: 1.4 },
  vehicleList: { gap: 8 },
  vehicleRow: {
    minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12,
    borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line,
  },
  vehicleRowActive: { backgroundColor: c.accentSoft, borderColor: c.accent },
  vehicleIconBox: { width: 56, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cardSubtle },
  vehicleIconBoxActive: { backgroundColor: c.surface },
  vehicleInfo: { flex: 1 },
  vehicleNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  vehicleName: { color: c.text, fontFamily: font.semibold, fontSize: 14 },
  vehicleBadge: { color: c.accentOn, backgroundColor: c.accent, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, fontFamily: font.semibold, fontSize: 9 },
  vehicleMeta: { color: c.textSecondary, fontSize: 12, lineHeight: 16, marginTop: 3 },
  vehiclePrice: { color: c.text, fontFamily: font.semibold, fontSize: 14 },
  reviewButton: {
    minHeight: 54, marginTop: 14, borderRadius: 27, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center',
    shadowColor: c.accent, shadowOpacity: 0.30, shadowRadius: 15, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  reviewButtonText: { color: c.accentOn, fontFamily: font.semibold, fontSize: 14 },
  buttonDisabled: { opacity: 0.45 },
  error: { color: c.danger, fontSize: 12, textAlign: 'center', marginTop: 8 },

  reviewScreen: { ...StyleSheet.absoluteFill, zIndex: 30, backgroundColor: c.bg, paddingHorizontal: 24 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.lineStrong },
  reviewTitle: { color: c.text, fontFamily: font.bold, fontSize: 20 },
  routeCard: { marginTop: 24, borderRadius: 24, padding: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, shadowColor: '#0B0E14', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  routeDot: { width: 10, height: 10, borderRadius: 5 },
  routeText: { flex: 1, color: c.text, fontFamily: font.medium, fontSize: 14 },
  routeConnector: { width: 1, height: 20, marginLeft: 4.5, backgroundColor: c.lineStrong },
  fareCard: { marginTop: 16, borderRadius: 24, padding: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line },
  fareHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fareVehicle: { color: c.text, fontFamily: font.semibold, fontSize: 14 },
  fastPriceBadge: { color: c.accentOn, backgroundColor: c.online, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, fontFamily: font.semibold, fontSize: 10 },
  fareRows: { marginTop: 12 },
  fareRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 },
  fareLabel: { color: c.textSecondary, fontSize: 14 },
  fareValue: { color: c.text, fontFamily: font.medium, fontSize: 14 },
  fareTotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5, paddingTop: 13, borderTopWidth: 1, borderTopColor: c.line },
  fareTotalLabel: { color: c.text, fontFamily: font.bold, fontSize: 16 },
  fareTotalValue: { color: c.text, fontFamily: font.bold, fontSize: 16 },
  paymentRow: { marginTop: 16, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, paddingHorizontal: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line },
  paymentText: { flex: 1, color: c.text, fontFamily: font.semibold, fontSize: 14 },
  confirmButton: { minHeight: 56, marginTop: 'auto', borderRadius: 28, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', shadowColor: c.accent, shadowOpacity: 0.32, shadowRadius: 17, shadowOffset: { width: 0, height: 9 }, elevation: 7 },
  confirmButtonText: { color: c.accentOn, fontFamily: font.bold, fontSize: 16 },

  searchOverlay: { ...StyleSheet.absoluteFill, zIndex: 60, backgroundColor: c.surface, paddingHorizontal: 16 },
  searchHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: c.line },
  searchField: { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 16, paddingHorizontal: 12, backgroundColor: c.cardSubtle },
  searchInput: { flex: 1, color: c.text, fontFamily: font.body, fontSize: 15, paddingVertical: 0 },
  clearButton: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: c.textMuted },
  voiceInline: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  cancelButton: { minHeight: 44, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: c.accent, fontFamily: font.semibold, fontSize: 14 },
  searchResults: { paddingTop: 4, paddingBottom: 40 },
  resultRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12 },
  resultIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cardSubtle },
  resultTextWrap: { flex: 1, minHeight: 64, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: c.line },
  resultText: { color: c.text, fontFamily: font.semibold, fontSize: 14 },
  emptySearch: { alignItems: 'center', paddingTop: 64 },
  emptySearchIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cardSubtle },
  emptyTitle: { color: c.text, fontFamily: font.semibold, fontSize: 14, marginTop: 12 },
  emptySub: { color: c.textSecondary, fontSize: 12, marginTop: 4 },
}));



