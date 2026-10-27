import { BlurTargetView } from 'expo-blur';
import { useTripUpdates } from '@/src/lib/useTripUpdates';
import { DriverCockpitView } from '@/src/components/DriverCockpitView';
import { useHideTabBar } from '@/src/components/FloatingTabBar';
import { Text } from '@/src/components/Typography';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, font, makeStyles, useColorTheme } from '@/src/theme';
import { Icon } from '@/src/components/Icon';
import { Map } from '@/src/components/Map';
import { BrandBadge } from '@/src/components/BrandBadge';
import { useAuth } from '@/src/context/AuthContext';
import { driverApi, safetyApi, settingsApi } from '@/src/lib/api';
import { apiError, kr } from '@/src/lib/format';
import { storage } from '@/src/utils/storage';
import { isNavigationApp, navigationStorageKey } from '@/src/lib/navigationPreference';
import { canAutoDismissFinishedTrip, finishedTripDismissalKey, finishedTripReceipt } from '@/src/lib/tripSummary';
import { notifyPendingTripFromForeground } from '@/src/lib/nativeRuntime';
import { projectedOfferTime } from '@/src/lib/offerClock';

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
  useColorTheme();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { user } = useAuth();
  const router = useRouter();
  const [online, setOnline] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const readiness = useQuery({ queryKey: ['driver-readiness', user?.id], queryFn: driverApi.compliance,
    enabled: !!user?.id, refetchInterval: 10000, refetchIntervalInBackground: false, retry: 1 });
  const [pending, setPending] = useState<any[]>([]);
  const [current, setCurrent] = useState<any>(null);
  const [completedTrip, setCompletedTrip] = useState<any>(null);
  const [tripMinimized, setTripMinimized] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [loc, setLoc] = useState<Loc | null>(null);
  const [busy, setBusy] = useState(false);
  const shiftActionLock = useRef(false);
  const [summaryActionBusy, setSummaryActionBusy] = useState(false);
  const summaryActionLock = useRef(false);
  const [error, setError] = useState('');
  const [declineReasonsOpen, setDeclineReasonsOpen] = useState(false);
  const [offerClock, setOfferClock] = useState<number | null>(null);
  const offerTimeSync = useRef<{ serverTime?: string; receivedAt: number }>({ receivedAt: 0 });
  const watch = useRef<Location.LocationSubscription | null>(null);
  const gpsBlocked = useRef(false);
  const actionRetrying = useRef(false);
  const offerActionLock = useRef(false);
  const seenPendingTripIds = useRef<Set<string> | null>(null);
  const completedSummaryVisible = !current && !(pending[0] && online);
  useHideTabBar(Boolean(busy || summaryActionBusy || (current && !tripMinimized) || (pending[0] && online) || (completedTrip && completedSummaryVisible)));

  const polling = useRef(false);
  const poll = useCallback(async () => {
    if (!user?.id || polling.current) return;
    polling.current = true;
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
      offerTimeSync.current = { serverTime: p?.server_time, receivedAt: performance.now() };
      setOfferClock(projectedOfferTime(p?.server_time, offerTimeSync.current.receivedAt, performance.now()));
      setBackendConnected(true);
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
      setBackendConnected(false);
    }
    polling.current = false;
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

  useTripUpdates(current?.trip_id, () => void poll());

  useFocusEffect(
    useCallback(() => {
      poll();
      const i = setInterval(poll, 1000);
      return () => clearInterval(i);
    }, [poll]),
  );

  useEffect(() => {
    const i = setInterval(() => setOfferClock(projectedOfferTime(offerTimeSync.current.serverTime, offerTimeSync.current.receivedAt, performance.now())), 500);
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
            distanceInterval: 0,
            timeInterval: 1000,
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
    if (shiftActionLock.current || busy || current) return;
    shiftActionLock.current = true;
    const next = !online;
    setError('');
    setBusy(true);
    try {
      if (next) {
        // Resolve a real device position before asking the backend to claim the
        // driver/vehicle. The server rejects an ONLINE request without a fresh
        // authenticated GPS sample, so the switch can never become green only
        // from local state.
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) throw new Error('Slå på stedstjenester/GPS før du går online.');
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          throw new Error(permission.canAskAgain
            ? 'SNAR trenger posisjonstilgang for å gå online.'
            : 'Posisjonstilgang er blokkert. Åpne Innstillinger og tillat posisjon for SNAR Driver.');
        }
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const { latitude, longitude, heading, speed } = position.coords;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
            latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
          throw new Error('SNAR fikk ikke en gyldig GPS-posisjon. Prøv igjen.');
        }
        const nextLocation: Loc = { lat: latitude, lng: longitude, heading: heading || 0 };
        const recordedAt = new Date(position.timestamp).toISOString();
        let locationResult = await driverApi.location(
          latitude,
          longitude,
          heading || 0,
          Math.max(0, speed || 0),
          recordedAt,
        );
        // A background/foreground sample may already be in flight. Retry once
        // after that bounded request finishes instead of racing /driver/online.
        if (locationResult?.skipped) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          locationResult = await driverApi.location(
            latitude,
            longitude,
            heading || 0,
            Math.max(0, speed || 0),
            recordedAt,
          );
        }
        if (locationResult?.skipped) throw new Error('GPS-posisjonen behandles fortsatt. Prøv igjen om litt.');
        setLoc(nextLocation);

        const compliance = await driverApi.compliance();
        void readiness.refetch();
        if (compliance?.operational !== true) {
          throw new Error(compliance?.message || 'Sjåførkontoen eller bilen er ikke klar for å gå online.');
        }
      }
      const response = await driverApi.online(next);
      if (response?.online !== next) throw new Error('Vaktstatus ble ikke bekreftet av serveren. Prøv igjen.');
      const canonical = await driverApi.summary();
      if (canonical?.online !== next) throw new Error('Serveren bekreftet ikke riktig vaktstatus. Prøv igjen.');
      setSummary(canonical);
      gpsBlocked.current = false;
      setOnline(next);
      if (next) poll();
    } catch (e) { setError(apiError(e)); }
    finally { shiftActionLock.current = false; setBusy(false); }
  };

  const accept = async (tripId: string) => {
    if (offerActionLock.current || busy) return;
    offerActionLock.current = true;
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
      offerActionLock.current = false;
      setBusy(false);
    }
  };

  const decline = async (tripId: string) => {
    if (offerActionLock.current || busy) return;
    offerActionLock.current = true; setBusy(true);
    try { await driverApi.decline(tripId); setPending((p) => p.filter((t) => t.trip_id !== tripId)); }
    catch (e) { setError(apiError(e)); }
    finally { offerActionLock.current = false; setBusy(false); }
  };

  const cancelCurrentTrip = () => {
    if (!current || busy) return;
    const tripId = current.trip_id;
    Alert.alert('Avbryte turen?', 'Turen avbrytes for både deg og kunden. Den blir ikke registrert som fullført.', [
      { text: 'Behold tur', style: 'cancel' },
      { text: 'Avbryt tur', style: 'destructive', onPress: async () => {
        setBusy(true); setError('');
        try {
          await driverApi.cancel(tripId);
          await storage.removeItem(QUEUED_TRIP_ACTION_KEY);
          await poll();
        } catch (e) {
          // Canonical polling recovers a committed cancellation with a lost response.
          try {
            const confirmed = await driverApi.current();
            if (!confirmed || confirmed.trip_id !== tripId || ['cancelled', 'cancelled_by_driver'].includes(confirmed.status)) {
              await storage.removeItem(QUEUED_TRIP_ACTION_KEY);
              await poll(); return;
            }
          } catch {}
          setError(apiError(e));
        } finally { setBusy(false); }
      } },
    ]);
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

  const mapTarget = useRef<View | null>(null);
  const firstOffer = pending[0];
  const offerExpiresMs = firstOffer?.offer_expires_at ? Date.parse(firstOffer.offer_expires_at) : NaN;
  const offerRemaining = Number.isFinite(offerExpiresMs) && offerClock !== null
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
    const serverNow = projectedOfferTime(offerTimeSync.current.serverTime, offerTimeSync.current.receivedAt, performance.now());
    if (serverNow === null) return;
    const delay = Math.min(30000, Math.max(500, expires - serverNow + 500));
    const timer = setTimeout(() => { void poll(); }, delay);
    return () => clearTimeout(timer);
  }, [firstOffer?.trip_id, firstOffer?.offer_expires_at, poll]);

  const mapPickup = current ? { lat: current.pickup_lat, lng: current.pickup_lng } : null;
  const mapDropoff = current?.status === 'in_trip' ? { lat: current.dropoff_lat, lng: current.dropoff_lng } : null;
  const mapRoute = current?.status === 'driver_on_way'
    ? current.pickup_route?.geometry?.coordinates || null
    : current?.status === 'in_trip' ? current.geometry?.coordinates || null : null;

  const finishSummary = async (continueOnline: boolean) => {
    if (!completedTrip || summaryActionLock.current) return;
    summaryActionLock.current = true; setSummaryActionBusy(true);
    try {
      if (user?.id) await storage.setItem(finishedTripDismissalKey(user.id), finishedTripReceipt(completedTrip));
      setCompletedTrip(null);
      if (online !== continueOnline) await toggleOnline();
    } catch { setError('Kunne ikke lagre tursammendraget. Prøv igjen.'); }
    finally { summaryActionLock.current = false; setSummaryActionBusy(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.driverBg }}>
      <BlurTargetView ref={mapTarget} style={StyleSheet.absoluteFill}><Map
        style={StyleSheet.absoluteFill}
        user={!current ? loc : null}
        pickup={current ? mapPickup : (firstOffer ? { lat: firstOffer.pickup_lat, lng: firstOffer.pickup_lng } : null)}
        dropoff={current ? mapDropoff : (firstOffer ? { lat: firstOffer.dropoff_lat, lng: firstOffer.dropoff_lng } : null)}
        route={current ? mapRoute : firstOffer?.geometry?.coordinates}
        activeCar={current && loc ? loc : null}
        testID="driver-map"
      /></BlurTargetView>
      {!online && !current && !firstOffer ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.offlineMapWash]} /> : null}

      <DriverCockpitView
        connected={backendConnected} readiness={readiness.isError ? null : readiness.data} readinessError={readiness.isError ? apiError(readiness.error) : ''} onRefreshReadiness={() => void readiness.refetch()}
        mapTarget={mapTarget} user={user} online={online} busy={busy || summaryActionBusy} error={error}
        summary={summary} current={current} completed={completedTrip} offer={firstOffer}
        offerRemaining={offerRemaining} offerExpired={offerExpired} offerDistance={offerDistance} offerDuration={offerDuration}
        gpsReady={Boolean(loc) && !gpsBlocked.current} minimized={tripMinimized}
        extras={tripExtras(current || firstOffer)}
        onOnline={() => void toggleOnline()}
        onAccept={() => firstOffer && void accept(firstOffer.trip_id)}
        onDecline={() => firstOffer && void decline(firstOffer.trip_id)}
        onAdvance={advance} onCancel={cancelCurrentTrip} onNoShow={noShow}
        onCall={() => current?.customer?.phone && void Linking.openURL(`tel:${current.customer.phone}`).catch(() => setError('Kunne ikke ringe kunden.'))}
        onChat={() => router.push('/(driver)/messages')} onNavigate={() => void openNavigation()} onEmergency={emergency}
        onMinimize={value => {
          setTripMinimized(value);
          if (current?.trip_id) void (value ? storage.setItem(MINIMIZED_TRIP_KEY, current.trip_id) : storage.removeItem(MINIMIZED_TRIP_KEY)).catch(() => setError('Kunne ikke lagre visningsvalget.'));
        }}
        onContinue={() => void finishSummary(true)} onPause={() => void finishSummary(false)}
        onError={error => setError(apiError(error))}
      />

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


    </View>
  );
}

const useStyles = makeStyles((c) => ({
    driverHeaderWrap: { position: 'absolute', left: 16, right: 16, zIndex: 50 },
    offlineMapWash: { backgroundColor: c.bg, opacity: .42 },
    driverHeader: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 16, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.96)', borderWidth: 1, borderColor: c.line, shadowColor: '#0B0E14', shadowOpacity: 0.10, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
    driverIdentity: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    headerName: { color: c.text, fontFamily: font.semibold, fontSize: 14, maxWidth: 180 },
    headerStatus: { fontFamily: font.mono, fontSize: 9, letterSpacing: 1.4, marginTop: 2 },
    onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.online },
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
    acceptButton: { flex: 2, minHeight: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: c.accent },
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
