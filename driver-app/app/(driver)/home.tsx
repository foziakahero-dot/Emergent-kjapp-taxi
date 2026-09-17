import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon } from '@/src/components/Icon';
import { Map } from '@/src/components/Map';
import { ChatSheet } from '@/src/components/ChatSheet';
import { useAuth } from '@/src/context/AuthContext';
import { driverApi } from '@/src/lib/api';
import { apiError, kr } from '@/src/lib/format';
import {
  getDriverLocationPermissionState,
  requestDriverBackgroundLocationPermission,
  requestDriverForegroundLocationPermission,
  startDriverBackgroundLocation,
  stopDriverBackgroundLocation,
} from '@/src/lib/nativeRuntime';

type Loc = { lat: number; lng: number; heading?: number };

function hoursLabel(min?: number) {
  const m = min || 0;
  if (m >= 60) return `${Math.floor(m / 60)}t ${m % 60}m`;
  return `${m}m`;
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
  const [backgroundPermissionOpen, setBackgroundPermissionOpen] = useState(false);
  const watch = useRef<Location.LocationSubscription | null>(null);
  const gpsBlocked = useRef(false);

  const poll = useCallback(async () => {
    try {
      const cur = await driverApi.current();
      setCurrent(cur?.trip || cur || null);
    } catch { setCurrent(null); }
    try {
      const p = await driverApi.pending();
      setPending(p?.trips || p?.pending || (Array.isArray(p) ? p : []));
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
        await stopDriverBackgroundLocation();
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
        const { status } = await Location.getForegroundPermissionsAsync();
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
        driverApi.location(p.lat, p.lng, p.heading || 0, pos.coords.speed || 0).catch(() => {});

        const subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 15, timeInterval: 6000 },
          (u) => {
            if (!active) return;
            const np: Loc = { lat: u.coords.latitude, lng: u.coords.longitude, heading: u.coords.heading || 0 };
            setLoc(np);
            driverApi.location(np.lat, np.lng, np.heading || 0, u.coords.speed || 0).catch(() => {});
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
  }, [online]);

  const activateShift = async () => {
    await driverApi.online(true);
    setOnline(true);
    gpsBlocked.current = false;
    await startDriverBackgroundLocation();
    await poll();
  };

  const toggleOnline = async () => {
    const next = !online;
    setError('');
    setBusy(true);

    try {
      if (!next) {
        await driverApi.online(false);
        await stopDriverBackgroundLocation();
        setOnline(false);
        return;
      }

      const foregroundGranted = await requestDriverForegroundLocationPermission();
      if (!foregroundGranted) {
        setError('KJAPP trenger posisjon mens appen er i bruk før du kan gå online.');
        return;
      }

      const permissions = await getDriverLocationPermissionState();
      if (!permissions.background) {
        setBackgroundPermissionOpen(true);
        return;
      }

      await activateShift();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const grantBackgroundAndGoOnline = async () => {
    setBusy(true);
    setError('');
    try {
      const granted = await requestDriverBackgroundLocationPermission();
      if (!granted) {
        setError('Bakgrunnsposisjon er nødvendig når du er på skift, slik at KJAPP kan motta turer og holde posisjonen oppdatert når skjermen er låst.');
        return;
      }
      setBackgroundPermissionOpen(false);
      await activateShift();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const accept = async (tripId: string) => {
    setBusy(true);
    try { await driverApi.accept(tripId); await poll(); } catch (e) { setError(apiError(e)); }
    finally { setBusy(false); }
  };

  const decline = async (tripId: string) => {
    try { await driverApi.decline(tripId); setPending((p) => p.filter((t) => t.trip_id !== tripId)); } catch {}
  };

  const advance = async () => {
    if (!current) return;
    setBusy(true);
    try {
      if (current.status === 'driver_on_way') await driverApi.atPickup(current.trip_id);
      else if (current.status === 'at_pickup') await driverApi.start(current.trip_id);
      else if (current.status === 'in_trip') await driverApi.arrive(current.trip_id);
      await poll();
    } catch (e) { setError(apiError(e)); }
    finally { setBusy(false); }
  };

  const actionLabel =
    current?.status === 'driver_on_way' ? 'Jeg er fremme'
    : current?.status === 'at_pickup' ? 'Start turen'
    : current?.status === 'in_trip' ? 'Fullfør turen'
    : '';

  const firstOffer = pending[0];
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
            <Text style={s.offerMeta}>{firstOffer.distance_km} km · {firstOffer.duration_min} min estimert</Text>
            <View style={s.offerBtns}>
              <Pressable style={s.declineBtn} onPress={() => decline(firstOffer.trip_id)} testID={`driver-decline-${firstOffer.trip_id}`}>
                <Text style={s.declineText}>Avslå</Text>
              </Pressable>
              <Pressable style={s.acceptBtn} onPress={() => accept(firstOffer.trip_id)} disabled={busy} testID={`driver-accept-${firstOffer.trip_id}`}>
                {busy ? <ActivityIndicator color="#03120B" /> : <Text style={s.acceptText}>Godta tur</Text>}
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

      <Modal
        visible={backgroundPermissionOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setBackgroundPermissionOpen(false)}
      >
        <View style={s.permissionBackdrop}>
          <View style={s.permissionCard}>
            <View style={s.permissionIcon}><Icon name="map-pin" size={24} color={colors.online} /></View>
            <Text style={s.permissionTitle}>Tillat posisjon på skift</Text>
            <Text style={s.permissionBody}>
              Når du er ONLINE må KJAPP kunne oppdatere posisjonen din også når skjermen er låst eller du bruker navigasjon. Dette brukes bare for dispatch og aktive turer.
            </Text>
            <Pressable style={s.permissionPrimary} onPress={grantBackgroundAndGoOnline} disabled={busy} testID="driver-background-location-confirm">
              {busy ? <ActivityIndicator color="#03120B" /> : <Text style={s.permissionPrimaryText}>Fortsett</Text>}
            </Pressable>
            <Pressable style={s.permissionSecondary} onPress={() => setBackgroundPermissionOpen(false)} disabled={busy}>
              <Text style={s.permissionSecondaryText}>Ikke nå</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  tripActions: { flexDirection: 'row', gap: 10, marginTop: 15 },
  msgBtn: {
    minWidth: 112, height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: c.line,
  },
  msgBtnText: { color: c.text, fontSize: 14, fontWeight: '600' },
  action: { flex: 1, height: 56, borderRadius: 14, backgroundColor: c.online, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: '#03120B', fontSize: 16, fontWeight: '800' },
  offerMeta: { color: c.textMuted, fontSize: 12, marginTop: 10 },
  offerBtns: { flexDirection: 'row', gap: 10, marginTop: 14 },
  declineBtn: { flex: 1, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: c.lineStrong },
  declineText: { color: c.textSecondary, fontSize: 15, fontWeight: '600' },
  acceptBtn: { flex: 2, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: c.online },
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
  permissionBackdrop: { flex: 1, backgroundColor: 'rgba(3,6,7,0.82)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  permissionCard: { width: '100%', maxWidth: 420, borderRadius: 22, borderWidth: 1, borderColor: c.line, backgroundColor: c.driverCard, padding: 22 },
  permissionIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: c.onlineSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  permissionTitle: { color: c.text, fontFamily: font.display, fontSize: 22, fontWeight: '650' as any },
  permissionBody: { color: c.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 9 },
  permissionPrimary: { height: 54, borderRadius: 14, backgroundColor: c.online, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  permissionPrimaryText: { color: '#03120B', fontSize: 15, fontWeight: '800' },
  permissionSecondary: { height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  permissionSecondaryText: { color: c.textSecondary, fontSize: 14, fontWeight: '600' },
}));
