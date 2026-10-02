import { useReducedMotion } from '@/src/components/Motion';
import { FigmaGradient } from '@/src/components/FigmaGradient';
import { Text } from '@/src/components/Typography';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, AppState, Easing, Image, Linking, Modal, Pressable, Share, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon } from '@/src/components/Icon';
import { Map } from '@/src/components/Map';
import { KjappMark } from '@/src/components/KjappMark';
import { ChatSheet } from '@/src/components/ChatSheet';
import { Loader } from '@/src/components/ui';
import { safetyApi, tripDriverPhotoSource, tripsApi } from '@/src/lib/api';

const META: Record<string, { title: string; sub: string }> = {
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
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const router = useRouter();
  const [trip, setTrip] = useState<any>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [safetyBusy, setSafetyBusy] = useState(false);
  const [networkIssue, setNetworkIssue] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [driverPhotoSource, setDriverPhotoSource] = useState<any>(null);
  const nav = useRef(false);
  const matchingSpin = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion || !['searching', 'booking'].includes(trip?.status)) {
      matchingSpin.stopAnimation();
      matchingSpin.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(matchingSpin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [matchingSpin, trip?.status, reducedMotion]);

  useEffect(() => {
    let mounted = true;
    const fetchTrip = async () => {
      try {
        const t = await tripsApi.get(tripId!);
        if (!mounted) return;
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
      }
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
    const activeDriver = trip?.driver_id && ['driver_on_way', 'at_pickup', 'in_trip', 'arrived'].includes(trip?.status);
    if (!activeDriver) {
      setDriverPhotoSource(null);
      return () => { mounted = false; };
    }
    void tripDriverPhotoSource(tripId!).then((source) => {
      if (mounted) setDriverPhotoSource(source);
    }).catch(() => {
      if (mounted) setDriverPhotoSource(null);
    });
    return () => { mounted = false; };
  }, [trip?.driver_id, trip?.status, tripId]);

  const cancel = async () => {
    try {
      const preview = await tripsApi.cancelPreview(tripId!);
      const fee = Number(preview?.cancellation_fee || 0);
      Alert.alert(
        'Avbestille tur?',
        fee > 0 ? `Avbestillingsgebyr: ${fee} kr. Gebyret vises før du bekrefter.` : 'Ingen avbestillingsgebyr gjelder nå.',
        [
          { text: 'Behold tur', style: 'cancel' },
          { text: fee > 0 ? `Avbestill · ${fee} kr` : 'Avbestill', style: 'destructive', onPress: async () => {
            try { await tripsApi.cancel(tripId!); } finally { router.replace('/(app)/home'); }
          } },
        ],
      );
    } catch {
      Alert.alert('Kunne ikke avbestille', 'Vi fikk ikke bekreftet avbestillingsvilkårene. Prøv igjen.');
    }
  };

  const callEmergency = async () => {
    setSafetyBusy(true);
    try { await safetyApi.log(tripId!, { kind: 'emergency' }); } catch {}
    finally {
      setSafetyBusy(false);
      setSafetyOpen(false);
      Linking.openURL('tel:112').catch(() => {});
    }
  };

  const reportSafety = async () => {
    setSafetyBusy(true);
    try {
      await safetyApi.log(tripId!, { kind: 'report', note: 'Rapportert fra sikkerhetsmenyen i kundeappen.' });
      setSafetyOpen(false);
    } catch {}
    finally { setSafetyBusy(false); }
  };

  const callDriver = () => {
    const phone = trip?.driver?.phone;
    if (phone) Linking.openURL(`tel:${String(phone).replace(/[^+0-9]/g, '')}`).catch(() => {});
  };

  const shareTrip = async () => {
    setSafetyBusy(true);
    try {
      const shared = await safetyApi.shareLink(tripId!);
      await safetyApi.log(tripId!, { kind: 'share' }).catch(() => {});
      await Share.share({ title: 'Følg KJAPP-turen min', message: `Følg turen min live: ${shared.url}`, url: shared.url });
    } catch {}
    finally { setSafetyBusy(false); }
  };

  if (!trip) {
    if (networkIssue) {
      return (
        <View style={s.loading} testID="booking-load-error">
          <View style={s.offlineIcon}><Icon name="crosshair" size={22} color={colors.accent} /></View>
          <Text style={s.loadErrorTitle}>Får ikke kontakt med turen</Text>
          <Text style={s.loadErrorSub}>Sjekk nettet ditt. KJAPP gjør ingen endringer i turen mens denne skjermen ikke har ferske data.</Text>
          <Pressable style={s.retryBtn} onPress={() => setRetryKey((v) => v + 1)} testID="booking-retry-load">
            <Text style={s.retryBtnText}>Prøv igjen</Text>
          </Pressable>
        </View>
      );
    }
    return <View style={s.loading}><Loader label="Åpner turen din…" /></View>;
  }

  const meta = META[trip.status] || META.searching;
  const route = trip.geometry?.coordinates || [[trip.pickup_lng, trip.pickup_lat], [trip.dropoff_lng, trip.dropoff_lat]];
  const showCar = ['driver_on_way', 'at_pickup', 'in_trip'].includes(trip.status) && trip.driver_lat != null;
  const isFinal = ['cancelled', 'cancelled_by_driver'].includes(trip.status);
  const driverCancelled = trip.status === 'cancelled_by_driver';
  const canCancel = ['searching', 'booking', 'driver_on_way', 'at_pickup'].includes(trip.status);
  const etaValue = Number(trip.eta_min);
  const etaMinutes = Number.isFinite(etaValue) && etaValue > 0 ? Math.max(1, Math.round(etaValue)) : null;
  const driverDistance = Number(trip.driver_distance_to_pickup_km);
  const driverDistanceLabel = Number.isFinite(driverDistance) && driverDistance >= 0
    ? `${driverDistance.toFixed(driverDistance < 10 ? 1 : 0)} km unna`
    : null;
  const spinDeg = matchingSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  let driverGpsFresh = true;
  if (trip.driver_location_at && ['driver_on_way', 'at_pickup', 'in_trip'].includes(trip.status)) {
    const stamp = Date.parse(trip.driver_location_at);
    if (Number.isFinite(stamp)) driverGpsFresh = Date.now() - stamp <= 30000;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Map
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        pickup={{ lat: trip.pickup_lat, lng: trip.pickup_lng }}
        dropoff={{ lat: trip.dropoff_lat, lng: trip.dropoff_lng }}
        route={route}
        activeCar={showCar ? { lat: trip.driver_lat, lng: trip.driver_lng, heading: trip.driver_heading } : null}
        testID="booking-map"
      />

      {trip.status === 'searching' || trip.status === 'booking' ? (
        <View style={s.matchingOverlay} testID="matching-overlay">
          <FigmaGradient pointerEvents="none" angle={180} colors={['rgba(244,246,250,0.2)', 'rgba(244,246,250,0.75)']} style={StyleSheet.absoluteFill} />
          <View style={s.matchingCard}>
            <View style={s.matchingMarkWrap}>
              <Animated.View style={[s.matchingRing, { transform: [{ rotate: spinDeg }] }]} />
              <KjappMark size={40} />
            </View>
            <Text style={s.matchingTitle}>Finner din sjåfør…</Text>
            <Text style={s.matchingSub}>Matcher med nærmeste ledige KJAPP-bil</Text>
            <Pressable onPress={cancel} testID="searching-cancel" style={s.matchingCancel}>
              <Text style={s.matchingCancelText}>Avbryt søk</Text>
            </Pressable>
          </View>
        </View>
      ) : isFinal ? (
        <View style={[s.finalSheet, { paddingBottom: insets.bottom + 22 }]}>
          <View style={[s.finalIcon, driverCancelled && s.finalIconDriver]}>
            <Icon name={driverCancelled ? 'car' : 'x'} size={22} color={driverCancelled ? colors.accent : colors.danger} />
          </View>
          <Text style={s.finalTitle}>{meta.title}</Text>
          <Text style={s.finalSub}>{meta.sub}</Text>
          {driverCancelled ? <Text style={s.recoveryCopy}>Start en ny bestilling når du er klar.</Text> : null}
          <Pressable onPress={() => router.replace('/(app)/home')} style={s.homeBtn} testID="booking-home">
            <Text style={s.homeBtnText}>{driverCancelled ? 'Bestill ny tur' : 'Tilbake til hjem'}</Text>
          </Pressable>
        </View>
      ) : trip.status === 'in_trip' ? (
        <>
          <View style={[s.tripBanner, { top: insets.top + 16 }]} testID="inride-banner">
            <View style={s.tripBannerRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.tripEyebrow}>UNDERVEIS</Text>
                <Text style={s.tripDriverLine} numberOfLines={1}>
                  {trip.driver?.name || 'Din sjåfør'} · {trip.driver?.car || 'Bil'} · {trip.driver?.plate || ''}
                </Text>
              </View>
              <Text style={s.tripEta}>{etaMinutes ? `${etaMinutes} min` : 'På vei'}</Text>
            </View>
          </View>

          <View style={[s.inRideSheet, { paddingBottom: insets.bottom + 32 }]}>
            <View style={s.handle} />
            {networkIssue || !driverGpsFresh ? (
              <View style={s.networkBanner}>
                <View style={s.networkDot} />
                <Text style={s.networkText}>{networkIssue ? 'Live-data oppdateres automatisk' : 'Viser siste kjente sjåførposisjon'}</Text>
              </View>
            ) : null}
            <View style={s.inRideActions}>
              <Pressable style={s.rideAction} onPress={shareTrip} testID="ontrip-share">
                <Icon name="shield" size={20} color={colors.accent} />
                <Text style={s.rideActionText}>Del tur</Text>
              </Pressable>
              <Pressable style={s.rideAction} onPress={() => setChatOpen(true)} testID="ontrip-chat">
                <Icon name="message" size={20} color={colors.accent} />
                <Text style={s.rideActionText}>Melding</Text>
              </Pressable>
              <Pressable style={s.sosAction} onPress={() => setSafetyOpen(true)} testID="ontrip-safety">
                <Icon name="shield" size={20} color={colors.accentOn} />
                <Text style={s.sosText}>SOS</Text>
              </Pressable>
            </View>
          </View>
        </>
      ) : (
        <>
          <View style={[s.arrivalTopCard, { top: insets.top + 16 }]} testID="driver-arrival-eta">
            <Text style={s.arrivalEyebrow}>{trip.status === 'at_pickup' ? 'SJÅFØREN ER FREMME' : 'SJÅFØREN ER PÅ VEI'}</Text>
            <Text style={s.arrivalEta}>
              {trip.status === 'at_pickup' ? 'Klar for henting' : etaMinutes ? `Ankommer om ${etaMinutes} min` : 'På vei til deg'}
            </Text>
          </View>

          <View style={[s.arrivalSheet, { paddingBottom: insets.bottom + 32 }]}>
            <View style={s.handle} />
            {networkIssue || !driverGpsFresh ? (
              <View style={s.networkBanner}>
                <View style={s.networkDot} />
                <Text style={s.networkText}>{networkIssue ? 'Live-data oppdateres automatisk' : 'Viser siste kjente sjåførposisjon'}</Text>
              </View>
            ) : null}
            <Text style={s.verifyLabel}>BEKREFT SJÅFØR OG BIL</Text>
            <View style={s.driverCard}>
              <View style={s.driverAvatar}>
                {driverPhotoSource ? (
                  <Image source={driverPhotoSource} style={s.driverAvatarImage} resizeMode="cover" onError={() => setDriverPhotoSource(null)} />
                ) : (
                  <Text style={s.driverAvatarText}>{(trip.driver?.name || 'KJ').slice(0, 1).toUpperCase()}</Text>
                )}
              </View>
              <View style={s.driverInfo}>
                <Text style={s.driverName} numberOfLines={1}>{trip.driver?.name || 'Din sjåfør'}</Text>
                <Text style={s.driverCar} numberOfLines={1}>{trip.driver?.car || 'Bil'}</Text>
                {trip.driver?.rating != null ? (
                  <View style={s.ratingRow}>
                    <Icon name="star" size={12} color={colors.accent} fill={colors.accent} />
                    <Text style={s.ratingText}>{trip.driver.rating}</Text>
                    {driverDistanceLabel ? <Text style={s.driverDistance}>· {driverDistanceLabel}</Text> : null}
                  </View>
                ) : null}
              </View>
              <View style={s.plateBox}>
                <Text style={s.plateLabel}>SKILT</Text>
                <Text style={s.plateText}>{trip.driver?.plate || '—'}</Text>
              </View>
            </View>
            <View style={s.contactRow}>
              <Pressable style={s.contactButton} onPress={callDriver} testID="action-call-driver">
                <Icon name="phone" size={18} color={colors.text} />
                <Text style={s.contactText}>Ring</Text>
              </Pressable>
              <Pressable style={s.contactButton} onPress={() => setChatOpen(true)} testID="action-message">
                <Icon name="message" size={18} color={colors.text} />
                <Text style={s.contactText}>Melding</Text>
              </Pressable>
            </View>
          </View>
        </>
      )}

      <Modal visible={safetyOpen} transparent animationType="fade" onRequestClose={() => setSafetyOpen(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => !safetyBusy && setSafetyOpen(false)}>
          <Pressable style={s.safetySheet} onPress={() => {}}>
            <View style={s.safetyHead}>
              <View>
                <Text style={s.safetyOverline}>KJAPP SIKKERHET</Text>
                <Text style={s.safetyTitle}>Hjelp på turen</Text>
              </View>
              <Pressable onPress={() => setSafetyOpen(false)} disabled={safetyBusy} accessibilityLabel="Lukk sikkerhetsmeny">
                <Icon name="x" size={20} color={colors.text} />
              </Pressable>
            </View>
            <Text style={s.safetyCopy}>Ved akutt fare for liv eller helse: ring 112. KJAPP-support erstatter ikke nødetatene.</Text>
            <Pressable style={s.emergencyAction} onPress={callEmergency} disabled={safetyBusy} testID="safety-call-112">
              <Icon name="phone" size={18} color={colors.text} />
              <View style={{ flex: 1 }}><Text style={s.safetyActionTitle}>Ring 112</Text><Text style={s.safetyActionSub}>Hendelsen logges også på turen</Text></View>
            </Pressable>
            <Pressable style={s.safetyAction} onPress={shareTrip} disabled={safetyBusy} testID="safety-share-trip">
              <Icon name="navigation" size={18} color={colors.accent} />
              <View style={{ flex: 1 }}><Text style={s.safetyActionTitle}>Del live-turen</Text><Text style={s.safetyActionSub}>Lenken utløper automatisk etter 24 timer</Text></View>
            </Pressable>
            <Pressable style={s.safetyAction} onPress={reportSafety} disabled={safetyBusy} testID="safety-report">
              <Icon name="flag" size={18} color={colors.accent} />
              <View style={{ flex: 1 }}><Text style={s.safetyActionTitle}>Rapporter til KJAPP</Text><Text style={s.safetyActionSub}>Oppretter en prioritert sak knyttet til turen</Text></View>
            </Pressable>
          </Pressable>
        </Pressable>
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
  tripEyebrow: { color: c.accent, fontFamily: font.mono, fontSize: 9, letterSpacing: 1.4 },
  tripDriverLine: { color: c.text, fontFamily: font.semibold, fontSize: 13, marginTop: 3 },
  tripEta: { color: c.text, fontFamily: font.semibold, fontSize: 18 },
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



