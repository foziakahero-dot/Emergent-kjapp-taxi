import React, { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon, IconName } from '@/src/components/Icon';
import { Map } from '@/src/components/Map';
import { ChatSheet } from '@/src/components/ChatSheet';
import { Loader } from '@/src/components/ui';
import { tripsApi } from '@/src/lib/api';
import { kr } from '@/src/lib/format';

const META: Record<string, { title: string; sub: string }> = {
  searching: { title: 'Søker sjåfør', sub: 'Vi varsler alle ledige sjåfører nær deg' },
  booking: { title: 'Bestiller for deg', sub: 'Vi finner nærmeste sjåfør og bestiller turen for deg' },
  driver_on_way: { title: 'Sjåfør på vei', sub: 'kommer om noen minutter' },
  at_pickup: { title: 'Sjåføren er fremme', sub: 'Kom ut når du er klar' },
  in_trip: { title: 'Turen din', sub: 'Turen pågår' },
  arrived: { title: 'Du er fremme!', sub: 'Takk for turen' },
  cancelled: { title: 'Turen ble avbrutt', sub: '' },
  cancelled_by_driver: { title: 'Sjåføren avbrøt', sub: 'Bestill på nytt' },
};

const LIVE_DRIVER_STATES = ['driver_on_way', 'at_pickup', 'in_trip'];
const PASSENGER_CANCELLABLE_STATES = new Set(['searching', 'booking', 'driver_on_way', 'at_pickup']);

export default function BookingFlow() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const router = useRouter();
  const [trip, setTrip] = useState<any>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const nav = useRef(false);

  useEffect(() => {
    let mounted = true;
    const fetchTrip = async () => {
      try {
        const t = await tripsApi.get(tripId!);
        if (!mounted) return;
        setTrip(t);
        if (t.status === 'arrived' && !nav.current) {
          nav.current = true;
          try { await tripsApi.complete(tripId!); } catch {}
          router.replace(`/receipt/${tripId}`);
        }
      } catch {}
    };
    fetchTrip();
    const i = setInterval(fetchTrip, 2500);
    return () => { mounted = false; clearInterval(i); };
  }, [tripId, router]);

  const doCancel = async () => {
    if (!PASSENGER_CANCELLABLE_STATES.has(trip?.status)) {
      Alert.alert('Turen kan ikke avbrytes her', 'Når turen har startet må eventuell hjelp eller avslutning håndteres med sjåføren eller KJAPP support.');
      return;
    }
    try {
      await tripsApi.cancel(tripId!);
      router.replace('/(app)/home');
    } catch {
      Alert.alert('Kunne ikke avbryte turen', 'Turen kan ha endret status. Oppdater og prøv igjen.');
    }
  };

  const cancel = () => {
    if (!PASSENGER_CANCELLABLE_STATES.has(trip?.status)) {
      Alert.alert('Turen er allerede i gang', 'En aktiv tur kan ikke avbrytes fra denne skjermen.');
      return;
    }
    Alert.alert('Avbryte turen?', 'Er du sikker på at du vil avbryte?', [
      { text: 'Behold turen', style: 'cancel' },
      { text: 'Avbryt tur', style: 'destructive', onPress: doCancel },
    ]);
  };

  if (!trip) {
    return <View style={s.loading}><Loader label="Åpner turen din…" /></View>;
  }

  const meta = META[trip.status] || META.searching;
  const route = trip.geometry?.coordinates || [[trip.pickup_lng, trip.pickup_lat], [trip.dropoff_lng, trip.dropoff_lat]];
  const driverLocationAge = trip.driver_location_at ? Date.now() - new Date(trip.driver_location_at).getTime() : Infinity;
  const freshDriverGps = LIVE_DRIVER_STATES.includes(trip.status)
    && trip.driver_lat != null
    && trip.driver_lng != null
    && driverLocationAge < 90000;
  const gpsStale = LIVE_DRIVER_STATES.includes(trip.status) && !freshDriverGps;
  const activeCar = freshDriverGps
    ? { lat: trip.driver_lat, lng: trip.driver_lng, heading: trip.driver_heading || 0 }
    : null;
  const isFinal = ['cancelled', 'cancelled_by_driver'].includes(trip.status);
  const canCancel = PASSENGER_CANCELLABLE_STATES.has(trip.status);
  const driverPhone = String(trip.driver?.phone || '').replace(/[^+\d]/g, '');
  const paymentLabel = trip.payment_method === 'vipps' ? 'Vipps' : 'Kort';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Map
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        pickup={{ lat: trip.pickup_lat, lng: trip.pickup_lng }}
        dropoff={{ lat: trip.dropoff_lat, lng: trip.dropoff_lng }}
        route={route}
        activeCar={activeCar}
        testID="booking-map"
      />

      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        {canCancel ? (
          <Pressable onPress={cancel} style={s.iconBtn} testID="trip-cancel">
            <Icon name="x" size={20} color={colors.text} />
          </Pressable>
        ) : <View style={{ width: 44, height: 44 }} />}
        <View style={s.statusPill}>
          <Text style={s.statusText} testID="customer-trip-status">{meta.title}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={s.handle} />

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
            <Text style={s.bigTitle}>{meta.title}</Text>
            <Text style={s.sub}>{meta.sub}</Text>
            <Pressable onPress={() => router.replace('/(app)/home')} style={s.homeBtn} testID="booking-home">
              <Text style={s.homeBtnText}>Tilbake til hjem</Text>
            </Pressable>
          </View>
        ) : trip.status === 'at_pickup' ? (
          <View testID="customer-at-pickup">
            <View style={s.driverRow}>
              <View style={s.arrivedBadge}>
                <Icon name="map-pin" size={26} color={colors.online} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.overlineOnline}>SJÅFØREN ER FREMME</Text>
                <Text style={s.driverName} numberOfLines={1}>{trip.driver?.name || 'Din sjåfør'}</Text>
                <Text style={s.driverCar} numberOfLines={1}>{(trip.driver?.car || 'Bil')} · {trip.driver?.plate || ''}</Text>
                <Text style={s.arrivedHint}>Kom ut når du er klar</Text>
                {gpsStale ? <Text style={s.gpsHint} testID="driver-gps-stale">Venter på GPS-signal fra sjåføren…</Text> : null}
              </View>
            </View>
            <ActionRow driverPhone={driverPhone} onChat={() => setChatOpen(true)} />
          </View>
        ) : trip.status === 'in_trip' ? (
          <View>
            <View style={s.tripHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.overline}>TUREN PÅGÅR</Text>
                <Text style={s.tripDestination} numberOfLines={1}>{trip.dropoff_address}</Text>
              </View>
              <View style={s.tripPriceCol}>
                <Text style={s.tripPrice}>{kr(trip.price)}</Text>
                <Text style={s.estimated}>Estimert</Text>
              </View>
            </View>
            {gpsStale ? <Text style={s.gpsHint} testID="driver-gps-stale">Venter på fersk GPS-posisjon fra sjåføren…</Text> : null}
            <View style={s.metrics}>
              <Metric label="Avstand" value={`${trip.distance_km} km`} />
              <View style={s.divider} />
              <Metric label="Tid" value={`${trip.duration_min} min`} />
              <View style={s.divider} />
              <Metric label="Betaling" value={paymentLabel} />
            </View>
            <Pressable style={s.chatBtn} onPress={() => setChatOpen(true)} testID="ontrip-chat">
              <Icon name="message" size={16} color={colors.text} />
              <Text style={s.chatBtnText}>Melding til sjåfør</Text>
            </Pressable>
          </View>
        ) : (
          <View>
            <View style={s.driverRow}>
              <View style={s.etaBadge}>
                <Text style={s.etaNum}>{trip.eta_min || 2}</Text>
                <Text style={s.etaMin}>MIN</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.overline}>{meta.title}</Text>
                <Text style={s.driverName} numberOfLines={1}>{trip.driver?.name || 'Din sjåfør'}</Text>
                <Text style={s.driverCar} numberOfLines={1}>{(trip.driver?.car || 'Bil')} · {trip.driver?.plate || ''}</Text>
                {trip.driver?.rating != null ? (
                  <View style={s.ratingRow}>
                    <Icon name="star" size={12} color={colors.accent} fill={colors.accent} />
                    <Text style={s.ratingText}>{trip.driver.rating}</Text>
                  </View>
                ) : <Text style={s.ratingText}>Ny sjåfør</Text>}
                {gpsStale ? <Text style={s.gpsHint} testID="driver-gps-stale">Venter på GPS-signal fra sjåføren…</Text> : null}
              </View>
            </View>
            <ActionRow driverPhone={driverPhone} onChat={() => setChatOpen(true)} />
          </View>
        )}
      </View>

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

function ActionRow({ driverPhone, onChat }: { driverPhone: string; onChat: () => void }) {
  const s = useStyles();
  return (
    <View style={s.actions}>
      {driverPhone ? <Action icon="phone" label="Ring" testID="action-call" onPress={() => Linking.openURL(`tel:${driverPhone}`)} /> : null}
      <Action icon="message" label="Melding" testID="action-message" onPress={onChat} />
      <Action icon="shield" label="Sikkerhet" testID="action-safety" onPress={() => Linking.openURL('tel:112')} />
    </View>
  );
}

function Action({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID: string }) {
  const s = useStyles();
  return (
    <Pressable style={s.action} onPress={onPress} testID={testID}>
      <Icon name={icon} size={18} color={colors.accent} />
      <Text style={s.actionText}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  loading: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(12,18,22,0.85)', borderWidth: 1, borderColor: c.line },
  statusPill: { backgroundColor: 'rgba(12,18,22,0.85)', borderWidth: 1, borderColor: c.line, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 11 },
  statusText: { color: c.text, fontFamily: font.display, fontSize: 16 },
  sheet: { position: 'absolute', left: 14, right: 14, bottom: 10, backgroundColor: 'rgba(12,18,22,0.96)', borderRadius: 28, borderWidth: 1, borderColor: c.line, paddingHorizontal: 20, paddingTop: 10 },
  handle: { alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: c.lineStrong, marginBottom: 16 },
  radar: { width: 72, height: 72, borderRadius: 36, backgroundColor: c.accentSoft, borderWidth: 1, borderColor: 'rgba(203,163,101,0.3)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  bigTitle: { color: c.text, fontFamily: font.display, fontSize: 22 },
  sub: { color: c.textMuted, fontSize: 14, marginTop: 4, textAlign: 'center' },
  destBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.cardSubtle, borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 14, marginTop: 16, alignSelf: 'stretch' },
  destText: { color: c.text, fontSize: 14, flex: 1 },
  destPrice: { color: c.text, fontFamily: font.display, fontSize: 16 },
  cancelLink: { color: c.textMuted, fontSize: 14, textDecorationLine: 'underline' },
  homeBtn: { marginTop: 20, backgroundColor: c.accent, borderRadius: 999, paddingHorizontal: 28, paddingVertical: 14 },
  homeBtnText: { color: c.accentOn, fontWeight: '700', fontSize: 15 },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  etaBadge: { width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentSoft, borderWidth: 1, borderColor: 'rgba(203,163,101,0.3)' },
  arrivedBadge: { width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center', backgroundColor: c.onlineSoft, borderWidth: 1, borderColor: 'rgba(47,224,140,0.35)' },
  etaNum: { color: c.text, fontFamily: font.display, fontSize: 26 },
  etaMin: { color: c.accent, fontSize: 9, letterSpacing: 2, marginTop: 2 },
  overline: { color: c.accent, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },
  overlineOnline: { color: c.online, fontSize: 10, letterSpacing: 2 },
  driverName: { color: c.text, fontSize: 16, fontWeight: '600', marginTop: 4 },
  driverCar: { color: c.textMuted, fontSize: 13, marginTop: 2 },
  arrivedHint: { color: c.textMuted, fontSize: 12, marginTop: 4 },
  gpsHint: { color: c.textMuted, fontSize: 11, marginTop: 5 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ratingText: { color: c.textMuted, fontSize: 12, marginTop: 3 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  action: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: 16, backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line },
  actionText: { color: c.text, fontSize: 12 },
  tripHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  tripDestination: { color: c.text, fontSize: 15, fontWeight: '600', marginTop: 5 },
  tripPriceCol: { alignItems: 'flex-end' },
  tripPrice: { color: c.text, fontFamily: font.display, fontSize: 27 },
  estimated: { color: c.textMuted, fontSize: 11, marginTop: 2 },
  metrics: { flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingTop: 15, borderTopWidth: 1, borderTopColor: c.line },
  divider: { width: 1, height: 28, backgroundColor: c.line },
  metricLabel: { color: c.textMuted, fontSize: 10, letterSpacing: 1.3, textTransform: 'uppercase', textAlign: 'center' },
  metricValue: { color: c.text, fontFamily: font.mono, fontSize: 14, textAlign: 'center', marginTop: 4 },
  chatBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, paddingVertical: 12, borderRadius: 14, backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line },
  chatBtnText: { color: c.text, fontSize: 14 },
}));