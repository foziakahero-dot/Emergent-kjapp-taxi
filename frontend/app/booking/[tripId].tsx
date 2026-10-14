import { driverPresence } from '@/src/lib/tripPresence';
import { BlurTargetView } from 'expo-blur';
import { V10TripDock } from '@/src/components/V10TripDock';
import { validPosition } from '@/src/lib/carAvailability';
import { useAvailableCars } from '@/src/lib/useAvailableCars';
import { AvailabilityStatus } from '@/src/components/AvailabilityStatus';
import { apiError, kr } from '@/src/lib/format';
import { ActiveTripCard, LIVE_TRIP_STATUSES } from '@/src/components/ActiveTripCard';
import { useReducedMotion } from '@/src/components/Motion';
import { FigmaGradient } from '@/src/components/FigmaGradient';
import { Text } from '@/src/components/Typography';
import { CustomerSafetyView } from '@/src/components/CustomerSafetyView';
import { CustomerTripView } from '@/src/components/CustomerTripView';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, AppState, Easing, Image, Linking, Modal, Pressable, Share, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, makeStyles, useColorTheme } from '@/src/theme';
import { Icon } from '@/src/components/Icon';
import { Map } from '@/src/components/Map';
import { KjappMark } from '@/src/components/KjappMark';
import { ChatSheet } from '@/src/components/ChatSheet';
import { Loader } from '@/src/components/ui';
import { safetyApi, tripDriverPhotoSource, tripsApi, messagesApi } from '@/src/lib/api';

const META: Record<string, { title: string; sub: string }> = {
  payment_authorizing: { title: 'Godkjenn kortreservasjonen', sub: 'Ingen sjåfør bestilles før banken har godkjent turbeløpet' },
  searching: { title: 'Søker sjåfør', sub: 'Vi varsler ledige sjåfører nær deg' },
  booking: { title: 'Bestiller for deg', sub: 'Vi finner nærmeste sjåfør' },
  driver_on_way: { title: 'Sjåfør på vei', sub: 'Følg bilen live på kartet' },
  at_pickup: { title: 'Sjåføren er fremme', sub: 'Kom ut når du er klar' },
  in_trip: { title: 'Turen pågår', sub: 'God tur!' },
  arrived: { title: 'Du er fremme!', sub: 'Takk for turen' },
  cancelled: { title: 'Turen ble avbrutt', sub: 'Ingen aktiv tur pågår' },
  cancelled_by_driver: { title: 'Sjåføren måtte avbryte', sub: 'Det søkes ikke automatisk etter ny sjåfør' },
};

export default function BookingFlow() {
  useColorTheme();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const router = useRouter();
  const [minimized, setMinimized] = useState(false);
  const [pickupGuide, setPickupGuide] = useState(false);
  const mapBlurTarget = useRef<View>(null);
  const sceneBlurTarget = useRef<View>(null);
  const [matchingHeight, setMatchingHeight] = useState(300);
  const [minimizedHeight, setMinimizedHeight] = useState(160);
  const [trip, setTrip] = useState<any>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [safetyBusy, setSafetyBusy] = useState(false);
  const safetyLock = useRef(false);
  const cancelPhase = useRef<'idle' | 'preview' | 'confirm' | 'submitting'>('idle');
  const [cancelBusy, setCancelBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [networkIssue, setNetworkIssue] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [driverPhoto, setDriverPhoto] = useState<{ key: string; source: any } | null>(null);
  const photoKey = trip?.trip_id === tripId && trip?.driver_id ? `${tripId}:${trip.driver_id}:${trip.driver?.photo_version || ''}` : '';
  const driverPhotoSource = driverPhoto?.key === photoKey ? driverPhoto.source : null;
  const insideLock = useRef(false), readyLock = useRef(false), authorizationLock = useRef(false);
  const [insideBusy, setInsideBusy] = useState(false), [readyBusy, setReadyBusy] = useState(false), [authorizationBusy, setAuthorizationBusy] = useState(false);
  const [readySent, setReadySent] = useState(false);
  const readyAcknowledged = useRef('');
  const [pickupNotice, setPickupNotice] = useState('');
  const activeRoute = useRef(tripId), mounted = useRef(true);
  activeRoute.current = tripId;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    setMinimized(false); setPickupGuide(false); setChatOpen(false); setSafetyOpen(false); setReadySent(false);
    setNetworkIssue(false); setActionError(''); setPickupNotice('');
    cancelPhase.current = 'idle'; setCancelBusy(false);
  }, [tripId]);
  const routeIsCurrent = () => mounted.current && activeRoute.current === tripId;
  const nav = useRef(false);
  const searching = trip?.trip_id === tripId && ['searching', 'booking'].includes(trip?.status) && !trip?.driver_id;
  const available = useAvailableCars({ enabled: searching, lat: trip?.pickup_lat, lng: trip?.pickup_lng,
    vehicleType: trip?.vehicle_type || 'ai-first', specialNeeds: trip?.special_needs || [], continuous: true });

  useEffect(() => {
    let mounted = true;
    let fetching = false;
    nav.current = false;
    const fetchTrip = async () => {
      if (fetching || AppState.currentState === 'background' || AppState.currentState === 'inactive') return;
      fetching = true;
      try {
        const t = await tripsApi.get(tripId!);
        if (!mounted) return;
        if (t?.trip_id !== tripId) throw new Error('Ugyldig turreferanse.');
        setTrip(t);
        setNetworkIssue(false);
        if (['arrived', 'completed', 'rated'].includes(t.status) && !nav.current) {
          nav.current = true;
          // Server state is canonical. "arrived" means the physical ride ended but
          // payment may still be unresolved; the receipt screen handles real payment.
          router.replace(`/receipt/${tripId}`);
        }
      } catch {
        if (mounted) setNetworkIssue(true);
      } finally { fetching = false; }
    };
    fetchTrip();
    const i = setInterval(fetchTrip, 2500);
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void fetchTrip();
    });
    return () => {
      mounted = false;
      clearInterval(i);
      appStateSub.remove();
    };
  }, [tripId, retryKey, router]);

  useEffect(() => {
    let mounted = true;
    const activeDriver = photoKey && ['driver_on_way', 'at_pickup', 'in_trip', 'arrived'].includes(trip?.status);
    if (!activeDriver) {
      setDriverPhoto(null);
      return () => { mounted = false; };
    }
    void tripDriverPhotoSource(tripId!).then((source) => {
      if (mounted) setDriverPhoto({ key: photoKey, source });
    }).catch(() => {
      if (mounted) setDriverPhoto(null);
    });
    return () => { mounted = false; };
  }, [photoKey, trip?.status, tripId]);

  const releaseCancel = () => { if (routeIsCurrent()) { cancelPhase.current = 'idle'; setCancelBusy(false); } };
  const cancel = async () => {
    if (cancelPhase.current !== 'idle') return;
    cancelPhase.current = 'preview'; setCancelBusy(true); setActionError('');
    try {
      const preview = await tripsApi.cancelPreview(tripId!);
      if (!routeIsCurrent()) return;
      const fee = Number(preview?.cancellation_fee ?? 0);
      if (!Number.isFinite(fee) || fee < 0) throw new Error('Ugyldige avbestillingsvilkår.');
      cancelPhase.current = 'confirm';
      Alert.alert('Avbestille tur?', fee > 0 ? `Avbestillingsgebyr: ${fee} kr. Gebyret vises før du bekrefter.` : 'Ingen avbestillingsgebyr gjelder nå.', [
        { text: 'Behold tur', style: 'cancel', onPress: releaseCancel },
        { text: fee > 0 ? `Avbestill · ${fee} kr` : 'Avbestill', style: 'destructive', onPress: async () => {
          if (!routeIsCurrent() || cancelPhase.current !== 'confirm') return;
          cancelPhase.current = 'submitting';
          try {
            const result = await tripsApi.cancel(tripId!);
            if (!routeIsCurrent()) return;
            if (result?.ok !== true) throw new Error('Avbestillingen ble ikke bekreftet av SNAR.');
            router.replace('/(app)/home');
          } catch (error) {
            if (!routeIsCurrent()) return;
            // A response can be lost after the server commits cancellation.
            try {
              const canonical = await tripsApi.get(tripId!);
              if (['cancelled', 'cancelled_by_driver'].includes(canonical?.status)) {
                router.replace('/(app)/home'); return;
              }
            } catch {}
            setActionError(`Avbestillingen er ikke bekreftet. ${apiError(error)}`);
          } finally { releaseCancel(); }
        } },
      ], { cancelable: true, onDismiss: () => { if (cancelPhase.current === 'confirm') releaseCancel(); } });
    } catch (error) {
      if (!routeIsCurrent()) return;
      setActionError(`Kunne ikke hente avbestillingsvilkårene. ${apiError(error)}`);
      releaseCancel();
    }
  };

  const callEmergency = async () => {
    if (safetyLock.current) return;
    safetyLock.current = true; setActionError(''); setSafetyBusy(true); setSafetyOpen(false);
    // The dialer must open immediately even if logging cannot reach the server.
    void safetyApi.log(tripId!, { kind: 'emergency' }).catch(() => {});
    try { await Linking.openURL('tel:112'); }
    catch { setActionError('Kunne ikke åpne telefonappen. Ring 112 direkte.'); }
    finally { safetyLock.current = false; setSafetyBusy(false); }
  };

  const reportSafety = async () => {
    if (safetyLock.current) return;
    safetyLock.current = true; setActionError(''); setSafetyBusy(true);
    try {
      const confirmed = await safetyApi.log(tripId!, { kind: 'report', note: 'Rapportert fra sikkerhetsmenyen i kundeappen.' });
      if (confirmed?.ok !== true || !confirmed?.event_id) throw new Error('Rapporten ble ikke bekreftet av SNAR.');
      setSafetyOpen(false);
    } catch (error) { setActionError(`Rapporten ble ikke sendt. ${apiError(error)}`); }
    finally { safetyLock.current = false; setSafetyBusy(false); }
  };

  const callDriver = () => {
    const phone = trip?.driver?.phone;
    if (phone) Linking.openURL(`tel:${String(phone).replace(/[^+0-9]/g, '')}`).catch(() => setActionError('Kunne ikke åpne telefonappen. Prøv igjen.'));
  };

  const shareTrip = async () => {
    if (safetyLock.current) return;
    safetyLock.current = true; setActionError(''); setSafetyBusy(true);
    try {
      const shared = await safetyApi.shareLink(tripId!);
      if (typeof shared?.url !== 'string' || !/^https:\/\//.test(shared.url)) throw new Error('Ingen gyldig turlenke mottatt.');
      void safetyApi.log(tripId!, { kind: 'share' }).catch(() => {});
      await Share.share({ title: 'Følg SNAR-turen min', message: `Følg turen min live: ${shared.url}`, url: shared.url });
    } catch (error) { setActionError(`Kunne ikke dele turen. ${apiError(error)}`); }
    finally { safetyLock.current = false; setSafetyBusy(false); }
  };

  const setWaitingInside = async (waitingInside: boolean) => {
    if (!tripId || insideLock.current || !['driver_on_way', 'at_pickup'].includes(trip?.status) || networkIssue) return;
    insideLock.current = true; setInsideBusy(true); setActionError(''); setPickupNotice('');
    try {
      const confirmed = await tripsApi.pickupPreference(tripId, waitingInside);
      if (confirmed?.ok !== true || confirmed?.waiting_inside !== waitingInside) throw new Error('Henteinstruksen ble ikke bekreftet.');
      if (routeIsCurrent()) setTrip((previous: any) => previous?.trip_id === tripId && ['driver_on_way', 'at_pickup'].includes(previous.status) ? { ...previous, pickup_waiting_inside: waitingInside } : previous);
    } catch (error) { if (routeIsCurrent()) setActionError(`Kunne ikke lagre henteinstruksen. ${apiError(error)}`); }
    finally { insideLock.current = false; if (routeIsCurrent()) setInsideBusy(false); }
  };
  const notifyReady = async () => {
    const key = `${tripId}:${trip?.driver_id || ''}`;
    if (!tripId || readyLock.current || readyAcknowledged.current === key || trip?.status !== 'at_pickup' || networkIssue) return;
    readyLock.current = true; setReadyBusy(true); setActionError(''); setPickupNotice('');
    try { const confirmed = await messagesApi.send(tripId, 'Jeg er i bilen og klar til turstart.'); if (!confirmed?.id) throw new Error('Meldingen mangler leveringsbekreftelse.'); if (routeIsCurrent()) { readyAcknowledged.current = key; setReadySent(true); setPickupNotice('Sjåføren er varslet. Vent på at sjåføren bekrefter turstart.'); } }
    catch (error) { if (routeIsCurrent()) setActionError(`Meldingen ble ikke bekreftet sendt. ${apiError(error)}`); }
    finally { readyLock.current = false; if (routeIsCurrent()) setReadyBusy(false); }
  };
  const authorize = async () => {
    if (!tripId || authorizationLock.current || trip?.status !== 'payment_authorizing' || networkIssue) return;
    authorizationLock.current = true; setAuthorizationBusy(true); setActionError('');
    try { const confirmed = await tripsApi.authorize(tripId); if (confirmed?.trip_id === tripId && routeIsCurrent()) setTrip(confirmed); }
    catch (error) { if (routeIsCurrent()) setActionError(`Kortreservasjonen ble ikke bekreftet. ${apiError(error)}`); }
    finally { authorizationLock.current = false; if (routeIsCurrent()) setAuthorizationBusy(false); }
  };
  const openWalkingDirections = () => {
    const lat = trip?.pickup_lat, lng = trip?.pickup_lng;
    if (!validPosition({ lat, lng })) { setActionError('Hentestedets kartposisjon er ikke tilgjengelig. Ring sjåføren for hjelp.'); return; }
    void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}&travelmode=walking`).catch(() => setActionError('Kunne ikke åpne gangveiledningen. Ring sjåføren for hjelp.'));
  };

  if (!trip || trip.trip_id !== tripId) {
    if (networkIssue) {
      return (
        <View style={s.loading} testID="booking-load-error">
          <View style={s.offlineIcon}><Icon name="crosshair" size={22} color={colors.accent} /></View>
          <Text style={s.loadErrorTitle}>Får ikke kontakt med turen</Text>
          <Text style={s.loadErrorSub}>Sjekk nettet ditt. SNAR gjør ingen endringer i turen mens denne skjermen ikke har ferske data.</Text>
          <Pressable style={s.retryBtn} onPress={() => setRetryKey((v) => v + 1)} testID="booking-retry-load">
            <Text style={s.retryBtnText}>Prøv igjen</Text>
          </Pressable>
        </View>
      );
    }
    return <View style={s.loading}><Loader label="Åpner turen din…" /></View>;
  }

  const meta = META[trip.status] || META.searching;
  const route = trip.status === 'driver_on_way' ? (!networkIssue && driverPresence(trip).fresh ? trip.driver_pickup_geometry?.coordinates || null : null) : trip.status === 'in_trip' ? trip.geometry?.coordinates || null : null;
  const presence = driverPresence(trip);
  const driverGpsFresh = presence.fresh;
  const showCar = ['driver_on_way', 'at_pickup', 'in_trip'].includes(trip.status) && presence.hasPosition;
  const isFinal = ['cancelled', 'cancelled_by_driver'].includes(trip.status);
  const driverCancelled = trip.status === 'cancelled_by_driver';
  const noDriver = trip.status === 'cancelled' && trip.cancel_reason === 'no_driver_available';
  const canCancel = ['payment_authorizing', 'searching', 'booking', 'driver_on_way', 'at_pickup'].includes(trip.status)
    || (trip.internal_beta_test === true && trip.status === 'in_trip');
  const etaValue = trip.eta_min;
  const etaMinutes = !networkIssue && driverGpsFresh && Number.isFinite(etaValue) && etaValue > 0 ? Math.max(1, Math.round(etaValue)) : null;
  const driverDistance = trip.driver_distance_to_pickup_km;
  const driverDistanceLabel = !networkIssue && driverGpsFresh && Number.isFinite(driverDistance) && driverDistance >= 0
    ? driverDistance < 1 ? `${Math.round(driverDistance * 1000)} m unna` : `${driverDistance.toLocaleString('nb-NO', { maximumFractionDigits: 1 })} km unna`
    : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <BlurTargetView ref={sceneBlurTarget} style={{ flex: 1 }}>
      {actionError ? <View style={{ position: 'absolute', zIndex: 100, top: insets.top + 60, left: 16, right: 16, padding: 12, borderRadius: 16, backgroundColor: colors.surface }}><Text testID="booking-action-error" accessibilityRole="alert" style={{ color: colors.danger }}>{actionError}</Text></View> : null}
      <BlurTargetView ref={mapBlurTarget} style={StyleSheet.absoluteFill}><Map
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        pickup={{ lat: trip.pickup_lat, lng: trip.pickup_lng }}
        dropoff={trip.status === 'in_trip' ? { lat: trip.dropoff_lat, lng: trip.dropoff_lng } : null}
        route={route}
        focusRoute={pickupGuide ? null : route}
        showControls={false}
        cars={searching ? available.cars : []}
        focusMode={searching ? 'nearby' : 'route'}
        contentInsets={{ top: insets.top + 88, right: 72,
          bottom: minimized ? insets.bottom + 24 + minimizedHeight + 32 : matchingHeight + 32, left: 72 }}
        activeCar={showCar ? { lat: trip.driver_lat, lng: trip.driver_lng, heading: trip.driver_heading, eta_min: trip.status === 'driver_on_way' ? etaMinutes ?? undefined : undefined } : null}
        testID="booking-map"
      /></BlurTargetView>

      {trip.status === 'at_pickup' ? <View testID="pickup-map-dim" pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg, opacity: .25 }]} /> : null}
      {LIVE_TRIP_STATUSES.includes(trip.status) && trip.status !== 'in_trip' ? <Pressable testID="active-trip-minimize" accessibilityRole="button" accessibilityLabel="Minimer tur" onPress={() => { setMinimized(true); }} style={{ position: 'absolute', zIndex: 50, top: insets.top + 8, right: 16, padding: 12, borderRadius: 24, backgroundColor: colors.surface }}><Text>Minimer</Text></Pressable> : null}
      {minimized && LIVE_TRIP_STATUSES.includes(trip.status) ? <View testID="booking-minimized-card" onLayout={e => setMinimizedHeight(e.nativeEvent.layout.height)} style={{ position: 'absolute', bottom: insets.bottom + 24, left: 16, right: 16, gap: 8 }}>
        <ActiveTripCard trip={trip} offline={networkIssue} onOpen={() => setMinimized(false)} />
        <Pressable testID="active-trip-home" accessibilityRole="button" onPress={() => router.replace('/(app)/home')} style={{ padding: 12, backgroundColor: colors.surface, borderRadius: 24 }}><Text style={{ textAlign: 'center' }}>Til hjem og meny</Text></Pressable>
      </View> : <CustomerTripView
        trip={trip} driverPhoto={driverPhotoSource} eta={etaMinutes} distance={driverDistanceLabel}
        mapBlurTarget={mapBlurTarget}
        offline={networkIssue} gpsFresh={driverGpsFresh} available={available}
        insideBusy={insideBusy} readyBusy={readyBusy} readySent={readySent && readyAcknowledged.current === `${tripId}:${trip.driver_id || ''}`} authorizationBusy={authorizationBusy} cancelBusy={cancelBusy} canCancel={canCancel}
        onGuideChange={setPickupGuide}
        onInside={value => void setWaitingInside(value)} onCall={callDriver} onChat={() => setChatOpen(true)}
        onShare={() => void shareTrip()} onSafety={() => setSafetyOpen(true)} onCancel={() => void cancel()}
        onMinimize={() => setMinimized(true)} onHome={() => router.replace(noDriver ? { pathname: '/(app)/home', params: { retryTripId: trip.trip_id } } : '/(app)/home')}
        onWalk={openWalkingDirections} onReady={() => void notifyReady()} onAuthorize={() => void authorize()}
        onPhotoError={() => setDriverPhoto(current => current?.key === photoKey ? null : current)} onSheetLayout={setMatchingHeight}
      />}
      {pickupNotice ? <View style={{ position: 'absolute', top: insets.top + 60, left: 16, right: 16, zIndex: 60, padding: 12, borderRadius: 16, backgroundColor: colors.surface }}><Text accessibilityLiveRegion="polite" style={{ color: colors.success }}>{pickupNotice}</Text></View> : null}
      </BlurTargetView>
      {trip.status === 'in_trip' ? <V10TripDock target={sceneBlurTarget} active={chatOpen ? 'message' : safetyOpen ? 'safety' : 'driver'} onDriver={() => setMinimized(false)} onMessage={() => setChatOpen(true)} onSafety={() => setSafetyOpen(true)} onTrip={() => router.push(`/customer-trip/${tripId}`)} /> : null}

      <Modal visible={safetyOpen} transparent animationType="fade" onRequestClose={() => !safetyBusy && setSafetyOpen(false)}>
        <View style={[s.modalBackdrop, { padding: 0, backgroundColor: `${colors.bg}59` }]}>
          <Pressable testID="customer-app-booking-tripId-337" style={StyleSheet.absoluteFill} onPress={() => !safetyBusy && setSafetyOpen(false)} accessibilityLabel="Lukk sikkerhetsmeny" />
          <CustomerSafetyView trip={trip} busy={safetyBusy} error={actionError} onClose={() => setSafetyOpen(false)} onShare={() => void shareTrip()} onReport={() => void reportSafety()} onEmergency={() => void callEmergency()} />
        </View>
      </Modal>

      <ChatSheet
        tripId={tripId!}
        role="passenger"
        visible={chatOpen}
        onClose={() => setChatOpen(false)}
        peerName={trip.driver?.name || 'Din sjåfør'}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  loading: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  offlineIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.accentSoft, borderWidth: 1, borderColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  loadErrorTitle: { color: c.text, fontFamily: font.semibold, fontSize: 20, marginTop: 16, textAlign: 'center' },
  loadErrorSub: { color: c.textMuted, fontSize: 13, lineHeight: 19, marginTop: 8, textAlign: 'center' },
  retryBtn: { minHeight: 50, borderRadius: 25, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, marginTop: 18 },
  retryBtnText: { color: c.accentOn, fontFamily: font.bold, fontSize: 14 },

  matchingOverlay: { ...StyleSheet.absoluteFill, zIndex: 20, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 160, backgroundColor: 'transparent' },
  matchingCard: { width: 278, alignItems: 'center', borderRadius: 24, paddingHorizontal: 40, paddingVertical: 32, backgroundColor: 'rgba(255,255,255,0.96)', borderWidth: 1, borderColor: c.line, shadowColor: '#0B0E14', shadowOpacity: 0.14, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  matchingMarkWrap: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  matchingRing: { position: 'absolute', width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: 'transparent', borderTopColor: c.accent },
  matchingTitle: { color: c.text, fontFamily: font.semibold, fontSize: 16, lineHeight: 24, letterSpacing: -0.32, marginTop: 20 },
  matchingSub: { color: c.textSecondary, fontSize: 12, marginTop: 4, textAlign: 'center' },
  matchingCancel: { marginTop: 18, minHeight: 36, justifyContent: 'center' },
  matchingCancelText: { color: c.textSecondary, fontSize: 13, textDecorationLine: 'underline' },

  arrivalTopCard: { position: 'absolute', left: 16, right: 16, zIndex: 20, alignItems: 'center', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.96)', borderWidth: 1, borderColor: c.line, shadowColor: '#0B0E14', shadowOpacity: 0.10, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  arrivalEyebrow: { color: c.accent, fontFamily: font.mono, fontSize: 10, letterSpacing: 1.4 },
  arrivalEta: { color: c.text, fontFamily: font.semibold, fontSize: 20, marginTop: 3 },
  arrivalSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 24, paddingTop: 20, backgroundColor: 'rgba(255,255,255,0.98)', borderTopWidth: 1, borderTopColor: c.line, shadowColor: '#0B0E14', shadowOpacity: 0.12, shadowRadius: 25, shadowOffset: { width: 0, height: -10 }, elevation: 9 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.lineStrong, marginBottom: 16 },
  verifyLabel: { color: c.textMuted, fontFamily: font.mono, fontSize: 10, letterSpacing: 1.5, marginBottom: 9 },
  driverCard: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 12, backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line },
  driverAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: c.accent },
  driverAvatarImage: { width: 48, height: 48, borderRadius: 24 },
  driverAvatarText: { color: c.accentOn, fontFamily: font.bold, fontSize: 18 },
  driverInfo: { flex: 1 },
  driverName: { color: c.text, fontFamily: font.semibold, fontSize: 14 },
  driverCar: { color: c.textSecondary, fontFamily: font.mono, fontSize: 11, lineHeight: 16, marginTop: 0 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ratingText: { color: c.textSecondary, fontSize: 12 },
  driverDistance: { color: c.textSecondary, fontSize: 11 },
  plateBox: { minWidth: 82, alignItems: 'center', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: c.surface, borderWidth: 1, borderColor: c.lineStrong },
  plateLabel: { color: c.textMuted, fontFamily: font.mono, fontSize: 8, letterSpacing: 1.2 },
  plateText: { color: c.text, fontFamily: font.bold, fontSize: 13, letterSpacing: 0.8, marginTop: 2 },
  contactRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  contactButton: { flex: 1, minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.lineStrong },
  contactText: { color: c.text, fontFamily: font.medium, fontSize: 14 },

  tripBanner: { position: 'absolute', left: 16, right: 16, zIndex: 20, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 13, backgroundColor: 'rgba(255,255,255,0.96)', borderWidth: 1, borderColor: c.line, shadowColor: '#0B0E14', shadowOpacity: 0.10, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  tripBannerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tripDestinationIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceInverse },
  tripEyebrow: { color: c.accent, fontFamily: font.mono, fontSize: 9, letterSpacing: 1.4 },
  tripDriverLine: { color: c.text, fontFamily: font.semibold, fontSize: 13, marginTop: 3 },
  tripEtaWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  tripEta: { color: c.text, fontFamily: font.semibold, fontSize: 20 },
  tripEtaUnit: { color: c.textMuted, fontSize: 12 },
  inRideSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 24, paddingTop: 20, backgroundColor: 'rgba(255,255,255,0.98)', borderTopWidth: 1, borderTopColor: c.line, shadowColor: '#0B0E14', shadowOpacity: 0.12, shadowRadius: 25, shadowOffset: { width: 0, height: -10 }, elevation: 9 },
  inRideActions: { flexDirection: 'row', gap: 10 },
  rideAction: { flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.lineStrong },
  rideActionText: { color: c.text, fontFamily: font.medium, fontSize: 12 },
  sosAction: { flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 16, backgroundColor: '#E11D48' },
  sosText: { color: c.accentOn, fontFamily: font.bold, fontSize: 12 },

  networkBanner: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.warning + '12', borderWidth: 1, borderColor: c.warning, borderRadius: 10, paddingHorizontal: 11, marginBottom: 12 },
  networkDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.warning },
  networkText: { color: c.textSecondary, fontSize: 11, flex: 1 },

  finalSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20, alignItems: 'center', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 24, paddingTop: 28, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.line },
  finalIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: c.dangerSoft, borderWidth: 1, borderColor: c.danger, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  finalIconDriver: { backgroundColor: c.accentSoft, borderColor: c.accent },
  finalTitle: { color: c.text, fontFamily: font.semibold, fontSize: 22 },
  finalSub: { color: c.textMuted, fontSize: 14, marginTop: 4, textAlign: 'center' },
  recoveryCopy: { color: c.textSecondary, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 10 },
  homeBtn: { marginTop: 20, minHeight: 52, backgroundColor: c.accent, borderRadius: 26, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center' },
  homeBtnText: { color: c.accentOn, fontFamily: font.bold, fontSize: 15 },

  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.68)' },
  safetySheet: { backgroundColor: c.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: c.line, padding: 20, paddingBottom: 34 },
  safetyHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  safetyOverline: { color: c.accent, fontFamily: font.bold, fontSize: 10, letterSpacing: 1.4 },
  safetyTitle: { color: c.text, fontFamily: font.semibold, fontSize: 22, marginTop: 3 },
  safetyCopy: { color: c.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 12, marginBottom: 14 },
  emergencyAction: { minHeight: 66, borderRadius: 16, borderWidth: 1, borderColor: c.danger, backgroundColor: c.dangerSoft, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, marginTop: 8 },
  safetyAction: { minHeight: 66, borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: c.cardSubtle, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, marginTop: 8 },
  safetyActionTitle: { color: c.text, fontFamily: font.semibold, fontSize: 14 },
  safetyActionSub: { color: c.textMuted, fontSize: 11, marginTop: 3 },
}));

