import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon } from '@/src/components/Icon';
import { Map } from '@/src/components/Map';
import { ChatSheet } from '@/src/components/ChatSheet';
import { useAuth } from '@/src/context/AuthContext';
import { driverApi } from '@/src/lib/api';
import { playIncomingTripAlert } from '@/src/lib/notifications';
import { apiError, kr } from '@/src/lib/format';

type Loc = { lat: number; lng: number; heading?: number };

function hoursLabel(min?: number) {
  const m = min || 0;
  if (m >= 60) return `${Math.floor(m / 60)}t ${m % 60}m`;
  return `${m}m`;
}

function tripStage(status?: string) {
  if (status === 'driver_on_way') return { label: 'PÅ VEI TIL KUNDEN', step: 1 };
  if (status === 'at_pickup') return { label: 'FREMME HOS KUNDEN', step: 2 };
  if (status === 'in_trip') return { label: 'TUR PÅGÅR', step: 3 };
  if (status === 'arrived') return { label: 'FREMME', step: 4 };
  return { label: 'AKTIV TUR', step: 1 };
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
  const watch = useRef<Location.LocationSubscription | null>(null);
  const lastAlertedOffer = useRef<string | null>(null);

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
      if (typeof r?.online === 'boolean') setOnline(r.online);
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
    (async () => {
      if (!online) {
        if (watch.current) { watch.current.remove(); watch.current = null; }
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Slå på posisjon for å dele plasseringen din med kunder.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const p: Loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, heading: pos.coords.heading || 0 };
      setLoc(p);
      driverApi.location(p.lat, p.lng, p.heading || 0, pos.coords.speed || 0).catch(() => {});
      watch.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 15, timeInterval: 6000 },
        (u) => {
          const np: Loc = { lat: u.coords.latitude, lng: u.coords.longitude, heading: u.coords.heading || 0 };
          setLoc(np);
          driverApi.location(np.lat, np.lng, np.heading || 0, u.coords.speed || 0).catch(() => {});
        },
      );
    })();
    return () => { if (watch.current) { watch.current.remove(); watch.current = null; } };
  }, [online]);

  const firstOffer = pending[0];

  // Foreground safety net: poll results still produce a loud local alert once per offer.
  // When remote FCM is configured, locked/background devices are handled by the backend push sender.
  useEffect(() => {
    const id = firstOffer?.trip_id;
    if (!online || !id || current) return;
    if (lastAlertedOffer.current === id) return;
    lastAlertedOffer.current = id;
    playIncomingTripAlert(firstOffer).catch(() => {});
  }, [firstOffer?.trip_id, online, current?.trip_id]);

  useEffect(() => {
    if (!firstOffer?.trip_id) lastAlertedOffer.current = null;
  }, [firstOffer?.trip_id]);

  const toggleOnline = async (v: boolean) => {
    setError('');
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      await driverApi.online(v);
      setOnline(v);
      if (v) poll();
    } catch (e) { setError(apiError(e)); }
    finally { setBusy(false); }
  };

  const accept = async (tripId: string) => {
    setBusy(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try { await driverApi.accept(tripId); await poll(); } catch (e) { setError(apiError(e)); }
    finally { setBusy(false); }
  };

  const decline = async (tripId: string) => {
    Haptics.selectionAsync().catch(() => {});
    try { await driverApi.decline(tripId); setPending((p) => p.filter((t) => t.trip_id !== tripId)); } catch {}
  };

  const advance = async () => {
    if (!current) return;
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      if (current.status === 'driver_on_way') await driverApi.atPickup(current.trip_id);
      else if (current.status === 'at_pickup') await driverApi.start(current.trip_id);
      else if (current.status === 'in_trip') await driverApi.arrive(current.trip_id);
      await poll();
    } catch (e) { setError(apiError(e)); }
    finally { setBusy(false); }
  };

  const actionLabel = current?.status === 'driver_on_way' ? 'Jeg er fremme'
    : current?.status === 'at_pickup' ? 'Start turen'
    : current?.status === 'in_trip' ? 'Fullfør turen'
    : '';

  const stage = tripStage(current?.status);
  const mapPickup = current ? { lat: current.pickup_lat, lng: current.pickup_lng } : null;
  const mapDropoff = current && current.status === 'in_trip'
    ? { lat: current.dropoff_lat, lng: current.dropoff_lng }
    : (current ? { lat: current.pickup_lat, lng: current.pickup_lng } : null);
  const mapRoute = current?.geometry?.coordinates;

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

      <View pointerEvents="none" style={s.topShade} />

      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={s.brandPill}>
          <Text style={s.brand}>KJ<Text style={{ color: colors.online }}>A</Text>PP</Text>
          <View style={s.driverLine}>
            <View style={[s.statusDot, { backgroundColor: online ? colors.online : colors.textMuted }]} />
            <Text style={s.driverLabel}>{online ? 'DRIVER · ONLINE' : 'DRIVER · OFFLINE'}</Text>
          </View>
        </View>

        <Pressable
          onPress={() => toggleOnline(!online)}
          disabled={busy}
          testID="driver-online-toggle"
          style={({ pressed }) => [s.onlineCapsule, online && s.onlineCapsuleOn, pressed && { transform: [{ scale: 0.97 }] }]}
        >
          {busy ? <ActivityIndicator color={online ? colors.online : colors.text} size="small" /> : (
            <>
              <Icon name="power" size={16} color={online ? colors.online : colors.textMuted} />
              <Text style={[s.onlineText, online && { color: colors.online }]}>{online ? 'ONLINE' : 'OFFLINE'}</Text>
            </>
          )}
        </Pressable>
      </View>

      <View style={[s.commandSheet, { bottom: Math.max(insets.bottom, 10) + 72 }]}>
        <View style={s.handle} />
        {error ? <Text style={s.error} testID="driver-error">{error}</Text> : null}

        {current ? (
          <View testID="driver-active-trip">
            <View style={s.contextHeader}>
              <View>
                <Text style={s.eyebrow}>{stage.label}</Text>
                <Text style={s.contextTitle}>{current.customer_name || 'Aktiv tur'}</Text>
              </View>
              <Text style={s.price}>{kr(current.price)}</Text>
            </View>

            <View style={s.progressRow}>
              {[1, 2, 3, 4].map((n) => (
                <View key={n} style={[s.progressSegment, n <= stage.step && s.progressSegmentActive]} />
              ))}
            </View>

            <View style={s.routeCard}>
              <View style={s.epRow}><View style={s.beacon} /><Text style={s.epText} numberOfLines={1}>{current.pickup_address}</Text></View>
              <View style={s.epLine} />
              <View style={s.epRow}><View style={s.square} /><Text style={s.epText} numberOfLines={1}>{current.dropoff_address}</Text></View>
            </View>

            <View style={s.tripActions}>
              <Pressable style={s.iconAction} onPress={() => setChatOpen(true)} testID="driver-chat">
                <Icon name="message" size={18} color={colors.text} />
                <Text style={s.iconActionText}>Melding</Text>
              </Pressable>
              {actionLabel ? (
                <Pressable style={s.primaryAction} onPress={advance} disabled={busy} testID="driver-advance">
                  {busy ? <ActivityIndicator color="#04120A" /> : <Text style={s.primaryActionText}>{actionLabel}</Text>}
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : firstOffer && online ? (
          <View testID={`driver-offer-${firstOffer.trip_id}`}>
            <View style={s.contextHeader}>
              <View>
                <Text style={s.eyebrow}>NY TURFORESPØRSEL</Text>
                <Text style={s.contextTitle}>Klar til å hente?</Text>
              </View>
              <Text style={s.price}>{kr(firstOffer.price)}</Text>
            </View>

            <View style={s.routeCard}>
              <View style={s.epRow}><View style={s.beacon} /><Text style={s.epText} numberOfLines={1}>{firstOffer.pickup_address}</Text></View>
              <View style={s.epLine} />
              <View style={s.epRow}><View style={s.square} /><Text style={s.epText} numberOfLines={1}>{firstOffer.dropoff_address}</Text></View>
            </View>

            <View style={s.offerMetaRow}>
              <View><Text style={s.metaLabel}>DISTANSE</Text><Text style={s.metaValue}>{firstOffer.distance_km} km</Text></View>
              <View><Text style={s.metaLabel}>TID</Text><Text style={s.metaValue}>{firstOffer.duration_min} min</Text></View>
              <View><Text style={s.metaLabel}>PRIS</Text><Text style={[s.metaValue, { color: colors.online }]}>{kr(firstOffer.price)}</Text></View>
            </View>

            <View style={s.offerBtns}>
              <Pressable style={s.declineBtn} onPress={() => decline(firstOffer.trip_id)} testID={`driver-decline-${firstOffer.trip_id}`}>
                <Text style={s.declineText}>Avslå</Text>
              </Pressable>
              <Pressable style={s.acceptBtn} onPress={() => accept(firstOffer.trip_id)} disabled={busy} testID={`driver-accept-${firstOffer.trip_id}`}>
                {busy ? <ActivityIndicator color="#04120A" /> : <Text style={s.acceptText}>Godta tur</Text>}
              </Pressable>
            </View>
          </View>
        ) : (
          <View>
            <View style={s.contextHeader}>
              <View>
                <Text style={s.eyebrow}>{online ? 'DU ER TILGJENGELIG' : 'KLAR FOR SKIFT'}</Text>
                <Text style={s.contextTitle}>{online ? 'Venter på neste tur' : `Hei, ${user?.fullName?.split(' ')[0] || 'sjåfør'}`}</Text>
              </View>
              {online ? <View style={s.liveBadge}><View style={s.liveDot} /><Text style={s.liveText}>LIVE</Text></View> : null}
            </View>

            <View style={s.summaryRow}>
              <Stat label="TURER" value={String(summary?.trips ?? 0)} s={s} />
              <View style={s.vDivider} />
              <Stat label="INNTEKT" value={kr(summary?.income ?? 0)} s={s} />
              <View style={s.vDivider} />
              <Stat label="ONLINE" value={hoursLabel(summary?.online_minutes)} s={s} />
            </View>

            {online ? (
              <View style={s.waiting} testID="driver-waiting">
                <View style={s.radar}><Icon name="navigation" size={21} color={colors.online} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.waitTitle}>Søker etter turer i nærheten</Text>
                  <Text style={s.waitSub}>Du får lyd og varsel når en ny tur blir tilbudt.</Text>
                </View>
              </View>
            ) : (
              <Pressable style={s.goOnline} onPress={() => toggleOnline(true)} disabled={busy} testID="driver-go-online">
                {busy ? <ActivityIndicator color="#04120A" /> : (
                  <><Icon name="power" size={18} color="#04120A" /><Text style={s.goOnlineText}>Gå online</Text></>
                )}
              </Pressable>
            )}
          </View>
        )}
      </View>

      {current ? (
        <ChatSheet tripId={current.trip_id} role="driver" visible={chatOpen} onClose={() => setChatOpen(false)} peerName="Kunde" />
      ) : null}
    </View>
  );
}

function Stat({ label, value, s }: any) {
  return <View style={{ flex: 1, alignItems: 'center' }}><Text style={s.statValue}>{value}</Text><Text style={s.statLabel}>{label}</Text></View>;
}

const useStyles = makeStyles((c) => ({
  topShade: { position: 'absolute', top: 0, left: 0, right: 0, height: 150, backgroundColor: 'rgba(0,0,0,0.22)' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingBottom: 8 },
  brandPill: { backgroundColor: 'rgba(3,6,7,0.92)', borderRadius: 22, paddingHorizontal: 15, paddingVertical: 8, borderWidth: 1, borderColor: c.lineStrong },
  brand: { color: c.text, fontFamily: font.display, fontSize: 18, letterSpacing: 1 },
  driverLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  driverLabel: { color: c.textMuted, fontSize: 7, fontWeight: '800', letterSpacing: 1.6 },
  onlineCapsule: { minWidth: 102, height: 46, paddingHorizontal: 14, borderRadius: 23, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(3,6,7,0.92)', borderWidth: 1, borderColor: c.lineStrong },
  onlineCapsuleOn: { borderColor: 'rgba(47,224,140,0.45)', backgroundColor: 'rgba(8,30,20,0.90)' },
  onlineText: { color: c.textMuted, fontSize: 10, letterSpacing: 1.6, fontWeight: '900' },
  commandSheet: { position: 'absolute', left: 10, right: 10, backgroundColor: 'rgba(7,12,15,0.97)', borderRadius: 28, borderWidth: 1, borderColor: c.lineStrong, paddingHorizontal: 18, paddingTop: 9, paddingBottom: 18, shadowColor: '#000', shadowOpacity: 0.38, shadowRadius: 24, shadowOffset: { width: 0, height: -8 }, elevation: 18 },
  handle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: c.lineStrong, marginBottom: 14 },
  error: { color: c.danger, fontSize: 12, marginBottom: 10 },
  contextHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 13 },
  eyebrow: { color: c.online, fontSize: 9, fontWeight: '900', letterSpacing: 2 },
  contextTitle: { color: c.text, fontFamily: font.display, fontSize: 23, marginTop: 3 },
  price: { color: c.text, fontFamily: font.mono, fontSize: 20 },
  progressRow: { flexDirection: 'row', gap: 5, marginBottom: 12 },
  progressSegment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: c.lineStrong },
  progressSegmentActive: { backgroundColor: c.online },
  routeCard: { backgroundColor: 'rgba(255,255,255,0.035)', borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 14 },
  epRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  epLine: { width: 1, height: 14, backgroundColor: c.lineStrong, marginLeft: 5, marginVertical: 3 },
  beacon: { width: 11, height: 11, borderRadius: 6, backgroundColor: c.online, shadowColor: c.online, shadowOpacity: 0.6, shadowRadius: 7 },
  square: { width: 11, height: 11, borderRadius: 2, backgroundColor: c.text },
  epText: { color: c.text, fontSize: 13, flex: 1 },
  tripActions: { flexDirection: 'row', gap: 10, marginTop: 13 },
  iconAction: { width: 92, height: 54, borderRadius: 17, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: 'rgba(255,255,255,0.045)', borderWidth: 1, borderColor: c.line },
  iconActionText: { color: c.textSecondary, fontSize: 10 },
  primaryAction: { flex: 1, height: 54, borderRadius: 17, backgroundColor: c.online, alignItems: 'center', justifyContent: 'center', shadowColor: c.online, shadowOpacity: 0.25, shadowRadius: 16 },
  primaryActionText: { color: '#04120A', fontSize: 15, fontWeight: '800' },
  offerMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 13, paddingHorizontal: 4 },
  metaLabel: { color: c.textMuted, fontSize: 8, letterSpacing: 1.4, fontWeight: '800' },
  metaValue: { color: c.text, fontFamily: font.mono, fontSize: 13, marginTop: 3 },
  offerBtns: { flexDirection: 'row', gap: 10, marginTop: 14 },
  declineBtn: { flex: 1, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 17, borderWidth: 1, borderColor: c.lineStrong },
  declineText: { color: c.textSecondary, fontSize: 14, fontWeight: '600' },
  acceptBtn: { flex: 2, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: c.online },
  acceptText: { color: '#04120A', fontSize: 14, fontWeight: '800' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: c.onlineSoft },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.online },
  liveText: { color: c.online, fontSize: 8, letterSpacing: 1.2, fontWeight: '900' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 18, borderWidth: 1, borderColor: c.line, paddingVertical: 14 },
  vDivider: { width: 1, height: 30, backgroundColor: c.line },
  statValue: { color: c.text, fontFamily: font.mono, fontSize: 15 },
  statLabel: { color: c.textMuted, fontSize: 8, marginTop: 4, letterSpacing: 1.2 },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 13, padding: 12, borderRadius: 18, backgroundColor: 'rgba(47,224,140,0.055)', borderWidth: 1, borderColor: 'rgba(47,224,140,0.16)' },
  radar: { width: 48, height: 48, borderRadius: 24, backgroundColor: c.onlineSoft, borderWidth: 1, borderColor: 'rgba(47,224,140,0.28)', alignItems: 'center', justifyContent: 'center' },
  waitTitle: { color: c.text, fontSize: 13, fontWeight: '700' },
  waitSub: { color: c.textMuted, fontSize: 10, marginTop: 3, lineHeight: 15 },
  goOnline: { flexDirection: 'row', gap: 9, marginTop: 14, height: 56, borderRadius: 999, backgroundColor: c.online, alignItems: 'center', justifyContent: 'center', shadowColor: c.online, shadowOpacity: 0.25, shadowRadius: 18 },
  goOnlineText: { color: '#04120A', fontSize: 15, fontWeight: '800' },
}));
