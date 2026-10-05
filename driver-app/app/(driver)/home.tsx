import { SlideConfirm } from '@/src/components/SlideConfirm';
import { useHideTabBar } from '@/src/components/FloatingTabBar';
import { Text } from '@/src/components/Typography';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon } from '@/src/components/Icon';
import { Map } from '@/src/components/Map';
import { BrandBadge } from '@/src/components/BrandBadge';
import { ChatSheet } from '@/src/components/ChatSheet';
import { useAuth } from '@/src/context/AuthContext';
import { driverApi, safetyApi, settingsApi } from '@/src/lib/api';
import { apiError, kr } from '@/src/lib/format';
import { storage } from '@/src/utils/storage';
import { isNavigationApp, navigationStorageKey } from '@/src/lib/navigationPreference';
import { canAutoDismissFinishedTrip, finishedTripDismissalKey, finishedTripReceipt } from '@/src/lib/tripSummary';
import { notifyPendingTripFromForeground } from '@/src/lib/nativeRuntime';

type Loc = { lat: number; lng: number; heading?: number };

function hoursLabel(min?: number) {
  const m = min || 0;
  if (m >= 60) return `${Math.floor(m / 60)}t ${m % 60}m`;
  return `${m}m`;
}

type CriticalTripAction = 'at_pickup' | 'start' | 'arrive';
type QueuedTripAction = { trip_id: string; action: CriticalTripAction; queued_at: string };
const QUEUED_TRIP_ACTION_KEY = 'kjapp_driver_queued_trip_action_v1';
const MINIMIZED_TRIP_KEY = 'kjapp_driver_minimized_active_trip_v1';
const ACTIVE_STATUSES = new Set(['driver_on_way', 'at_pickup', 'in_trip']);
const FINISHED_STATUSES = new Set(['arrived', 'completed', 'rated']);

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
  const [completedTrip, setCompletedTrip] = useState<any>(null);
  const [tripMinimized, setTripMinimized] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [loc, setLoc] = useState<Loc | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [declineReasonsOpen, setDeclineReasonsOpen] = useState(false);
  const [offerClock, setOfferClock] = useState(Date.now());
  const watch = useRef<Location.LocationSubscription | null>(null);
  const gpsBlocked = useRef(false);
  const actionRetrying = useRef(false);
  const seenPendingTripIds = useRef<Set<string> | null>(null);
  const completedSummaryVisible = !current && !(pending[0] && online);
  useHideTabBar(Boolean((current && !tripMinimized) || (pending[0] && online) || (completedTrip && completedSummaryVisible)));

  const poll = useCallback(async () => {
    if (!user?.id) return;
    try {
      const cur = await driverApi.current();
      let normalized = cur?.trip || cur || null;
      if (normalized && FINISHED_STATUSES.has(normalized.status)) {
        const dismissed = await storage.getItem(finishedTripDismissalKey(user.id));
        setCompletedTrip(dismissed === finishedTripReceipt(normalized) ? null : normalized);
      } else if (normalized && ACTIVE_STATUSES.has(normalized.status)) {
        setCompletedTrip(null);
      }
      setCurrent(normalized && ACTIVE_STATUSES.has(normalized.status) ? normalized : null);

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
                  if (normalized && FINISHED_STATUSES.has(normalized.status)) {
                    const dismissed = await storage.getItem(finishedTripDismissalKey(user.id));
                    setCompletedTrip(dismissed === finishedTripReceipt(normalized) ? null : normalized);
                  }
                  setCurrent(normalized && ACTIVE_STATUSES.has(normalized.status) ? normalized : null);
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
      const nextPending = p?.trips || p?.pending || (Array.isArray(p) ? p : []);
      setPending(nextPending);

      const validOffers = (Array.isArray(nextPending) ? nextPending : [])
        .filter((offer: any) => !!offer?.trip_id);
      if (seenPendingTripIds.current === null) {
        // Initial hydration is silent: an offer already on screen must not beep again
        // just because the app mounted or resumed.
        seenPendingTripIds.current = new Set(validOffers.map((offer: any) => String(offer.trip_id)));
      } else {
        const unseen = validOffers.filter((offer: any) => !seenPendingTripIds.current!.has(String(offer.trip_id)));
        for (const offer of unseen) seenPendingTripIds.current.add(String(offer.trip_id));
        if (unseen[0]) void notifyPendingTripFromForeground(unseen[0]);
      }

      if (p?.gps_stale) {
        setError('GPS-posisjonen er for gammel. SNAR sender ikke nye turer før en fersk posisjon er registrert.');
      }
    } catch {
      // Preserve the last pending state on a transient network error. Seen IDs stay
      // in memory so a reconnect cannot replay the same alert every four seconds.
    }
    driverApi.summary().then((r) => {
      setSummary(r);
      if (typeof r?.online === 'boolean') {
        // Never let a stale server ONLINE value override a local GPS safety block.
        // The block is cleared only after a fresh foreground GPS fix succeeds.
        if (!gpsBlocked.current || r.online === false) setOnline(r.online);
      }
    }).catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    seenPendingTripIds.current = null;
  }, [user?.id]);

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
        : `${message} SNAR kunne ikke bekrefte OFFLINE-status mot serveren. Prøv igjen før du tar turer.`);
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
          await forceOffline('Posisjon må være aktiv for at SNAR skal kunne sende turer og dele korrekt henteposisjon.');
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
        'SNAR kontrollerer at du er nær destinasjonen før turen avsluttes og betaling kan starte.',
        [
          { text: 'Fortsett turen', style: 'cancel' },
          { text: 'Fullfør turen', onPress: () => { void execute(); } },
        ],
      );
      return;
    }

    await execute();
  };

  useEffect(() => {
    let active = true;
    if (!current?.trip_id) { setTripMinimized(false); return; }
    storage.getItem(MINIMIZED_TRIP_KEY).then((id) => {
      if (active) setTripMinimized(id === current.trip_id);
    }).catch(() => {});
    return () => { active = false; };
  }, [current?.trip_id]);

  useEffect(() => {
    if (!user?.id || !completedTrip?.trip_id || !canAutoDismissFinishedTrip(completedTrip, completedSummaryVisible)) return;
    const receipt = finishedTripReceipt(completedTrip);
    const timer = setTimeout(() => {
      void storage.setItem(finishedTripDismissalKey(user.id), receipt).catch(() => {});
      setCompletedTrip((trip: any) => trip && finishedTripReceipt(trip) === receipt ? null : trip);
    }, 8000);
    return () => clearTimeout(timer);
  }, [user?.id, completedTrip?.trip_id, completedTrip?.payment_status, completedSummaryVisible]);

  const noShow = async () => {
    if (!current || current.status !== 'at_pickup' || busy) return;
    Alert.alert(
      'Kunden kom ikke?',
      'No-show kan bare registreres etter ventetiden ved hentestedet. SNAR kontrollerer ankomsttid og GPS på serveren.',
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
    const cached = user?.id ? await storage.getItem(navigationStorageKey(user.id)).catch(() => null) : null;
    const serverChoice = isNavigationApp(cached) ? cached :
      await settingsApi.get().then((r: any) => (r?.settings || r)?.navigation_app).catch(() => null);
    const preferred = isNavigationApp(serverChoice) ? serverChoice : 'google';
    const native = validStops.length ? fallback
      : preferred === 'waze' ? `waze://?ll=${lat},${lng}&navigate=yes`
      : preferred === 'apple' && Platform.OS === 'ios' ? `maps://?daddr=${lat},${lng}&dirflg=d`
      : Platform.OS === 'android' ? `google.navigation:q=${lat},${lng}&mode=d`
      : `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`;

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
      {(online || current || firstOffer) ? (
        <Map
          style={StyleSheet.absoluteFill}
          user={!current ? loc : null}
          pickup={current ? mapPickup : (firstOffer ? { lat: firstOffer.pickup_lat, lng: firstOffer.pickup_lng } : null)}
          dropoff={current ? mapDropoff : (firstOffer ? { lat: firstOffer.dropoff_lat, lng: firstOffer.dropoff_lng } : null)}
          route={current ? mapRoute : firstOffer?.geometry?.coordinates}
          activeCar={current && loc ? loc : null}
          testID="driver-map"
        />
      ) : (
        <LinearGradient colors={['#FFFFFF', '#F2F5FA']} style={StyleSheet.absoluteFill} />
      )}

      <View style={[s.driverHeaderWrap, { top: insets.top + 12 }]}>
        <View style={s.driverHeader}>
          <View style={s.driverIdentity}>
            <BrandBadge size={34} />
            <View>
              <Text style={s.headerName} numberOfLines={1}>{user?.fullName || 'SNAR-sjåfør'}</Text>
              <Text style={[s.headerStatus, { color: online ? colors.online : colors.textMuted }]}>
                {online ? '● ONLINE' : 'OFFLINE'}
              </Text>
            </View>
          </View>
          <Pressable
            style={[s.switchTrack, online && s.switchTrackOn]}
            onPress={toggleOnline}
            disabled={busy || Boolean(current)}
            testID="driver-online-toggle"
            accessibilityRole="switch"
            accessibilityState={{ checked: online, disabled: busy || Boolean(current) }}
          >
            <View style={[s.switchKnob, online && s.switchKnobOn]} />
          </Pressable>
        </View>
      </View>

      {error ? <View style={[s.errorBanner, { top: insets.top + 76 }]}><Text style={s.errorText}>{error}</Text></View> : null}

      {current?.status === 'driver_on_way' ? (
        <>
          <View style={[s.navInstruction, { top: insets.top + 82 }]} testID="driver-topickup-instruction">
            <View style={s.navIcon}><Icon name="navigation" size={20} color={colors.accentOn} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.navTitle}>Kjør til hentested</Text>
              <Text style={s.navSub} numberOfLines={1}>{current.pickup_address}</Text>
            </View>
            <Pressable style={s.navOpen} onPress={openNavigation} testID="driver-navigation">
              <Text style={s.navOpenText}>ÅPNE</Text>
            </Pressable>
          </View>

          <View style={[s.stateSheet, { paddingBottom: insets.bottom + 32 }]} testID="driver-topickup-sheet">
            <View style={s.handle} />
            <Text style={s.stateEyebrow}>HENTING</Text>
            <Text style={s.stateTitle}>{current.customer?.name || 'Kunde'}</Text>
            <Text style={s.stateAddress}>{current.pickup_address}</Text>
            {tripExtras(current) ? <Text style={s.stateMeta}>{tripExtras(current)}</Text> : null}
            {current.passenger_note ? <Text style={s.stateMeta}>Notat: {current.passenger_note}</Text> : null}

            <View style={s.contactGrid}>
              <Pressable style={s.contactAction} onPress={() => current.customer?.phone && Linking.openURL(`tel:${current.customer.phone}`).catch(() => setError('Kunne ikke ringe kunden.'))} disabled={!current.customer?.phone} testID="driver-call-customer">
                <Icon name="phone" size={19} color={colors.accent} />
                <Text style={s.contactActionText}>Ring</Text>
              </Pressable>
              <Pressable style={s.contactAction} onPress={() => setChatOpen(true)} testID="driver-chat">
                <Icon name="message" size={19} color={colors.accent} />
                <Text style={s.contactActionText}>Melding</Text>
              </Pressable>
            </View>

            <SlideConfirm key={`${current.trip_id}-${current.status}`} label="Skyv når du er fremme" onConfirm={advance} onError={error => setError(apiError(error))} disabled={busy} testID="driver-advance" />
          </View>
        </>
      ) : current?.status === 'at_pickup' ? (
        <View style={[s.stateSheet, { paddingBottom: insets.bottom + 32 }]} testID="driver-pickup-confirm">
          <View style={s.handle} />
          <Text style={s.stateEyebrow}>BEKREFT PASSASJER</Text>
          <Text style={s.stateTitle}>{current.customer?.name || 'Kunde'}</Text>
          <View style={s.destinationCard}>
            <Text style={s.destinationLabel}>DESTINASJON</Text>
            <Text style={s.destinationValue}>{current.dropoff_address}</Text>
          </View>
          {tripExtras(current) ? <Text style={s.stateMeta}>{tripExtras(current)}</Text> : null}
          <SlideConfirm key={`${current.trip_id}-${current.status}`} label="Start tur" onConfirm={advance} onError={error => setError(apiError(error))} disabled={busy} testID="driver-advance" />
          <Pressable style={s.noShowLink} onPress={noShow} disabled={busy} testID="driver-no-show">
            <Text style={s.noShowLinkText}>Kunden kom ikke?</Text>
          </Pressable>
        </View>
      ) : current?.status === 'in_trip' ? (
        <>
          <View style={[s.navInstruction, { top: insets.top + 82 }]} testID="driver-intrip-instruction">
            <View style={s.navIcon}><Icon name="navigation" size={20} color={colors.accentOn} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.navTitle}>Til destinasjon</Text>
              <Text style={s.navSub} numberOfLines={1}>{current.dropoff_address}</Text>
            </View>
            <Pressable style={s.navOpen} onPress={openNavigation} testID="driver-navigation">
              <Text style={s.navOpenText}>ÅPNE</Text>
            </Pressable>
          </View>

          <View style={[s.stateSheet, { paddingBottom: insets.bottom + 32 }]} testID="driver-intrip-sheet">
            <View style={s.handle} />
            <View style={s.inTripControls}>
              <Pressable style={s.tripTool} onPress={() => setChatOpen(true)} testID="driver-chat">
                <Icon name="message" size={20} color={colors.accent} />
                <Text style={s.tripToolText}>Melding</Text>
              </Pressable>
              <Pressable style={s.tripTool} onPress={openNavigation}>
                <Icon name="navigation" size={20} color={colors.accent} />
                <Text style={s.tripToolText}>Navigasjon</Text>
              </Pressable>
              <Pressable style={s.sosTool} onPress={emergency} testID="driver-safety-112">
                <Icon name="shield" size={20} color={colors.accentOn} />
                <Text style={s.sosToolText}>SOS</Text>
              </Pressable>
            </View>
            <SlideConfirm key={`${current.trip_id}-${current.status}`} label="Avslutt tur" onConfirm={advance} onError={error => setError(apiError(error))} disabled={busy} testID="driver-advance" />
          </View>
        </>
      ) : firstOffer && online ? (
        <>
          <View style={s.mapDim} pointerEvents="none" />
          <View style={[s.offerSheet, { paddingBottom: insets.bottom + 32 }]} testID={`driver-offer-${firstOffer.trip_id}`}>
            <View style={s.handle} />
            <View style={s.offerHead}>
              <View>
                <Text style={s.offerEyebrow}>NY TUR</Text>
                <Text style={s.offerCustomer}>{firstOffer.customer?.name || 'Kunde'}</Text>
              </View>
              <View style={s.offerCountdownCircle}>
                <Text style={[s.offerCountdownNum, offerExpired && { color: colors.textMuted }]}>
                  {offerRemaining != null ? offerRemaining : '—'}
                </Text>
                <Text style={s.offerCountdownUnit}>SEK</Text>
              </View>
            </View>
            <View style={s.offerPriceRow}>
              <Text style={s.offerPrice}>{kr(firstOffer.price)}</Text>
              <Text style={s.offerRouteMeta}>
                {offerDistance != null ? `${Number(offerDistance).toFixed(1)} km til henting` : 'Beregner avstand'}
                {offerDuration != null ? ` · ${Math.max(1, Math.round(Number(offerDuration)))} min` : ''}
              </Text>
            </View>
            <View style={s.routeBox}>
              <View style={s.routePointRow}><View style={[s.routeDot, { backgroundColor: colors.online }]} /><Text style={s.routePointText} numberOfLines={1}>{firstOffer.pickup_address}</Text></View>
              <View style={s.routeLine} />
              <View style={s.routePointRow}><View style={[s.routeDot, { backgroundColor: colors.accent }]} /><Text style={s.routePointText} numberOfLines={1}>{firstOffer.dropoff_address}</Text></View>
            </View>
            {tripExtras(firstOffer) ? <Text style={s.stateMeta}>{tripExtras(firstOffer)}</Text> : null}
            {firstOffer.passenger_note ? <Text style={s.stateMeta}>Notat: {firstOffer.passenger_note}</Text> : null}
            <View style={s.offerButtons}>
              <Pressable style={s.declineButton} onPress={() => setDeclineReasonsOpen(true)} testID={`driver-decline-${firstOffer.trip_id}`}>
                <Text style={s.declineButtonText}>Avslå</Text>
              </Pressable>
              <Pressable style={[s.acceptButton, offerExpired && s.acceptButtonDisabled]} onPress={() => accept(firstOffer.trip_id)} disabled={busy || offerExpired} testID={`driver-accept-${firstOffer.trip_id}`}>
                {busy ? <ActivityIndicator color={colors.accentOn} /> : <Text style={s.acceptButtonText}>{offerExpired ? 'Utløpt' : 'Godta tur'}</Text>}
              </Pressable>
            </View>
          </View>
        </>
      ) : completedTrip ? (
        <LinearGradient colors={['#FFFFFF', '#F2F5FA']} style={[StyleSheet.absoluteFill, s.completeWrap]}>
          <View style={[s.completeContent, { paddingTop: insets.top + 112, paddingBottom: insets.bottom + 26 }]}>
            <Text style={s.completeEyebrow}>TUR FULLFØRT</Text>
            <Text style={s.completeAmount}>
              {completedTrip.payment_status === 'paid' ? `+${kr(completedTrip.driver_earnings)}` : 'Betaling avventer'}
            </Text>
            <View style={s.completeCard}>
              <View style={s.completeRow}><Text style={s.completeLabel}>Distanse</Text><Text style={s.completeValue}>{completedTrip.distance_km ?? '—'} km</Text></View>
              <View style={s.completeRow}><Text style={s.completeLabel}>Tid</Text><Text style={s.completeValue}>{completedTrip.duration_min ?? '—'} min</Text></View>
              <View style={s.completeRow}><Text style={s.completeLabel}>Status</Text><Text style={s.completeValue}>{completedTrip.payment_status === 'paid' ? 'Betalt' : 'Avventer'}</Text></View>
            </View>
            <View style={s.completeButtons}>
              <Pressable style={s.pauseButton} onPress={async () => {
                if (user?.id) await storage.setItem(finishedTripDismissalKey(user.id), finishedTripReceipt(completedTrip));
                setCompletedTrip(null);
                if (online) await toggleOnline();
              }}>
                <Text style={s.pauseButtonText}>Ta pause</Text>
              </Pressable>
              <Pressable style={s.continueButton} onPress={async () => {
                if (user?.id) await storage.setItem(finishedTripDismissalKey(user.id), finishedTripReceipt(completedTrip));
                setCompletedTrip(null);
                if (!online) await toggleOnline();
              }}>
                <Text style={s.continueButtonText}>Fortsett online</Text>
              </Pressable>
            </View>
          </View>
        </LinearGradient>
      ) : online ? (
        <View style={[s.waitingSheet, { paddingBottom: insets.bottom + 32 }]} testID="driver-waiting">
          <View style={s.handle} />
          <View style={s.waitingInner}>
            <View style={s.waitingIcon}><Icon name="navigation" size={20} color={colors.online} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.waitingTitle}>Klar for neste tur</Text>
              <Text style={s.waitingSub}>{loc ? 'Posisjonen din deles med dispatch.' : 'Finner GPS…'}</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={[s.offlineContent, { paddingTop: insets.top + 112, paddingBottom: insets.bottom + 26 }]}>
          <Text style={s.offlineEyebrow}>INNTJENING I DAG</Text>
          <Text style={s.offlineAmount}>{kr(summary?.trip_income ?? 0)}</Text>
          <View style={s.summaryCards}>
            <View style={s.summaryCard}><Text style={s.summaryValue}>{String(summary?.trips ?? 0)}</Text><Text style={s.summaryLabel}>Turer</Text></View>
            <View style={s.summaryCard}><Text style={s.summaryValue}>{hoursLabel(summary?.online_minutes)}</Text><Text style={s.summaryLabel}>Online</Text></View>
          </View>
          <Pressable style={s.goOnlineButton} onPress={toggleOnline} disabled={busy} testID="driver-go-online">
            {busy ? <ActivityIndicator color={colors.accentOn} /> : <Text style={s.goOnlineButtonText}>Gå online</Text>}
          </Pressable>
        </View>
      )}

      {declineReasonsOpen && firstOffer ? (
        <View style={s.declineOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDeclineReasonsOpen(false)} />
          <View style={[s.declineSheet, { paddingBottom: insets.bottom + 32 }]}>
            <View style={s.declineHead}><Text style={s.declineTitle}>Hvorfor avslår du?</Text><Pressable style={s.closeReason} onPress={() => setDeclineReasonsOpen(false)}><Icon name="x" size={18} color={colors.text} /></Pressable></View>
            {['For langt å kjøre', 'Ikke egnet bil', 'Skal snart av vakt', 'Annet'].map((reason) => (
              <Pressable key={reason} style={s.reasonRow} onPress={async () => { setDeclineReasonsOpen(false); await decline(firstOffer.trip_id); }}>
                <Text style={s.reasonText}>{reason}</Text><Icon name="chevron-right" size={17} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {current ? (
        <ChatSheet
          tripId={current.trip_id}
          role="driver"
          visible={chatOpen}
          onClose={() => setChatOpen(false)}
          peerName={current.customer?.name || 'Kunde'}
        />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
    driverHeaderWrap: { position: 'absolute', left: 16, right: 16, zIndex: 50 },
    driverHeader: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 16, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.96)', borderWidth: 1, borderColor: c.line, shadowColor: '#0B0E14', shadowOpacity: 0.10, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
    driverIdentity: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    headerName: { color: c.text, fontFamily: font.semibold, fontSize: 14, maxWidth: 180 },
    headerStatus: { fontFamily: font.mono, fontSize: 9, letterSpacing: 1.4, marginTop: 2 },
    switchTrack: { width: 56, height: 32, borderRadius: 16, backgroundColor: c.lineStrong, padding: 2 },
    switchTrackOn: { backgroundColor: c.online },
    switchKnob: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.surface },
    switchKnobOn: { marginLeft: 24 },
    errorBanner: { position: 'absolute', left: 16, right: 16, zIndex: 55, borderRadius: 12, padding: 10, backgroundColor: c.dangerSoft, borderWidth: 1, borderColor: c.danger },
    errorText: { color: c.danger, fontSize: 12, textAlign: 'center' },
    navInstruction: { position: 'absolute', left: 16, right: 16, zIndex: 30, minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.96)', borderWidth: 1, borderColor: c.line, shadowColor: '#0B0E14', shadowOpacity: 0.10, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
    navIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent },
    navTitle: { color: c.text, fontFamily: font.semibold, fontSize: 15 },
    navSub: { color: c.textSecondary, fontSize: 11, marginTop: 2 },
    navOpen: { minHeight: 36, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
    navOpenText: { color: c.accent, fontFamily: font.mono, fontSize: 9, letterSpacing: 1.2 },
    stateSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 30, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 24, paddingTop: 20, backgroundColor: 'rgba(255,255,255,0.98)', borderTopWidth: 1, borderTopColor: c.line, shadowColor: '#0B0E14', shadowOpacity: 0.12, shadowRadius: 25, shadowOffset: { width: 0, height: -10 }, elevation: 9 },
    handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.lineStrong, marginBottom: 16 },
    stateEyebrow: { color: c.online, fontFamily: font.mono, fontSize: 10, letterSpacing: 1.6 },
    stateTitle: { color: c.text, fontFamily: font.semibold, fontSize: 21, marginTop: 4 },
    stateAddress: { color: c.textSecondary, fontSize: 13, marginTop: 3 },
    stateMeta: { color: c.textMuted, fontSize: 11.5, lineHeight: 17, marginTop: 8 },
    contactGrid: { flexDirection: 'row', gap: 10, marginTop: 15 },
    contactAction: { flex: 1, minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.lineStrong },
    contactActionText: { color: c.text, fontFamily: font.medium, fontSize: 13 },
    noShowLink: { minHeight: 38, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
    noShowLinkText: { color: c.textMuted, fontSize: 12, textDecorationLine: 'underline' },
    destinationCard: { marginTop: 14, borderRadius: 16, padding: 14, backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line },
    destinationLabel: { color: c.textMuted, fontFamily: font.mono, fontSize: 9, letterSpacing: 1.4 },
    destinationValue: { color: c.text, fontFamily: font.medium, fontSize: 14, marginTop: 5 },
    inTripControls: { flexDirection: 'row', gap: 10 },
    tripTool: { flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.lineStrong },
    tripToolText: { color: c.text, fontFamily: font.medium, fontSize: 11.5 },
    sosTool: { flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 16, backgroundColor: '#E11D48' },
    sosToolText: { color: c.accentOn, fontFamily: font.bold, fontSize: 11.5 },
    mapDim: { ...StyleSheet.absoluteFill, zIndex: 20, backgroundColor: 'rgba(11,14,20,0.28)' },
    offerSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 40, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 24, paddingTop: 20, backgroundColor: c.surface, shadowColor: '#0B0E14', shadowOpacity: 0.26, shadowRadius: 28, shadowOffset: { width: 0, height: -12 }, elevation: 12 },
    offerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    offerEyebrow: { color: c.accent, fontFamily: font.mono, fontSize: 10, letterSpacing: 1.6 },
    offerCustomer: { color: c.text, fontFamily: font.semibold, fontSize: 21, marginTop: 3 },
    offerCountdownCircle: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.accent, backgroundColor: c.accentSoft },
    offerCountdownNum: { color: c.accent, fontFamily: font.bold, fontSize: 20, lineHeight: 21 },
    offerCountdownUnit: { color: c.textMuted, fontFamily: font.mono, fontSize: 7, letterSpacing: 1.2 },
    offerPriceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 14 },
    offerPrice: { color: c.text, fontFamily: font.semibold, fontSize: 25 },
    offerRouteMeta: { color: c.textSecondary, fontSize: 11 },
    routeBox: { marginTop: 13, borderRadius: 16, padding: 14, backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line },
    routePointRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    routeDot: { width: 10, height: 10, borderRadius: 5 },
    routeLine: { width: 1, height: 17, backgroundColor: c.lineStrong, marginLeft: 4.5 },
    routePointText: { flex: 1, color: c.text, fontSize: 13 },
    offerButtons: { flexDirection: 'row', gap: 10, marginTop: 16 },
    declineButton: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 28, borderWidth: 1, borderColor: c.lineStrong, backgroundColor: c.surface },
    declineButtonText: { color: c.textSecondary, fontFamily: font.semibold, fontSize: 14 },
    acceptButton: { flex: 2, minHeight: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 28, backgroundColor: c.online },
    acceptButtonDisabled: { opacity: 0.45 },
    acceptButtonText: { color: c.accentOn, fontFamily: font.bold, fontSize: 14 },
    waitingSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 30, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 24, paddingTop: 20, backgroundColor: 'rgba(255,255,255,0.98)', borderTopWidth: 1, borderTopColor: c.line, shadowColor: '#0B0E14', shadowOpacity: 0.12, shadowRadius: 25, shadowOffset: { width: 0, height: -10 }, elevation: 9 },
    waitingInner: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 13 },
    waitingIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: c.onlineSoft },
    waitingTitle: { color: c.text, fontFamily: font.semibold, fontSize: 16 },
    waitingSub: { color: c.textSecondary, fontSize: 12, marginTop: 3 },
    offlineContent: { flex: 1, paddingHorizontal: 28 },
    offlineEyebrow: { color: c.textMuted, fontFamily: font.mono, fontSize: 10, letterSpacing: 1.6 },
    offlineAmount: { color: c.text, fontFamily: font.semibold, fontSize: 36, lineHeight: 40, marginTop: 4 },
    summaryCards: { flexDirection: 'row', gap: 12, marginTop: 20 },
    summaryCard: { flex: 1, minHeight: 96, borderRadius: 18, padding: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line },
    summaryValue: { color: c.text, fontFamily: font.semibold, fontSize: 24, lineHeight: 32 },
    summaryLabel: { color: c.textMuted, fontSize: 11, marginTop: 7 },
    goOnlineButton: { minHeight: 56, marginTop: 'auto', borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent, shadowColor: c.accent, shadowOpacity: 0.30, shadowRadius: 15, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
    goOnlineButtonText: { color: c.accentOn, fontFamily: font.bold, fontSize: 15 },
    completeWrap: { zIndex: 25 },
    completeContent: { flex: 1, paddingHorizontal: 28 },
    completeEyebrow: { color: c.online, fontFamily: font.mono, fontSize: 10, letterSpacing: 1.6 },
    completeAmount: { color: c.text, fontFamily: font.semibold, fontSize: 34, marginTop: 4 },
    completeCard: { marginTop: 20, borderRadius: 24, padding: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line },
    completeRow: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    completeLabel: { color: c.textSecondary, fontSize: 13 },
    completeValue: { color: c.text, fontFamily: font.medium, fontSize: 13 },
    completeButtons: { flexDirection: 'row', gap: 10, marginTop: 'auto' },
    pauseButton: { flex: 1, minHeight: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.lineStrong },
    pauseButtonText: { color: c.text, fontFamily: font.medium, fontSize: 13 },
    continueButton: { flex: 1.6, minHeight: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent, shadowColor: c.accent, shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
    continueButtonText: { color: c.accentOn, fontFamily: font.bold, fontSize: 13 },
    declineOverlay: { ...StyleSheet.absoluteFill, zIndex: 80, justifyContent: 'flex-end', backgroundColor: 'rgba(11,14,20,0.35)' },
    declineSheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 24, paddingTop: 20, backgroundColor: c.surface },
    declineHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    declineTitle: { color: c.text, fontFamily: font.semibold, fontSize: 20 },
    closeReason: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cardSubtle },
    reasonRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: c.line },
    reasonText: { color: c.text, fontFamily: font.medium, fontSize: 14 }
}));



