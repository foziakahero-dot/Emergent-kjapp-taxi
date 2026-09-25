import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, Modal, Pressable, Share, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon, IconName } from '@/src/components/Icon';
import { Map } from '@/src/components/Map';
import { ChatSheet } from '@/src/components/ChatSheet';
import { Loader } from '@/src/components/ui';
import { safetyApi, tripsApi } from '@/src/lib/api';
import { kr } from '@/src/lib/format';

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
  const nav = useRef(false);

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

      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        {canCancel ? (
          <Pressable onPress={cancel} style={s.iconBtn} testID="trip-cancel" accessibilityRole="button" accessibilityLabel="Avbryt tur">
            <Icon name="x" size={20} color={colors.text} />
          </Pressable>
        ) : <View style={{ width: 44 }} />}
        <View style={s.statusPill}>
          <Text style={s.statusText} testID="customer-trip-status">{meta.title}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={s.handle} />

        {networkIssue ? (
          <View style={s.networkBanner} testID="booking-network-warning">
            <View style={s.networkDot} />
            <Text style={s.networkText}>Live-data er midlertidig utilgjengelig · prøver igjen automatisk</Text>
          </View>
        ) : !driverGpsFresh ? (
          <View style={s.networkBanner} testID="booking-gps-warning">
            <View style={s.networkDot} />
            <Text style={s.networkText}>Sjåførposisjonen oppdateres · viser siste kjente posisjon</Text>
          </View>
        ) : null}

        {trip.status === 'searching' || trip.status === 'booking' ? (
          <View style={{ alignItems: 'center', paddingVertical: 8 }}>
            <View style={s.radar}><Icon name="navigation" size={26} color={colors.accent} /></View>
            <Text style={s.bigTitle}>{meta.title}</Text>
            <Text style={s.sub}>{meta.sub}</Text>
            <View style={s.destBox}>
              <Icon name="map-pin" size={16} color={colors.accent} />
              <Text style={s.destText} numberOfLines={1}>{trip.dropoff_address}</Text>
              <Text style={s.destPrice}>{kr(trip.price)}</Text>
            </View>
            <Pressable onPress={cancel} testID="searching-cancel" style={{ marginTop: 14 }}>
              <Text style={s.cancelLink}>Avbryt søk</Text>
            </Pressable>
          </View>
        ) : isFinal ? (
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <View style={[s.finalIcon, driverCancelled && s.finalIconDriver]}>
              <Icon name={driverCancelled ? 'car' : 'x'} size={22} color={driverCancelled ? colors.accent : colors.danger} />
            </View>
            <Text style={s.bigTitle}>{meta.title}</Text>
            <Text style={s.sub}>{meta.sub}</Text>
            {driverCancelled ? (
              <Text style={s.recoveryCopy}>Start en ny bestilling når du er klar. KJAPP bruker ikke den avbrutte turen som om den fortsatt var aktiv.</Text>
            ) : null}
            <Pressable onPress={() => router.replace('/(app)/home')} style={s.homeBtn} testID="booking-home">
              <Text style={s.homeBtnText}>{driverCancelled ? 'Bestill ny tur' : 'Tilbake til hjem'}</Text>
            </Pressable>
          </View>
        ) : (
          <View>
            <View style={s.driverRow}>
              <View style={s.etaBadge}>
                {trip.status === 'in_trip' ? (
                  <Icon name="navigation" size={22} color={colors.accent} />
                ) : trip.status === 'at_pickup' ? (
                  <>
                    <Text style={s.etaNum}>✓</Text>
                    <Text style={s.etaMin}>FREMME</Text>
                  </>
                ) : (
                  <>
                    <Text style={s.etaNum}>{etaMinutes ?? '—'}</Text>
                    <Text style={s.etaMin}>{etaMinutes ? 'MIN' : 'PÅ VEI'}</Text>
                  </>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.overline}>{meta.title}</Text>
                <Text style={s.driverName} numberOfLines={1}>{trip.driver?.name || 'Din sjåfør'}</Text>
                <Text style={s.driverCar} numberOfLines={1}>
                  {(trip.driver?.car || 'Bil')} · {trip.driver?.plate || ''}
                </Text>
                {trip.driver?.rating != null ? (
                  <View style={s.ratingRow}>
                    <Icon name="star" size={12} color={colors.accent} fill={colors.accent} />
                    <Text style={s.ratingText}>{trip.driver.rating}</Text>
                    {trip.status === 'driver_on_way' && driverDistanceLabel ? (
                      <Text style={s.driverDistance}>· {driverDistanceLabel}</Text>
                    ) : null}
                  </View>
                ) : trip.status === 'driver_on_way' && driverDistanceLabel ? (
                  <Text style={s.driverDistance}>{driverDistanceLabel}</Text>
                ) : null}
              </View>
            </View>

            {trip.status === 'in_trip' ? (
              <View style={s.metrics}>
                <Metric label="Avstand" value={`${trip.distance_km} km`} />
                <View style={s.divider} />
                <Metric label="Tid" value={`${trip.duration_min} min`} />
                <View style={s.divider} />
                <Metric label="Pris" value={kr(trip.price)} />
              </View>
            ) : (
              <View style={s.actions}>
                <Action icon="message" label="Melding" testID="action-message" onPress={() => setChatOpen(true)} />
                <Action icon="shield" label="Sikkerhet" testID="action-safety" onPress={() => setSafetyOpen(true)} />
              </View>
            )}
            {trip.status === 'in_trip' ? (
              <View style={s.onTripActions}>
                <Pressable style={[s.chatBtn, { marginTop: 0 }]} onPress={() => setChatOpen(true)} testID="ontrip-chat">
                  <Icon name="message" size={16} color={colors.text} />
                  <Text style={s.chatBtnText}>Melding</Text>
                </Pressable>
                <Pressable style={s.safetyBtn} onPress={() => setSafetyOpen(true)} testID="ontrip-safety">
                  <Icon name="shield" size={16} color={colors.accent} />
                  <Text style={s.safetyBtnText}>Sikkerhet</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        )}
      </View>

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

function Metric({ label, value }: { label: string; value: string }) {
  const s = useStyles();
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={s.metricValue}>{value}</Text>
    </View>
  );
}

function Action({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID: string }) {
  const s = useStyles();
  return (
    <Pressable style={s.action} onPress={onPress} testID={testID} accessibilityRole="button" accessibilityLabel={label}>
      <Icon name={icon} size={18} color={colors.accent} />
      <Text style={s.actionText}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  loading: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  offlineIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.accentSoft, borderWidth: 1, borderColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  loadErrorTitle: { color: c.text, fontFamily: font.display, fontSize: 20, marginTop: 16, textAlign: 'center' },
  loadErrorSub: { color: c.textMuted, fontSize: 13, lineHeight: 19, marginTop: 8, textAlign: 'center' },
  retryBtn: { minHeight: 50, borderRadius: 14, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, marginTop: 18 },
  retryBtnText: { color: c.accentOn, fontFamily: font.bold, fontSize: 14 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(5,10,15,0.88)', borderWidth: 1, borderColor: c.line },
  statusPill: { backgroundColor: 'rgba(5,10,15,0.88)', borderWidth: 1, borderColor: c.line, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
  statusText: { color: c.text, fontFamily: font.semibold, fontSize: 14 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: c.line, paddingHorizontal: 20, paddingTop: 10 },
  handle: { alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: c.lineStrong, marginBottom: 14 },
  networkBanner: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.warning + '12', borderWidth: 1, borderColor: c.warning, borderRadius: 10, paddingHorizontal: 11, marginBottom: 12 },
  networkDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.warning },
  networkText: { color: c.textSecondary, fontSize: 11, flex: 1 },
  radar: { width: 72, height: 72, borderRadius: 36, backgroundColor: c.accentSoft, borderWidth: 1, borderColor: c.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  bigTitle: { color: c.text, fontFamily: font.display, fontSize: 22 },
  sub: { color: c.textMuted, fontSize: 14, marginTop: 4, textAlign: 'center' },
  destBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.cardSubtle, borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 14, marginTop: 16, alignSelf: 'stretch' },
  destText: { color: c.text, fontSize: 14, flex: 1 },
  destPrice: { color: c.text, fontFamily: font.mono, fontSize: 16 },
  cancelLink: { color: c.textMuted, fontSize: 14, textDecorationLine: 'underline' },
  finalIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: c.dangerSoft, borderWidth: 1, borderColor: c.danger, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  finalIconDriver: { backgroundColor: c.accentSoft, borderColor: c.accent },
  recoveryCopy: { color: c.textSecondary, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 12, paddingHorizontal: 12 },
  homeBtn: { marginTop: 20, minHeight: 52, backgroundColor: c.accent, borderRadius: 14, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center' },
  homeBtnText: { color: c.accentOn, fontFamily: font.bold, fontSize: 15 },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  etaBadge: { width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentSoft, borderWidth: 1, borderColor: c.accent },
  etaNum: { color: c.text, fontFamily: font.display, fontSize: 26 },
  etaMin: { color: c.accent, fontFamily: font.bold, fontSize: 9, letterSpacing: 2, marginTop: 2 },
  overline: { color: c.accent, fontFamily: font.bold, fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase' },
  driverName: { color: c.text, fontFamily: font.semibold, fontSize: 16, marginTop: 4 },
  driverCar: { color: c.textMuted, fontSize: 13, marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ratingText: { color: c.textMuted, fontSize: 12 },
  driverDistance: { color: c.textMuted, fontSize: 12 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  action: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line },
  actionText: { color: c.text, fontFamily: font.medium, fontSize: 12 },
  metrics: { flexDirection: 'row', alignItems: 'center', marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: c.line },
  divider: { width: 1, height: 28, backgroundColor: c.line },
  metricLabel: { color: c.textMuted, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', textAlign: 'center' },
  metricValue: { color: c.text, fontFamily: font.mono, fontSize: 15, textAlign: 'center', marginTop: 4 },
  chatBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, minHeight: 48, borderRadius: 14, backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line },
  chatBtnText: { color: c.text, fontFamily: font.medium, fontSize: 14 },
  onTripActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  safetyBtn: { minHeight: 48, flex: 0.8, borderRadius: 14, borderWidth: 1, borderColor: c.accent, backgroundColor: c.accentSoft, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  safetyBtnText: { color: c.text, fontFamily: font.medium, fontSize: 14 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.68)' },
  safetySheet: { backgroundColor: c.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: c.line, padding: 20, paddingBottom: 34 },
  safetyHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  safetyOverline: { color: c.accent, fontFamily: font.bold, fontSize: 10, letterSpacing: 1.4 },
  safetyTitle: { color: c.text, fontFamily: font.display, fontSize: 22, marginTop: 3 },
  safetyCopy: { color: c.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 12, marginBottom: 14 },
  emergencyAction: { minHeight: 66, borderRadius: 16, borderWidth: 1, borderColor: c.danger, backgroundColor: c.dangerSoft, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, marginTop: 8 },
  safetyAction: { minHeight: 66, borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: c.cardSubtle, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, marginTop: 8 },
  safetyActionTitle: { color: c.text, fontFamily: font.semibold, fontSize: 14 },
  safetyActionSub: { color: c.textMuted, fontSize: 11, marginTop: 3 },
}));