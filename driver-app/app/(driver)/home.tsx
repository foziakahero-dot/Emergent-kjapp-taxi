import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Platform, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon } from '@/src/components/Icon';
import { Map } from '@/src/components/Map';
import { ChatSheet } from '@/src/components/ChatSheet';
import { useAuth } from '@/src/context/AuthContext';
import { driverApi, safetyApi } from '@/src/lib/api';
import { apiError, kr } from '@/src/lib/format';
import { storage } from '@/src/utils/storage';

type Loc = { lat: number; lng: number; heading?: number };

function hoursLabel(min?: number) {
  const m = min || 0;
  if (m >= 60) return `${Math.floor(m / 60)}t ${m % 60}m`;
  return `${m}m`;
}

type CriticalTripAction = 'at_pickup' | 'start' | 'arrive';
type QueuedTripAction = { trip_id: string; action: CriticalTripAction; queued_at: string };
const QUEUED_TRIP_ACTION_KEY = 'kjapp_driver_queued_trip_action_v1';

async function applyCriticalTripAction(action: CriticalTripAction, tripId: string) {
  if (action === 'at_pickup') return driverApi.atPickup(tripId);
  if (action === 'start') return driverApi.start(tripId);
  return driverApi.arrive(tripId);
}

function actionAlreadyApplied(action: CriticalTripAction, status?: string) {
  if (action === 'at_pickup') return ['at_pickup','in_trip','arrived','completed','rated'].includes(status || '');
  if (action === 'start') return ['in_trip','arrived','completed','rated'].includes(status || '');
  return ['arrived','completed','rated'].includes(status || '');
}

function actionCanRetry(action: CriticalTripAction, status?: string) {
  if (action === 'at_pickup') return status === 'driver_on_way';
  if (action === 'start') return status === 'at_pickup';
  return status === 'in_trip';
}

export default function DriverHome() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { user } = useAuth();
  const [online, setOnline] = useState(false);
  const [pending, setPending] = useState<any[]>([]);
  const [current, setCurrent] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loc, setLoc] = useState<Loc | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [offerClock, setOfferClock] = useState(Date.now());
  const watch = useRef<Location.LocationSubscription | null>(null);
  const gpsBlocked = useRef(false);
  const actionRetrying = useRef(false);

  const poll = useCallback(async () => {
    try {
      const cur = await driverApi.current();
      let normalized = cur?.trip || cur || null;
      setCurrent(normalized);

      if (!actionRetrying.current) {
        const raw = await storage.getItem(QUEUED_TRIP_ACTION_KEY);
        if (raw) {
          try {
            const queued = JSON.parse(raw) as QueuedTripAction;
            if (normalized && queued.trip_id !== normalized.trip_id) {
              await storage.removeItem(QUEUED_TRIP_ACTION_KEY);
            } else if (normalized && queued.trip_id === normalized.trip_id) {
              if (actionAlreadyApplied(queued.action, normalized.status)) {
                await storage.removeItem(QUEUED_TRIP_ACTION_KEY);
                setError('');
              } else if (actionCanRetry(queued.action, normalized.status)) {
                actionRetrying.current = true;
                try {
                  await applyCriticalTripAction(queued.action, queued.trip_id);
                  await storage.removeItem(QUEUED_TRIP_ACTION_KEY);
                  const refreshed = await driverApi.current();
                  normalized = refreshed?.trip || refreshed || normalized;
                  setCurrent(normalized);
                  setError('');
                } catch (e: any) {
                  if (e?.response) {
                    // The server answered: this is a semantic/state/GPS rejection, not an
                    // offline transport failure. Do not hammer the same invalid action forever.
                    await storage.removeItem(QUEUED_TRIP_ACTION_KEY);
                    setError(apiError(e));
                  }
                  // With no HTTP response we are still offline; keep the queued action.
                } finally {
                  actionRetrying.current = false;
                }
              }
            }
          } catch {
            await storage.removeItem(QUEUED_TRIP_ACTION_KEY);
          }
        }
      }
    } catch {
      // Preserve the last known active trip while temporarily offline.
    }
    try {
      const p = await driverApi.pending();
      setPending(p?.trips || p?.pending || (Array.isArray(p) ? p : []));
      if (p?.gps_stale) {
        setError('GPS-posisjonen er for gammel. KJAPP sender ikke nye turer før en fersk posisjon er registrert.');
      }
    } catch { setPending([]); }
    driverApi.summary().then((r) => {
      setSummary(r);
      if (typeof r?.online === 'boolean' && !gpsBlocked.current) setOnline(r.online);
    }).catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      poll();
      const i = setInterval(poll, 4000);
      return () => clearInterval(i);
    }, [poll]),
  );

  useEffect(() => {
    const i = setInterval(() => setOfferClock(Date.now()), 500);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void poll();
    });
    return () => sub.remove();
  }, [poll]);

  useEffect(() => {
    let active = true;

    const stopWatching = () => {
      if (watch.current) {
        watch.current.remove();
        watch.current = null;
      }
    };

    const forceOffline = async (message: string) => {
      gpsBlocked.current = true;
      let backendOffline = true;
      try {
        await driverApi.online(false);
      } catch {
        backendOffline = false;
      }
      if (!active) return;
      stopWatching();
      setLoc(null);
      setOnline(false);
      setError(backendOffline
        ? `${message} Du er satt OFFLINE.`
        : `${message} KJAPP kunne ikke bekrefte OFFLINE-status mot serveren. Prøv igjen før du tar turer.`);
    };

    const startTracking = async () => {
      if (!online) {
        stopWatching();
        if (active) setLoc(null);
        return;
      }

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!active) return;
        if (status !== 'granted') {
          await forceOffline('Posisjon må være aktiv for at KJAPP skal kunne sende turer og dele korrekt henteposisjon.');
          return;
        }

        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (!active) return;
        const p: Loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, heading: pos.coords.heading || 0 };
        gpsBlocked.current = false;
        setLoc(p);
        setError('');
        driverApi.location(
          p.lat,
          p.lng,
          p.heading || 0,
          Math.max(0, pos.coords.speed || 0),
          new Date(pos.timestamp).toISOString(),
        ).catch(() => {});

        const activeTrip = ['driver_on_way', 'at_pickup', 'in_trip'].includes(current?.status || '');
        const subscription = await Location.watchPositionAsync(
          {
            accuracy: activeTrip ? Location.Accuracy.BestForNavigation : Location.Accuracy.High,
            distanceInterval: activeTrip ? 5 : 40,
            timeInterval: activeTrip ? 3000 : 12000,
          },
          (u) => {
            if (!active) return;
            const np: Loc = { lat: u.coords.latitude, lng: u.coords.longitude, heading: u.coords.heading || 0 };
            setLoc(np);
            driverApi.location(
              np.lat,
              np.lng,
              np.heading || 0,
              Math.max(0, u.coords.speed || 0),
              new Date(u.timestamp).toISOString(),
            ).catch(() => {});
          },
        );
        if (!active) subscription.remove();
        else {
          stopWatching();
          watch.current = subscription;
        }
      } catch {
        await forceOffline('Kunne ikke sikre en gyldig GPS-posisjon. Kontroller posisjonstilgang og prøv igjen.');
      }
    };

    void startTracking();
    return () => {
      active = false;
      stopWatching();
    };
  }, [online, current?.status]);

  const toggleOnline = async () => {
    const next = !online;
    setError('');
    setBusy(true);
    if (next) gpsBlocked.current = false;
    try {
      await driverApi.online(next);
      setOnline(next);
      if (next) poll();
    } catch (e) { setError(apiError(e)); }
    finally { setBusy(false); }
  };

  const accept = async (tripId: string) => {
    setBusy(true);
    setError('');
    try {
      await driverApi.accept(tripId);
      await poll();
    } catch (e) {
      // If the accept reached the backend but the response was lost, /driver/current
      // is canonical and prevents the app from showing a false failed-accept state.
      try {
        const confirmed = await driverApi.current();
        if (confirmed?.trip_id === tripId) {
          setCurrent(confirmed);
          setPending([]);
          return;
        }
      } catch {}
      setError(apiError(e));
      await poll().catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  const decline = async (tripId: string) => {
    try { await driverApi.decline(tripId); setPending((p) => p.filter((t) => t.trip_id !== tripId)); } catch {}
  };

  const advance = async () => {
    if (!current) return;
    const action: CriticalTripAction | null =
      current.status === 'driver_on_way' ? 'at_pickup'
      : current.status === 'at_pickup' ? 'start'
      : current.status === 'in_trip' ? 'arrive'
      : null;
    if (!action) return;

    const execute = async () => {
      setBusy(true);
      try {
        await applyCriticalTripAction(action, current.trip_id);
        await storage.removeItem(QUEUED_TRIP_ACTION_KEY);
        setError('');
        await poll();
      } catch (e: any) {
        if (!e?.response) {
          const queued: QueuedTripAction = { trip_id: current.trip_id, action, queued_at: new Date().toISOString() };
          await storage.setItem(QUEUED_TRIP_ACTION_KEY, JSON.stringify(queued));
          setError('Midlertidig nettfeil. Handlingen er lagret på telefonen og sendes automatisk når forbindelsen er tilbake.');
        } else {
          setError(apiError(e));
        }
      } finally {
        setBusy(false);
      }
    };

    if (action === 'arrive') {
      Alert.alert(
        'Fullføre turen?',
        'KJAPP kontrollerer at du er nær destinasjonen før turen avsluttes og betaling kan starte.',
        [
          { text: 'Fortsett turen', style: 'cancel' },
          { text: 'Fullfør turen', onPress: () => { void execute(); } },
        ],
      );
      return;
    }

    await execute();
  };

  const noShow = async () => {
    if (!current || current.status !== 'at_pickup' || busy) return;
    Alert.alert(
      'Kunden kom ikke?',
      'No-show kan bare registreres etter ventetiden ved hentestedet. KJAPP kontrollerer ankomsttid og GPS på serveren.',
      [
        { text: 'Fortsett å vente', style: 'cancel' },
        {
          text: 'Registrer no-show',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            setError('');
            try {
              await driverApi.noShow(current.trip_id);
              await poll();
            } catch (e) {
              setError(apiError(e));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const emergency = async () => {
    if (!current) return;
    try {
      await safetyApi.log(current.trip_id, {
        kind: 'emergency',
        ...(loc ? { lat: loc.lat, lng: loc.lng } : {}),
      });
    } catch {}
    Linking.openURL('tel:112').catch(() => {});
  };

  const openNavigation = async () => {
    if (!current) return;
    const toPickup = current.status === 'driver_on_way';
    const lat = Number(toPickup ? current.pickup_lat : current.dropoff_lat);
    const lng = Number(toPickup ? current.pickup_lng : current.dropoff_lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setError('Mangler gyldige koordinater for navigasjon.');
      return;
    }

    const stops: any[] = !toPickup && Array.isArray(current.stops) ? current.stops : [];
    const validStops = stops.filter((stop) =>
      Number.isFinite(Number(stop?.lat)) && Number.isFinite(Number(stop?.lng))
    );
    const waypoints = validStops
      .map((stop) => `${Number(stop.lat)},${Number(stop.lng)}`)
      .join('|');

    const fallback =
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` +
      (waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : '') +
      '&travelmode=driving';
    const native = validStops.length
      ? fallback
      : Platform.OS === 'ios'
        ? `maps://?daddr=${lat},${lng}&dirflg=d`
        : `google.navigation:q=${lat},${lng}&mode=d`;

    try {
      const supported = await Linking.canOpenURL(native);
      await Linking.openURL(supported ? native : fallback);
    } catch {
      Linking.openURL(fallback).catch(() => setError('Kunne ikke åpne navigasjon på telefonen.'));
    }
  };

  const actionLabel =
    current?.status === 'driver_on_way' ? 'Jeg er fremme'
    : current?.status === 'at_pickup' ? 'Start turen'
    : current?.status === 'in_trip' ? 'Fullfør turen'
    : '';

  const needLabels: Record<string, string> = {
    wheelchair: 'Rullestol', large_luggage: 'Stor bagasje', pet: 'Kjæledyr',
    hearing_impaired: 'Hørselsbehov', visual_impaired: 'Synsbehov', child_seat: 'Barnesete',
  };
  const tripExtras = (t: any) => {
    const bits: string[] = [];
    if (Array.isArray(t?.stops) && t.stops.length) bits.push(`${t.stops.length} ekstra stopp`);
    if (Array.isArray(t?.special_needs) && t.special_needs.length) bits.push(t.special_needs.map((x: string) => needLabels[x] || x).join(' · '));
    return bits.join(' · ');
  };

  const firstOffer = pending[0];
  const offerExpiresMs = firstOffer?.offer_expires_at ? Date.parse(firstOffer.offer_expires_at) : NaN;
  const offerRemaining = Number.isFinite(offerExpiresMs)
    ? Math.max(0, Math.ceil((offerExpiresMs - offerClock) / 1000))
    : null;
  const offerExpired = offerRemaining !== null && offerRemaining <= 0;
  const pickupRoute = firstOffer?.pickup_route;
  const offerDistance = pickupRoute?.distance_km ?? firstOffer?.offer_km ?? null;
  const offerDuration = pickupRoute?.duration_min ?? null;

  useEffect(() => {
    if (!firstOffer?.offer_expires_at) return;
    const expires = Date.parse(firstOffer.offer_expires_at);
    if (!Number.isFinite(expires)) return;
    const delay = Math.min(30000, Math.max(500, expires - Date.now() + 500));
    const timer = setTimeout(() => { void poll(); }, delay);
    return () => clearTimeout(timer);
  }, [firstOffer?.trip_id, firstOffer?.offer_expires_at, poll]);

  const mapPickup = current ? { lat: current.pickup_lat, lng: current.pickup_lng } : null;
  const mapDropoff = current && current.status === 'in_trip'
    ? { lat: current.dropoff_lat, lng: current.dropoff_lng }
    : (current ? { lat: current.pickup_lat, lng: current.pickup_lng } : null);
  const mapRoute = current?.geometry?.coordinates;

  const gpsLabel = !online ? 'GPS pauset' : loc ? 'GPS aktiv' : 'Finner GPS…';
  const operationalLabel = current
    ? 'Aktiv tur'
    : pending.length > 0
      ? `${pending.length} ${pending.length === 1 ? 'forespørsel' : 'forespørsler'}`
      : online ? 'Klar for tur' : 'Ikke på skift';

  return (
    <View style={{ flex: 1, backgroundColor: colors.driverBg }}>
      <Map
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        user={!current ? loc : null}
        pickup={current ? mapPickup : null}
        dropoff={current ? mapDropoff : null}
        route={current ? mapRoute : null}
        activeCar={current && loc ? loc : null}
        testID="driver-map"
      />

      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={s.identityPanel}>
          <Text style={s.productLabel}>KJAPP DRIVER</Text>
          <Text style={s.driverName} numberOfLines={1}>{user?.fullName?.split(' ')[0] || 'Sjåfør'}</Text>
        </View>
        <Pressable
          style={[s.onlineControl, online && s.onlineControlOn]}
          onPress={toggleOnline}
          disabled={busy}
          testID="driver-online-toggle"
          accessibilityRole="switch"
          accessibilityState={{ checked: online, disabled: busy }}
          accessibilityLabel={online ? 'Gå offline' : 'Gå online'}
        >
          {busy ? (
            <ActivityIndicator color={online ? colors.online : colors.text} />
          ) : (
            <>
              <View style={[s.statusDot, { backgroundColor: online ? colors.online : colors.textMuted }]} />
              <Text style={[s.onlineText, online && { color: colors.online }]}>{online ? 'ONLINE' : 'OFFLINE'}</Text>
            </>
          )}
        </Pressable>
      </View>

      <View style={[s.mapStatus, { top: insets.top + 66, pointerEvents: 'none' }]}>
        <View style={s.mapStatusItem}>
          <Icon name="crosshair" size={14} color={online && loc ? colors.online : colors.textMuted} />
          <Text style={s.mapStatusText}>{gpsLabel}</Text>
        </View>
        <View style={s.mapStatusDivider} />
        <Text style={s.mapStatusText}>{operationalLabel}</Text>
      </View>

      <View style={[s.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={s.handle} />
        {error ? <Text style={s.error} testID="driver-error">{error}</Text> : null}

        {current ? (
          <View testID="driver-active-trip">
            <View style={s.sectionHeading}>
              <Text style={s.overlineOnline}>AKTIV TUR</Text>
              <Text style={s.tripPrice}>{kr(current.price)}</Text>
            </View>
            <View style={[s.epRow, { marginTop: 12 }]}>
              <View style={s.beacon} />
              <Text style={s.epText} numberOfLines={1}>{current.pickup_address}</Text>
            </View>
            <View style={s.epLine} />
            <View style={s.epRow}>
              <View style={s.square} />
              <Text style={s.epText} numberOfLines={1}>{current.dropoff_address}</Text>
            </View>
            {tripExtras(current) ? <Text style={s.offerMeta} testID="driver-active-trip-extras">{tripExtras(current)}</Text> : null}
            {current.passenger_note ? <Text style={s.offerMeta} numberOfLines={2}>Notat: {current.passenger_note}</Text> : null}
            {['driver_on_way', 'in_trip'].includes(current.status) ? (
              <Pressable style={s.navBtn} onPress={openNavigation} testID="driver-navigation">
                <Icon name="navigation" size={17} color={colors.online} />
                <Text style={s.navBtnText}>
                  {current.status === 'driver_on_way' ? 'Naviger til henting' : 'Naviger til destinasjon'}
                </Text>
              </Pressable>
            ) : null}
            <View style={s.tripActions}>
              <Pressable style={s.msgBtn} onPress={() => setChatOpen(true)} testID="driver-chat">
                <Icon name="message" size={17} color={colors.text} />
                <Text style={s.msgBtnText}>Melding</Text>
              </Pressable>
              {actionLabel ? (
                <Pressable style={s.action} onPress={advance} disabled={busy} testID="driver-advance">
                  {busy ? <ActivityIndicator color="#03120B" /> : <Text style={s.actionText}>{actionLabel}</Text>}
                </Pressable>
              ) : null}
            </View>
            {current.status === 'at_pickup' ? (
              <Pressable style={s.noShowBtn} onPress={noShow} disabled={busy} testID="driver-no-show">
                <Icon name="clock" size={15} color={colors.textMuted} />
                <Text style={s.noShowText}>Kunden kom ikke · registrer no-show</Text>
              </Pressable>
            ) : null}
            <Pressable style={s.driverSafetyBtn} onPress={emergency} testID="driver-safety-112">
              <Icon name="shield" size={16} color={colors.danger} />
              <Text style={s.driverSafetyText}>Sikkerhet · Ring 112</Text>
            </Pressable>
          </View>
        ) : firstOffer && online ? (
          <View testID={`driver-offer-${firstOffer.trip_id}`}>
            <View style={s.sectionHeading}>
              <Text style={s.overlineOnline}>NY TUR</Text>
              <Text style={s.tripPrice}>{kr(firstOffer.price)}</Text>
            </View>
            <View style={[s.epRow, { marginTop: 12 }]}>
              <View style={s.beacon} />
              <Text style={s.epText} numberOfLines={1}>{firstOffer.pickup_address}</Text>
            </View>
            <View style={s.epLine} />
            <View style={s.epRow}>
              <View style={s.square} />
              <Text style={s.epText} numberOfLines={1}>{firstOffer.dropoff_address}</Text>
            </View>
            <Text style={s.offerMeta}>
              {offerDistance != null ? `${Number(offerDistance).toFixed(1)} km til henting` : 'Beregner avstand til henting'}
              {offerDuration != null ? ` · ${Math.max(1, Math.round(Number(offerDuration)))} min` : ''}
            </Text>
            <Text style={[s.offerCountdown, offerExpired && s.offerCountdownExpired]} testID="driver-offer-countdown">
              {offerRemaining != null
                ? (offerExpired ? 'Tilbudet sendes videre…' : `Sendes videre om ${offerRemaining} sek`)
                : 'Åpen for alle ledige sjåfører'}
            </Text>
            {tripExtras(firstOffer) ? <Text style={s.offerMeta} testID="driver-offer-extras">{tripExtras(firstOffer)}</Text> : null}
            {firstOffer.passenger_note ? <Text style={s.offerMeta} numberOfLines={2}>Notat: {firstOffer.passenger_note}</Text> : null}
            <View style={s.offerBtns}>
              <Pressable style={s.declineBtn} onPress={() => decline(firstOffer.trip_id)} testID={`driver-decline-${firstOffer.trip_id}`}>
                <Text style={s.declineText}>Avslå</Text>
              </Pressable>
              <Pressable
                style={[s.acceptBtn, offerExpired && s.acceptBtnDisabled]}
                onPress={() => accept(firstOffer.trip_id)}
                disabled={busy || offerExpired}
                testID={`driver-accept-${firstOffer.trip_id}`}
              >
                {busy ? <ActivityIndicator color="#03120B" /> : <Text style={s.acceptText}>{offerExpired ? 'Utløpt' : 'Godta tur'}</Text>}
              </Pressable>
            </View>
          </View>
        ) : (
          <View>
            <View style={s.summaryRow}>
              <Stat label="Turer" value={String(summary?.trips ?? 0)} s={s} />
              <View style={s.vDivider} />
              <Stat label="I dag" value={kr(summary?.trip_income ?? 0)} s={s} />
              <View style={s.vDivider} />
              <Stat label="Online" value={hoursLabel(summary?.online_minutes)} s={s} />
            </View>
            {online ? (
              <View style={s.waiting} testID="driver-waiting">
                <View style={s.waitIcon}>
                  <Icon name="navigation" size={21} color={colors.online} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.waitTitle}>Klar for neste tur</Text>
                  <Text style={s.waitSub}>{loc ? 'Posisjonen din deles med dispatch.' : 'Kobler til posisjon…'}</Text>
                </View>
              </View>
            ) : (
              <Pressable style={s.goOnline} onPress={toggleOnline} disabled={busy} testID="driver-go-online">
                {busy ? <ActivityIndicator color="#03120B" /> : (
                  <>
                    <Icon name="power" size={19} color="#03120B" />
                    <Text style={s.goOnlineText}>Gå online</Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        )}
      </View>

      {current ? (
        <ChatSheet
          tripId={current.trip_id}
          role="driver"
          visible={chatOpen}
          onClose={() => setChatOpen(false)}
          peerName="Kunde"
        />
      ) : null}
    </View>
  );
}

function Stat({ label, value, s }: any) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 8,
  },
  identityPanel: {
    minHeight: 48, justifyContent: 'center', backgroundColor: 'rgba(3,6,7,0.91)',
    borderRadius: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: c.line,
  },
  productLabel: { color: c.online, fontSize: 10, lineHeight: 13, letterSpacing: 1.6, fontWeight: '700' },
  driverName: { color: c.text, fontFamily: font.display, fontSize: 16, fontWeight: '650' as any, maxWidth: 140 },
  onlineControl: {
    minWidth: 108, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(3,6,7,0.91)', borderRadius: 14, borderWidth: 1, borderColor: c.line,
  },
  onlineControlOn: { borderColor: 'rgba(57,229,140,0.46)', backgroundColor: 'rgba(5,24,17,0.92)' },
  statusDot: { width: 9, height: 9, borderRadius: 5 },
  onlineText: { color: c.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  mapStatus: {
    position: 'absolute', left: 16, zIndex: 9, minHeight: 36,
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(3,6,7,0.88)',
    borderRadius: 12, borderWidth: 1, borderColor: c.line, paddingHorizontal: 11,
  },
  mapStatusItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mapStatusDivider: { width: 1, height: 16, backgroundColor: c.line, marginHorizontal: 9 },
  mapStatusText: { color: c.textSecondary, fontSize: 11, fontWeight: '600' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(6,12,15,0.98)',
    borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: c.line,
    paddingHorizontal: 18, paddingTop: 10,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.lineStrong, marginBottom: 14 },
  error: { color: c.danger, fontSize: 13, lineHeight: 18, marginBottom: 12 },
  summaryRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.025)',
    borderRadius: 14, borderWidth: 1, borderColor: c.line, paddingVertical: 14,
  },
  vDivider: { width: 1, height: 32, backgroundColor: c.line },
  statValue: { color: c.text, fontFamily: font.mono, fontSize: 17, fontWeight: '600' },
  statLabel: { color: c.textMuted, fontSize: 10.5, marginTop: 4 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  overlineOnline: { color: c.online, fontSize: 11, letterSpacing: 1.8, fontWeight: '800' },
  tripPrice: { color: c.text, fontFamily: font.mono, fontSize: 18, fontWeight: '700' },
  epRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 28 },
  epLine: { width: 1, height: 14, backgroundColor: c.lineStrong, marginLeft: 5, marginVertical: 2 },
  beacon: { width: 11, height: 11, borderRadius: 6, backgroundColor: c.online },
  square: { width: 11, height: 11, borderRadius: 2, backgroundColor: c.text },
  epText: { color: c.text, fontSize: 14, flex: 1 },
  navBtn: {
    minHeight: 50, marginTop: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(57,229,140,0.35)',
    backgroundColor: 'rgba(57,229,140,0.07)', flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center',
  },
  navBtnText: { color: c.text, fontSize: 14, fontWeight: '700' },
  tripActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  msgBtn: {
    minWidth: 112, height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: c.line,
  },
  msgBtnText: { color: c.text, fontSize: 14, fontWeight: '600' },
  noShowBtn: { minHeight: 44, marginTop: 9, borderRadius: 12, borderWidth: 1, borderColor: c.lineStrong, backgroundColor: c.cardSubtle, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  noShowText: { color: c.textSecondary, fontSize: 12, fontWeight: '600' },
  driverSafetyBtn: { height: 44, marginTop: 9, borderRadius: 12, borderWidth: 1, borderColor: c.danger, backgroundColor: c.dangerSoft, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  driverSafetyText: { color: c.text, fontSize: 12, fontWeight: '700' },
  action: { flex: 1, height: 56, borderRadius: 14, backgroundColor: c.online, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: '#03120B', fontSize: 16, fontWeight: '800' },
  offerMeta: { color: c.textMuted, fontSize: 12, marginTop: 10 },
  offerCountdown: { color: c.online, fontSize: 12, fontWeight: '700', marginTop: 8 },
  offerCountdownExpired: { color: c.textMuted },
  offerBtns: { flexDirection: 'row', gap: 10, marginTop: 14 },
  declineBtn: { flex: 1, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: c.lineStrong },
  declineText: { color: c.textSecondary, fontSize: 15, fontWeight: '600' },
  acceptBtn: { flex: 2, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: c.online },
  acceptBtnDisabled: { opacity: 0.45 },
  acceptText: { color: '#03120B', fontSize: 15, fontWeight: '800' },
  waiting: {
    flexDirection: 'row', alignItems: 'center', gap: 13, minHeight: 72, marginTop: 12,
    paddingHorizontal: 14, borderRadius: 14, backgroundColor: 'rgba(57,229,140,0.055)',
    borderWidth: 1, borderColor: 'rgba(57,229,140,0.16)',
  },
  waitIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.onlineSoft, alignItems: 'center', justifyContent: 'center' },
  waitTitle: { color: c.text, fontFamily: font.display, fontSize: 16, fontWeight: '650' as any },
  waitSub: { color: c.textMuted, fontSize: 12, marginTop: 3 },
  goOnline: {
    flexDirection: 'row', gap: 10, marginTop: 14, height: 56, borderRadius: 14,
    backgroundColor: c.online, alignItems: 'center', justifyContent: 'center',
  },
  goOnlineText: { color: '#03120B', fontSize: 16, fontWeight: '800' },
}));