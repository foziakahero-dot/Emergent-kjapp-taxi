import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Switch, Text, View } from 'react-native';
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
  const watch = useRef<Location.LocationSubscription | null>(null);

  const poll = useCallback(async () => {
    try {
      const cur = await driverApi.current();
      setCurrent(cur?.trip || cur || null);
    } catch { setCurrent(null); }
    try {
      const p = await driverApi.pending();
      setPending(p?.trips || p?.pending || (Array.isArray(p) ? p : []));
    } catch { setPending([]); }
    driverApi.summary().then((r) => { setSummary(r); if (typeof r?.online === 'boolean') setOnline(r.online); }).catch(() => {});
  }, []);

  // Restore state (incl. active trip + online status) on focus / restart.
  useFocusEffect(
    useCallback(() => {
      poll();
      const i = setInterval(poll, 4000);
      return () => clearInterval(i);
    }, [poll]),
  );

  // location streaming while online
  useEffect(() => {
    (async () => {
      if (!online) {
        if (watch.current) { watch.current.remove(); watch.current = null; }
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setError('Slå på posisjon for å dele plasseringen din med kunder.'); return; }
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

  const toggleOnline = async (v: boolean) => {
    setError('');
    setBusy(true);
    try {
      await driverApi.online(v);
      setOnline(v);
      if (v) poll();
    } catch (e) { setError(apiError(e)); }
    finally { setBusy(false); }
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

  // Map framing
  const mapPickup = current ? { lat: current.pickup_lat, lng: current.pickup_lng } : null;
  const mapDropoff = current && current.status === 'in_trip' ? { lat: current.dropoff_lat, lng: current.dropoff_lng } : (current ? { lat: current.pickup_lat, lng: current.pickup_lng } : null);
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

      {/* Top bar */}
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={s.namePill}>
          <View style={[s.statusDot, { backgroundColor: online ? colors.online : colors.textMuted }]} />
          <View>
            <Text style={s.hello}>{user?.fullName?.split(' ')[0] || 'Sjåfør'}</Text>
            <Text style={s.role}>{online ? 'Pålogget' : 'Avlogget'}</Text>
          </View>
        </View>
        <View style={[s.onlineToggle, online && s.onlineToggleOn]}>
          {busy ? <ActivityIndicator color={colors.online} /> : (
            <>
              <Text style={[s.onlineLabel, online && { color: colors.online }]}>{online ? 'PÅ' : 'AV'}</Text>
              <Switch
                testID="driver-online-toggle"
                value={online}
                onValueChange={toggleOnline}
                trackColor={{ false: colors.line, true: colors.onlineSoft }}
                thumbColor={online ? colors.online : colors.textMuted}
              />
            </>
          )}
        </View>
      </View>

      {/* Bottom sheet */}
      <View style={[s.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={s.handle} />
        {error ? <Text style={s.error} testID="driver-error">{error}</Text> : null}

        {current ? (
          <View testID="driver-active-trip">
            <Text style={s.overlineOnline}>AKTIV TUR · {kr(current.price)}</Text>
            <View style={[s.epRow, { marginTop: 12 }]}><View style={s.beacon} /><Text style={s.epText} numberOfLines={1}>{current.pickup_address}</Text></View>
            <View style={s.epLine} />
            <View style={s.epRow}><View style={s.square} /><Text style={s.epText} numberOfLines={1}>{current.dropoff_address}</Text></View>
            <View style={s.tripActions}>
              <Pressable style={s.msgBtn} onPress={() => setChatOpen(true)} testID="driver-chat">
                <Icon name="message" size={16} color={colors.text} />
                <Text style={s.msgBtnText}>Melding</Text>
              </Pressable>
              {actionLabel ? (
                <Pressable style={s.action} onPress={advance} disabled={busy} testID="driver-advance">
                  {busy ? <ActivityIndicator color="#04120A" /> : <Text style={s.actionText}>{actionLabel}</Text>}
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : firstOffer && online ? (
          <View testID={`driver-offer-${firstOffer.trip_id}`}>
            <Text style={s.overlineOnline}>NY TUR · {kr(firstOffer.price)}</Text>
            <View style={[s.epRow, { marginTop: 12 }]}><View style={s.beacon} /><Text style={s.epText} numberOfLines={1}>{firstOffer.pickup_address}</Text></View>
            <View style={s.epLine} />
            <View style={s.epRow}><View style={s.square} /><Text style={s.epText} numberOfLines={1}>{firstOffer.dropoff_address}</Text></View>
            <Text style={s.offerMeta}>{firstOffer.distance_km} km · {firstOffer.duration_min} min</Text>
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
            <View style={s.summaryRow}>
              <Stat label="Turer i dag" value={String(summary?.trips ?? 0)} s={s} />
              <View style={s.vDivider} />
              <Stat label="Inntekt" value={kr(summary?.income ?? 0)} s={s} />
              <View style={s.vDivider} />
              <Stat label="Timer" value={hoursLabel(summary?.online_minutes)} s={s} />
            </View>
            {online ? (
              <View style={s.waiting} testID="driver-waiting">
                <View style={s.pulse}><Icon name="navigation" size={22} color={colors.online} /></View>
                <Text style={s.waitTitle}>Venter på turer…</Text>
                <Text style={s.waitSub}>Du er synlig for kunder i nærheten.</Text>
              </View>
            ) : (
              <Pressable style={s.goOnline} onPress={() => toggleOnline(true)} disabled={busy} testID="driver-go-online">
                {busy ? <ActivityIndicator color="#04120A" /> : (
                  <>
                    <Icon name="power" size={18} color="#04120A" />
                    <Text style={s.goOnlineText}>Gå på skift</Text>
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
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  namePill: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(10,15,19,0.92)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: c.line },
  statusDot: { width: 9, height: 9, borderRadius: 5 },
  hello: { color: c.text, fontFamily: font.display, fontSize: 17 },
  role: { color: c.textMuted, fontSize: 11 },
  onlineToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(10,15,19,0.92)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: c.line, minWidth: 88, justifyContent: 'center' },
  onlineToggleOn: { borderColor: c.online },
  onlineLabel: { color: c.textMuted, fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c.driverCard, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: c.line, paddingHorizontal: 20, paddingTop: 10 },
  handle: { alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: c.lineStrong, marginBottom: 14 },
  error: { color: c.danger, fontSize: 13, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 18, borderWidth: 1, borderColor: c.line, paddingVertical: 16 },
  vDivider: { width: 1, height: 32, backgroundColor: c.line },
  statValue: { color: c.text, fontFamily: font.mono, fontSize: 17 },
  statLabel: { color: c.textMuted, fontSize: 11, marginTop: 4 },
  overlineOnline: { color: c.online, fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  epRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  epLine: { width: 1, height: 14, backgroundColor: c.lineStrong, marginLeft: 5, marginVertical: 3 },
  beacon: { width: 11, height: 11, borderRadius: 6, backgroundColor: c.online },
  square: { width: 11, height: 11, borderRadius: 2, backgroundColor: c.text },
  epText: { color: c.text, fontSize: 14, flex: 1 },
  tripActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  msgBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 18, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: c.line },
  msgBtnText: { color: c.text, fontSize: 14 },
  action: { flex: 1, height: 52, borderRadius: 14, backgroundColor: c.online, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: '#04120A', fontSize: 16, fontWeight: '700' },
  offerMeta: { color: c.textMuted, fontSize: 13, marginTop: 10 },
  offerBtns: { flexDirection: 'row', gap: 12, marginTop: 14 },
  declineBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: c.line },
  declineText: { color: c.textSecondary, fontSize: 15 },
  acceptBtn: { flex: 2, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: c.online },
  acceptText: { color: '#04120A', fontSize: 15, fontWeight: '700' },
  waiting: { alignItems: 'center', paddingTop: 22, paddingBottom: 6 },
  pulse: { width: 60, height: 60, borderRadius: 30, backgroundColor: c.onlineSoft, borderWidth: 1, borderColor: 'rgba(47,224,140,0.3)', alignItems: 'center', justifyContent: 'center' },
  waitTitle: { color: c.text, fontFamily: font.display, fontSize: 18, marginTop: 14 },
  waitSub: { color: c.textMuted, fontSize: 13, marginTop: 4, textAlign: 'center' },
  goOnline: { flexDirection: 'row', gap: 10, marginTop: 16, height: 56, borderRadius: 999, backgroundColor: c.online, alignItems: 'center', justifyContent: 'center' },
  goOnlineText: { color: '#04120A', fontSize: 16, fontWeight: '700' },
}));
