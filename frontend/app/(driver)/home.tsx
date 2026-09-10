import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, View } from 'react-native';
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

export default function DriverHome() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { user } = useAuth();
  const [online, setOnline] = useState(false);
  const [pending, setPending] = useState<any[]>([]);
  const [current, setCurrent] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
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
    driverApi.summary().then(setSummary).catch(() => {});
  }, []);

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
      if (status !== 'granted') { setError('Posisjon kreves for å kjøre. Slå på i innstillinger.'); setOnline(false); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setLoc(p);
      driverApi.location(p.lat, p.lng, pos.coords.heading || 0, pos.coords.speed || 0).catch(() => {});
      watch.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 20, timeInterval: 8000 },
        (u) => {
          const np = { lat: u.coords.latitude, lng: u.coords.longitude };
          setLoc(np);
          driverApi.location(np.lat, np.lng, u.coords.heading || 0, u.coords.speed || 0).catch(() => {});
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

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.driverBg }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }}>
      <View style={s.headerRow}>
        <View>
          <Text style={s.hello}>{user?.fullName?.split(' ')[0] || 'Sjåfør'}</Text>
          <Text style={s.role}>{online ? 'Pålogget' : 'Avlogget'}</Text>
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

      {/* today's summary */}
      <View style={s.summaryRow}>
        <Stat label="Turer i dag" value={String(summary?.trips ?? 0)} s={s} />
        <View style={s.vDivider} />
        <Stat label="Inntekt" value={kr(summary?.earnings ?? summary?.total ?? 0)} s={s} />
        <View style={s.vDivider} />
        <Stat label="Timer" value={String(summary?.hours ?? summary?.online_hours ?? 0)} s={s} />
      </View>

      {error ? <Text style={s.error} testID="driver-error">{error}</Text> : null}

      {current ? (
        <View style={s.tripCard} testID="driver-active-trip">
          <Map
            style={s.tripMap}
            pickup={{ lat: current.pickup_lat, lng: current.pickup_lng }}
            dropoff={{ lat: current.dropoff_lat, lng: current.dropoff_lng }}
            route={current.geometry?.coordinates}
            activeCar={loc}
          />
          <View style={s.tripBody}>
            <Text style={s.overlineOnline}>AKTIV TUR · {kr(current.price)}</Text>
            <View style={s.epRow}><View style={s.beacon} /><Text style={s.epText} numberOfLines={1}>{current.pickup_address}</Text></View>
            <View style={s.epRow}><View style={s.square} /><Text style={s.epText} numberOfLines={1}>{current.dropoff_address}</Text></View>
            <Pressable style={s.msgBtn} onPress={() => setChatOpen(true)} testID="driver-chat">
              <Icon name="message" size={16} color={colors.text} />
              <Text style={s.msgBtnText}>Melding til kunde</Text>
            </Pressable>
            {actionLabel ? (
              <Pressable style={s.action} onPress={advance} disabled={busy} testID="driver-advance">
                {busy ? <ActivityIndicator color={colors.accentOn} /> : <Text style={s.actionText}>{actionLabel}</Text>}
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : online ? (
        pending.length ? (
          pending.map((t) => (
            <View key={t.trip_id} style={s.offer} testID={`driver-offer-${t.trip_id}`}>
              <Text style={s.overlineOnline}>NY TUR · {kr(t.price)}</Text>
              <View style={s.epRow}><View style={s.beacon} /><Text style={s.epText} numberOfLines={1}>{t.pickup_address}</Text></View>
              <View style={s.epRow}><View style={s.square} /><Text style={s.epText} numberOfLines={1}>{t.dropoff_address}</Text></View>
              <Text style={s.offerMeta}>{t.distance_km} km · {t.duration_min} min</Text>
              <View style={s.offerBtns}>
                <Pressable style={s.declineBtn} onPress={() => decline(t.trip_id)} testID={`driver-decline-${t.trip_id}`}>
                  <Text style={s.declineText}>Avslå</Text>
                </Pressable>
                <Pressable style={s.acceptBtn} onPress={() => accept(t.trip_id)} disabled={busy} testID={`driver-accept-${t.trip_id}`}>
                  <Text style={s.acceptText}>Godta tur</Text>
                </Pressable>
              </View>
            </View>
          ))
        ) : (
          <View style={s.waiting} testID="driver-waiting">
            <View style={s.pulse}><Icon name="navigation" size={28} color={colors.online} /></View>
            <Text style={s.waitTitle}>Venter på turer…</Text>
            <Text style={s.waitSub}>Du er synlig for kunder i nærheten. Hold appen åpen.</Text>
          </View>
        )
      ) : (
        <View style={s.waiting} testID="driver-offline">
          <View style={s.offlineCircle}><Icon name="power" size={28} color={colors.textMuted} /></View>
          <Text style={s.waitTitle}>Du er avlogget</Text>
          <Text style={s.waitSub}>Skru på for å motta turer i nærheten.</Text>
        </View>
      )}

      {current ? (
        <ChatSheet
          tripId={current.trip_id}
          role="driver"
          visible={chatOpen}
          onClose={() => setChatOpen(false)}
          peerName="Kunde"
        />
      ) : null}
    </ScrollView>
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
  hello: { color: c.text, fontFamily: font.display, fontSize: 26 },
  role: { color: c.textMuted, fontSize: 13, marginTop: 2 },
  onlineToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.driverCard, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: c.line, minWidth: 88, justifyContent: 'center' },
  onlineToggleOn: { borderColor: c.online, backgroundColor: c.onlineSoft },
  onlineLabel: { color: c.textMuted, fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.driverCard, borderRadius: 20, borderWidth: 1, borderColor: c.line, marginHorizontal: 20, marginTop: 20, paddingVertical: 18 },
  vDivider: { width: 1, height: 34, backgroundColor: c.line },
  statValue: { color: c.text, fontFamily: font.mono, fontSize: 18 },
  statLabel: { color: c.textMuted, fontSize: 11, marginTop: 4 },
  error: { color: c.danger, fontSize: 13, marginHorizontal: 20, marginTop: 14 },
  tripCard: { marginHorizontal: 20, marginTop: 20, backgroundColor: c.driverCard, borderRadius: 20, borderWidth: 1, borderColor: c.online, overflow: 'hidden' },
  tripMap: { height: 180, width: '100%' },
  tripBody: { padding: 18, gap: 10 },
  msgBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: c.line },
  msgBtnText: { color: c.text, fontSize: 14 },
  offer: { marginHorizontal: 20, marginTop: 20, backgroundColor: c.driverCard, borderRadius: 20, borderWidth: 1, borderColor: c.line, padding: 18, gap: 10 },
  overlineOnline: { color: c.online, fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  epRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  beacon: { width: 11, height: 11, borderRadius: 6, backgroundColor: c.online },
  square: { width: 11, height: 11, borderRadius: 2, backgroundColor: c.text },
  epText: { color: c.text, fontSize: 14, flex: 1 },
  offerMeta: { color: c.textMuted, fontSize: 13 },
  offerBtns: { flexDirection: 'row', gap: 12, marginTop: 6 },
  declineBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: c.line },
  declineText: { color: c.textSecondary, fontSize: 15 },
  acceptBtn: { flex: 2, alignItems: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: c.online },
  acceptText: { color: '#04120A', fontSize: 15, fontWeight: '700' },
  action: { marginTop: 8, height: 54, borderRadius: 14, backgroundColor: c.online, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: '#04120A', fontSize: 16, fontWeight: '700' },
  waiting: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  pulse: { width: 80, height: 80, borderRadius: 40, backgroundColor: c.onlineSoft, borderWidth: 1, borderColor: 'rgba(47,224,140,0.3)', alignItems: 'center', justifyContent: 'center' },
  offlineCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: c.driverCard, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  waitTitle: { color: c.text, fontFamily: font.display, fontSize: 20, marginTop: 18 },
  waitSub: { color: c.textMuted, fontSize: 14, marginTop: 6, textAlign: 'center', lineHeight: 20 },
}));
