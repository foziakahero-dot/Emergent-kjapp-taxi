import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { Text } from '@/src/components/Typography';
import { V10Icon } from '@/src/components/V10Icon';
import { V10Action, V10Badge, V10Group, V10Row, V10Screen, v10 } from '@/src/components/V10UI';
import { V10HoldAction } from '@/src/components/V10HoldAction';
import { ExperienceStudio, type StudioOption } from '@/src/components/ExperienceStudio';
import { usePersonalShiftGoal } from '@/src/lib/usePersonalShiftGoal';
import { FigmaGradient } from '@/src/components/FigmaGradient';
import { V10Entrance } from '@/src/components/V10Entrance';
import { DriverAvatar } from '@/src/components/DriverAvatar';
import { useReducedMotion } from '@/src/components/Motion';
import { kr } from '@/src/lib/format';
import { colors, font, useColorTheme } from '@/src/theme';

type Props = {
  user: any; online: boolean; busy: boolean; error: string; summary: any; current: any; completed: any; offer: any;
  offerRemaining: number | null; offerExpired: boolean; offerDistance: number | null; offerDuration: number | null;
  gpsReady: boolean; minimized: boolean; extras: string;
  onOnline: () => void; onAccept: () => void; onDecline: () => void; onAdvance: () => Promise<void>;
  onCancel: () => void; onNoShow: () => void; onCall: () => void; onChat: () => void; onNavigate: () => void;
  onEmergency: () => void; onMinimize: (value: boolean) => void; onContinue: () => void; onPause: () => void;
  onError: (error: unknown) => void;
};
const known = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
const minutes = (value: unknown) => known(value) ? `${Math.floor((value as number) / 60)} t ${(value as number) % 60} min` : '—';
function Ring({ value, size = 64, color = colors.success, stroke = 3, radius = size / 2 - stroke, children }: { value: number | null; size?: number; color?: string; stroke?: number; radius?: number; children?: React.ReactNode }) {
  useColorTheme();
  const length = 2 * Math.PI * radius;
  return <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}><Svg width={size} height={size} style={StyleSheet.absoluteFill}>
    <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.lineStrong} strokeWidth={stroke} fill="none" />
    {value !== null ? <Circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={stroke} fill="none" strokeDasharray={`${length} ${length}`} strokeDashoffset={length * (1 - Math.max(0, Math.min(1, value)))} strokeLinecap="round" rotation={-90} origin={`${size / 2}, ${size / 2}`} /> : null}
  </Svg>{children}</View>;
}
function ShiftStatusRing() {
  const reduced = useReducedMotion();
  const turn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    turn.setValue(0);
    if (reduced) return;
    const animation = Animated.loop(Animated.timing(turn, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true }));
    animation.start();
    return () => animation.stop();
  }, [reduced, turn]);
  return <View accessibilityRole="progressbar" accessibilityLabel="Oppdaterer vaktstatus" style={{ width: 72, height: 72, alignItems: 'center', justifyContent: 'center' }}>
    <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}><Ring size={72} radius={32} value={.25} /></Animated.View>
    <V10Icon name="power" size={28} color={colors.success} />
  </View>;
}
function Sheet({ children, padBottom = 34 }: { children: React.ReactNode; padBottom?: number }) {
  useColorTheme();
  const insets = useSafeAreaInsets();
  return <V10Entrance sheet style={{ position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '82%', borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: colors.surface, paddingTop: 10, boxShadow: colors.elevation3, overflow: 'hidden' }}>
    <FigmaGradient angle={165} colors={[colors.surfaceRaised, colors.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" />
    <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong, alignSelf: 'center', marginBottom: 14 }} />
    <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Math.max(padBottom, insets.bottom) }}>{children}</ScrollView>
  </V10Entrance>;
}
function Kpi({ label, value, unit }: { label: string; value: string; unit?: string }) {
  useColorTheme(); return <View style={{ flex: 1 }}><Text style={v10.caption}>{label}</Text><Text style={{ fontFamily: font.semibold, fontSize: 20, lineHeight: 26, letterSpacing: -.4, color: colors.text, fontVariant: ['tabular-nums'] }}>{value}{unit ? <Text style={v10.caption}> {unit}</Text> : null}</Text></View>; }
export function DriverCockpitView(p: Props) {
  useColorTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { goal, save } = usePersonalShiftGoal(p.user?.id);
  const studioOptions: StudioOption[] = [
    { id: '2200', label: 'Balanse', icon: 'heart', title: 'Et godt skift. På dine premisser.', sub: 'Dagsmål 2 200 kr', body: 'Et oversiktlig mål med plass til pauser. Du bestemmer tempoet, og alle anbefalinger er valgfrie.' },
    { id: '2800', label: 'Fokus', icon: 'earnings', title: 'Færre distraksjoner. Klar retning.', sub: 'Dagsmål 2 800 kr', body: 'Hold dagens mål synlig og åpne Drive Intelligence for tilgjengelig innsikt.' },
    { id: '3400', label: 'Ambisjon', icon: 'arrowUp', title: 'Sikt høyere. Kjør like trygt.', sub: 'Dagsmål 3 400 kr', body: 'Et ambisiøst, personlig mål — aldri et inntektsløfte. Sikker kjøring og pauser kommer alltid først.' },
  ];
  const [phase, setPhase] = useState<'base' | 'arrival' | 'start' | 'arriving' | 'complete'>('base');
  const [clock, setClock] = useState(Date.now());
  useEffect(() => { setPhase('base'); }, [p.current?.trip_id, p.current?.status]);
  useEffect(() => { if (p.current?.status !== 'at_pickup') return; const timer = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, [p.current?.status]);
  const offerStart = useRef<{ id?: string; remaining: number | null }>({ remaining: null });
  if (offerStart.current.id !== p.offer?.trip_id) offerStart.current = { id: p.offer?.trip_id, remaining: p.offerRemaining };
  const trip = p.current;
  const name = trip?.customer?.name || 'Kunden din';
  const inside = typeof trip?.pickup_waiting_inside === 'boolean' ? trip.pickup_waiting_inside : /venter inne|venter i resepsjonen|waiting inside/i.test(trip?.passenger_note || '');
  const eta = !p.error && p.gpsReady && known(trip?.eta_min) && trip.eta_min > 0 ? Math.ceil(trip.eta_min) : null;
  const arrived = Date.parse(trip?.at_pickup_at || '');
  const free = known(trip?.waiting_policy?.free_minutes) ? Math.max(0, trip.waiting_policy.free_minutes * 60) : null;
  const left = free !== null && Number.isFinite(arrived) && arrived <= clock ? Math.max(0, Math.ceil(free - (clock - arrived) / 1000)) : null;
  const pickupNavigation = trip?.status === 'driver_on_way';
  const hasTurnBanner = (pickupNavigation && phase !== 'arrival') || (trip?.status === 'in_trip' && phase === 'base');
  const contact = <View style={{ flexDirection: 'row', gap: 8, marginTop: pickupNavigation ? 16 : 12, marginBottom: pickupNavigation ? 10 : 8 }}>
    <View style={{ flex: 1 }}><V10Action kind="soft" small height={52} iconSize={20} label="Ring" icon="phone" onPress={p.onCall} disabled={!trip?.customer?.phone} /></View>
    <View style={{ flex: 1 }}><V10Action kind="soft" small height={52} iconSize={20} label="Melding" icon="message" onPress={p.onChat} /></View>
    {pickupNavigation ? <View style={{ flex: 1 }}><V10Action kind="soft" small height={52} iconSize={20} label="Naviger" icon="navigation" onPress={p.onNavigate} testID="driver-pickup-navigation" /></View> : null}
  </View>;
  const header = <V10Entrance key={p.online ? 'online' : 'offline'} style={{ position: 'absolute', top: Math.max(58, insets.top + 10), left: p.online ? 16 : 20, right: p.online ? 16 : 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
    {p.online ? <View style={{ flex: 1, minHeight: 60, borderRadius: 20, boxShadow: colors.elevation2, paddingVertical: 10, paddingLeft: 16, paddingRight: 12, backgroundColor: colors.glass, flexDirection: 'row', alignItems: 'center', gap: 12 }}><V10Badge inline tone="positive">Online</V10Badge><Text style={[v10.secondary, { color: colors.text, fontVariant: ['tabular-nums'] }]}>{minutes(p.summary?.online_minutes)}</Text><Pressable accessibilityRole="button" accessibilityLabel="Dagens inntekt" onPress={() => router.navigate('/(driver)/earnings')} style={{ marginLeft: 'auto' }}><Text style={{ fontFamily: font.semibold, fontSize: 17, lineHeight: 23, fontVariant: ['tabular-nums'] }}>{kr(p.summary?.income)}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Gå offline" testID="driver-online-toggle" disabled={p.busy || !!trip} onPress={p.onOnline} style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }}><V10Icon name="power" size={20} color={colors.text} /></Pressable></View> : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 6, paddingRight: 14, borderRadius: 16, backgroundColor: colors.glass, boxShadow: colors.elevation2 }}><DriverAvatar account={p.user} size={32} /><V10Badge inline>Offline</V10Badge></View>}
    {!p.online ? <Pressable accessibilityRole="button" accessibilityLabel="Innstillinger" onPress={() => router.push('/driver-settings')} style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.glass, boxShadow: colors.elevation2, alignItems: 'center', justifyContent: 'center' }}><V10Icon name="settings" /></Pressable> : null}
  </V10Entrance>;
  if (p.busy && !trip && !p.offer && !p.completed) return <V10Entrance fade testID="driver-shift-pending" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
    <V10Entrance pop style={{ borderRadius: 28, paddingVertical: 28, paddingHorizontal: 32, backgroundColor: colors.glass, boxShadow: colors.elevation2, alignItems: 'center' }}><ShiftStatusRing /><Text style={[v10.heading, { marginTop: 16 }]}>Oppdaterer vaktstatus</Text><Text style={v10.secondary}>Venter på bekreftelse fra SNAR</Text></V10Entrance>
  </V10Entrance>;
  if (p.completed && !trip && !(p.offer && p.online)) {
    const done = p.completed, paid = done.payment_status === 'paid' && known(done.driver_earnings) && done.driver_earnings >= 0;
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]}><V10Screen testID="driver-summary-screen">
      {p.error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{p.error}</Text> : null}
      <View style={{ marginTop: 24 }}><V10Badge tone="positive">Tur fullført</V10Badge><Text style={[v10.caption, { marginTop: 16 }]}>Din inntekt</Text><Text style={{ color: colors.text, fontFamily: font.semibold, fontSize: paid ? 52 : 32, lineHeight: 56, letterSpacing: -1.82 }}>{paid ? kr(done.driver_earnings) : 'Betaling avventer'}</Text><Text style={v10.secondary}>{paid ? `Bekreftet · i dag totalt ${kr(p.summary?.income)}` : 'Inntekt vises når betalingen er bekreftet.'}</Text></View>
      <V10Group style={{ marginTop: 24, paddingVertical: 6, paddingHorizontal: 16 }}>{[['Kundepris', kr(done.price)], [known(done.commission_rate) ? `SNAR plattform (${Math.round(done.commission_rate * 100)} %)` : 'SNAR plattform', paid && known(done.price) ? `− ${kr(Math.max(0, done.price - done.driver_earnings))}` : 'Avventer'], ['Din andel', paid ? kr(done.driver_earnings) : 'Avventer'], ['Tid', known(done.duration_min) ? `${done.duration_min} min` : '—'], ['Distanse', known(done.distance_km) ? `${done.distance_km.toLocaleString('nb-NO')} km` : '—']].map(([label, value], index) => <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: index ? 1 : 0, borderTopColor: colors.line, gap: 12 }}><Text style={index === 2 ? v10.body : v10.secondary}>{label}</Text><Text style={index === 2 ? v10.body : { fontSize: 16, lineHeight: 23 }}>{value}</Text></View>)}</V10Group>
      <View style={{ marginTop: 24, gap: 4 }}><V10Action height={58} label="Fortsett å kjøre" onPress={p.onContinue} busy={p.busy} testID="driver-summary-continue" /><V10Action kind="ghost" label="Ta pause" onPress={p.onPause} disabled={p.busy} testID="driver-summary-pause" /></View>
    </V10Screen></View>;
  }
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    {!trip && !(p.offer && p.online) ? header : null}
    {p.error ? <View style={{ position: 'absolute', top: insets.top + (trip ? 124 : 76), left: 16, right: 16, padding: 10, borderRadius: 12, backgroundColor: colors.dangerSoft, zIndex: 55 }}><Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12, lineHeight: 16 }}>{p.error}</Text></View> : null}
    {trip && p.minimized ? <View style={{ position: 'absolute', left: 16, right: 16, bottom: Math.max(108, insets.bottom + 74) }}><Pressable accessibilityRole="button" accessibilityLabel="Åpne aktiv tur" onPress={() => p.onMinimize(false)} testID="driver-trip-reopen" style={{ minHeight: 60, borderRadius: 20, padding: 14, backgroundColor: colors.surfaceInverse }}><Text style={[v10.body, { color: colors.onInverse }]}>{trip.status === 'in_trip' ? 'Tur pågår' : trip.status === 'at_pickup' ? 'Venter på passasjer' : 'På vei til henting'}</Text><Text style={[v10.caption, { color: colors.onInverse }]}>{name} · {trip.status === 'in_trip' ? trip.dropoff_address : trip.pickup_address}</Text></Pressable></View> : trip ? <>
      {!hasTurnBanner ? <Pressable accessibilityRole="button" accessibilityLabel="Minimer tur" testID="driver-trip-minimize" onPress={() => p.onMinimize(true)} style={{ position: 'absolute', right: 16, top: insets.top + 12, width: 48, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.surface, zIndex: 40 }}><V10Icon name="chevD" size={18} /></Pressable> : null}
      {hasTurnBanner ? <V10Entrance style={{ position: 'absolute', left: 12, right: 12, top: Math.max(56, insets.top + 8), borderRadius: 24, backgroundColor: colors.surfaceInverse, paddingVertical: 16, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <V10Icon name="navigation" size={40} color={colors.onInverse} />
        <View style={{ flex: 1 }}><Text style={{ color: colors.onInverse, fontSize: pickupNavigation && eta === null ? 24 : 30, lineHeight: 34, letterSpacing: -.9, fontFamily: font.semibold, fontVariant: ['tabular-nums'] }}>{pickupNavigation ? eta !== null ? `${eta} min` : 'Kjør til henting' : 'Til destinasjon'}</Text><Text style={{ color: colors.onInverse, fontFamily: font.semibold, fontSize: 17, lineHeight: 23, opacity: .85 }}>{trip.status === 'in_trip' ? trip.dropoff_address : trip.pickup_address}</Text></View>
        <View style={{ gap: 4 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Minimer tur" testID="driver-trip-minimize" onPress={() => p.onMinimize(true)} style={{ width: 40, height: 36, alignItems: 'center', justifyContent: 'center' }}><V10Icon name="chevD" size={18} color={colors.onInverse} /></Pressable>
          {!pickupNavigation ? <Pressable accessibilityRole="button" accessibilityLabel="Åpne navigasjon" testID="driver-navigation" onPress={p.onNavigate} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}><V10Icon name="share" color={colors.onInverse} /></Pressable> : null}
        </View>
      </V10Entrance> : null}
      {inside && trip.status === 'driver_on_way' && phase === 'base' ? <V10Entrance testID="driver-waiting-inside" style={{ position: 'absolute', top: Math.max(172, insets.top + 124), left: 12, right: 12, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.surface, boxShadow: colors.elevation2, flexDirection: 'row', gap: 10, alignItems: 'center' }}><V10Icon name="inside" size={20} color={colors.success} /><Text style={[v10.body, { flex: 1, fontSize: 15 }]}>{name.split(' ')[0]} venter inne</Text><Text style={v10.caption}>Ring ved ankomst</Text></V10Entrance> : null}
      <Sheet>
        {trip.status === 'driver_on_way' ? phase === 'arrival' ? <><V10Badge tone="positive">Bekreft hentepunktet</V10Badge><Text style={[v10.title, { marginTop: 10 }]}>{trip.pickup_address}</Text><Text style={[v10.secondary, { marginTop: 4 }]}>{name} blir varslet når ankomsten er bekreftet.</Text><View style={{ marginTop: 20 }}><V10Action height={58} label="Jeg har ankommet" onPress={() => void p.onAdvance().catch(p.onError)} busy={p.busy} testID="driver-advance" /><V10Action kind="ghost" label="Tilbake" onPress={() => setPhase('base')} /></View></> : <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}><View style={{ width: 52, height: 52, borderRadius: 17.68, backgroundColor: colors.cardSubtle, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 18.72, fontFamily: font.semibold }}>{name.split(' ').map((part: string) => part[0]).join('').slice(0, 2)}</Text></View><View style={{ flex: 1 }}><Text style={v10.heading}>{name}</Text><Text style={v10.secondary}>{trip.pickup_address}</Text></View><Text style={v10.title}>{eta ?? '—'}<Text style={v10.caption}> min</Text></Text></View>
          {p.extras ? <Text style={[v10.caption, { marginTop: 8 }]}>{p.extras}</Text> : null}{trip.passenger_note ? <Text style={[v10.secondary, { marginTop: 8 }]}>{trip.passenger_note}</Text> : null}
          {contact}<V10Action height={58} label="Jeg har ankommet" onPress={() => setPhase('arrival')} disabled={p.busy} testID="driver-arrival-review" /><V10Action kind="ghost" label="Avbryt tur" onPress={p.onCancel} disabled={p.busy} />
        </> : trip.status === 'at_pickup' ? phase === 'start' ? <><Text style={v10.caption}>Bekreft passasjer</Text><Text style={v10.title}>{name} til {trip.dropoff_address}</Text><Text style={[v10.secondary, { marginTop: 6 }]}>Spør om navnet før du starter. {trip.waiting_policy_accepted_at && trip.waiting_policy?.per_minute > 0 ? 'Avtalt pris før eventuell ventetid' : 'Prisen er fast'}: {kr(trip.price)}.</Text><View style={{ marginTop: 20 }}><V10HoldAction label="Start tur" onConfirm={p.onAdvance} onError={p.onError} disabled={p.busy} testID="driver-advance" /></View><V10Action kind="ghost" label="Tilbake" onPress={() => setPhase('base')} disabled={p.busy} /></> : <>
          <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}><Ring value={left !== null && free && free > 0 ? left / free : null}><V10Icon name="timer" /></Ring><View style={{ flex: 1 }}><Text style={v10.caption}>{left !== null ? 'Gratis venting igjen' : 'Venter på passasjer'}</Text><Text style={{ fontFamily: font.semibold, fontSize: 32, lineHeight: 38, fontVariant: ['tabular-nums'] }}>{left !== null ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : '—'}</Text></View></View>
          <V10Group style={{ marginTop: 16, backgroundColor: colors.cardSubtle, boxShadow: 'none' }}><V10Row icon="user" title={name} subtitle={trip.passenger_note || 'Ingen henteinstruks oppgitt'} /><V10Row border icon="door" title="Hentested" subtitle={trip.pickup_address} /></V10Group>
          {contact}<V10Action kind="ink" label="Passasjeren er i bilen" onPress={() => setPhase('start')} disabled={p.busy} testID="driver-passenger-confirm" /><V10Action kind="ghost" label="Kunden kom ikke?" onPress={p.onNoShow} disabled={p.busy} testID="driver-no-show" /><V10Action kind="ghost" label="Avbryt tur" onPress={p.onCancel} disabled={p.busy} />
        </> : trip.status === 'in_trip' ? phase === 'complete' ? <><Text style={v10.caption}>{name} · {trip.dropoff_address}</Text><Text style={v10.title}>Fullfør turen</Text><Text style={[v10.secondary, { marginTop: 6 }]}>Sjekk at passasjeren har gått ut og ikke glemt noe.</Text><View style={{ marginTop: 20 }}><V10HoldAction label="Fullfør tur" onConfirm={p.onAdvance} onError={p.onError} disabled={p.busy} testID="driver-advance" /></View><V10Action kind="ghost" label="Tilbake" onPress={() => setPhase('arriving')} disabled={p.busy} /></> : phase === 'arriving' ? <><Text style={v10.caption}>Ankommer</Text><Text style={v10.title}>{trip.dropoff_address}</Text><Text style={[v10.secondary, { marginTop: 6 }]}>Bekreft når du er fremme og passasjeren kan gå ut.</Text><View style={{ marginTop: 18 }}><V10Action height={58} kind="ink" label="Fremme ved destinasjon" onPress={() => setPhase('complete')} testID="driver-completion-review" /><V10Action kind="ghost" label="Fortsett turen" onPress={() => setPhase('base')} /></View></> : <>
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}><View style={[v10.icon, { backgroundColor: colors.surfaceInverse }]}><V10Icon name="destination" color={colors.onInverse} size={20} /></View><View style={{ flex: 1 }}><Text style={v10.heading}>{trip.dropoff_address}</Text><Text style={v10.secondary}>{p.gpsReady ? 'Naviger til avtalt destinasjon' : 'Venter på oppdatert posisjon'}</Text></View></View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}><View style={{ flex: 1 }}><V10Action small kind="soft" icon="message" label="Melding" onPress={p.onChat} /></View><View style={{ flex: 1 }}><V10Action small kind="soft" icon="safety" label="Sikkerhet" onPress={p.onEmergency} /></View></View><View style={{ marginTop: 12 }}><V10Action height={58} kind="ink" label="Ankommer destinasjon" onPress={() => setPhase('arriving')} testID="driver-arriving-review" /></View>
        </> : null}
      </Sheet>
    </> : p.offer && p.online ? <Sheet>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><V10Badge inline icon="vehicle">{({ 'ai-first': 'Standard', trygg: 'XL', premium: 'Premium' } as Record<string, string>)[p.offer.vehicle_type] || 'SNAR'} · ny tur</V10Badge><Ring size={40} color={colors.textSecondary} value={p.offerRemaining !== null && offerStart.current.remaining && offerStart.current.remaining > 0 ? p.offerRemaining / offerStart.current.remaining : null}><Text style={[v10.caption, { color: colors.text, fontVariant: ['tabular-nums'] }]}>{p.offerRemaining ?? '—'}</Text></Ring></View>
      <Text style={{ marginTop: 12 }}><Text style={{ fontFamily: font.semibold, fontSize: 40, lineHeight: 44, letterSpacing: -1.4 }}>{known(p.offerDuration) ? Math.ceil(p.offerDuration!) : '—'} min</Text><Text style={v10.secondary}> til henting{known(p.offerDistance) ? ` · ${p.offerDistance!.toLocaleString('nb-NO', { maximumFractionDigits: 1 })} km` : ''}</Text></Text>
      <View style={{ marginVertical: 18, gap: 4 }}><Text style={{ fontFamily: font.semibold, fontSize: 22, lineHeight: 28, letterSpacing: -.44 }}>{p.offer.pickup_address}</Text><View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><V10Icon name="arrowR" size={18} color={colors.textMuted} /><Text style={v10.caption}>{[known(p.offer.distance_km) ? `${p.offer.distance_km.toLocaleString('nb-NO')} km` : null, known(p.offer.duration_min) ? `${p.offer.duration_min} min` : null].filter(Boolean).join(' · ')}</Text></View><Text style={{ fontFamily: font.semibold, fontSize: 22, lineHeight: 28, letterSpacing: -.44 }}>{p.offer.dropoff_address}</Text></View>
      {p.extras ? <Text style={v10.caption}>{p.extras}</Text> : null}{p.offer.passenger_note ? <Text style={v10.secondary}>{p.offer.passenger_note}</Text> : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.line }}><Text style={v10.secondary}>Estimert pris</Text><Text style={{ fontFamily: font.semibold, fontSize: 28, lineHeight: 36, letterSpacing: -.176, fontVariant: ['tabular-nums'] }}>{kr(p.offer.price)}</Text></View>
      <View style={{ flexDirection: 'row', gap: 8 }}><View style={{ width: 96 }}><V10Action height={64} kind="soft" label="Avslå" onPress={p.onDecline} disabled={p.busy} testID={`driver-decline-${p.offer.trip_id}`} /></View><View style={{ flex: 1 }}><V10Action height={64} labelSize={18} label={p.offerExpired ? 'Utløpt' : 'Aksepter'} onPress={p.onAccept} busy={p.busy} disabled={p.offerExpired} testID={`driver-accept-${p.offer.trip_id}`} /></View></View>
    </Sheet> : p.online ? <View style={{ position: 'absolute', left: 16, right: 16, bottom: Math.max(104, insets.bottom + 70), gap: 8 }}>
      <V10Entrance><Pressable testID="driver-online-intelligence" accessibilityRole="button" onPress={() => router.push('/(driver)/intel')} style={{ borderRadius: 20, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: colors.glass, boxShadow: colors.elevation2 }}><View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.surfaceInverse, alignItems: 'center', justifyContent: 'center' }}><V10Icon name="ai" size={18} color={colors.onInverse} /></View><View style={{ flex: 1 }}><Text style={[v10.body, { fontSize: 15 }]}>Drive Intelligence</Text><Text style={v10.caption}>Ingen etterspørselsprognose tilgjengelig ennå</Text></View></Pressable></V10Entrance>
      <V10Entrance delay={60} style={{ borderRadius: 20, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.glass, boxShadow: colors.elevation2 }}><Text style={[v10.secondary, { color: colors.text }]}>Venter på tur · {p.user?.plate || 'Skilt ikke tilgjengelig'}</Text><Text style={v10.caption}>{p.gpsReady ? 'Posisjonen din deles med dispatch.' : 'Finner GPS…'}</Text></V10Entrance>
    </View> : <Sheet padBottom={108}>
      <ExperienceStudio key={p.user?.id} product="driver" value={goal} options={studioOptions} earnings={p.summary?.income} onApply={save} onContinue={() => router.push('/(driver)/intel')} />
      <Pressable accessibilityRole="button" onPress={() => router.push('/driver-vehicles')} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 14 }}><View style={{ width: 72, height: 44, borderRadius: 12, backgroundColor: colors.cardSubtle, alignItems: 'center', justifyContent: 'center' }}><V10Icon name="vehicle" size={32} /></View><View style={{ flex: 1 }}><Text style={v10.body}>{p.user?.car || 'Velg kjøretøy'}</Text><Text style={v10.caption}>{p.user?.plate || 'Ingen aktiv bil valgt'}</Text></View><V10Icon name="chevR" size={18} color={colors.textMuted} /></Pressable>
      <View style={{ flexDirection: 'row', gap: 12, paddingTop: 14, paddingBottom: 18, borderTopWidth: 1, borderTopColor: colors.line }}><Kpi label="I dag" value={kr(p.summary?.income).replace(/\s+kr$/, '')} unit="kr" /><Kpi label="Turer" value={known(p.summary?.trips) ? String(p.summary.trips) : '—'} /><Kpi label="Online" value={known(p.summary?.online_minutes) ? `${Math.floor(p.summary.online_minutes / 60)}:${String(p.summary.online_minutes % 60).padStart(2, '0')}` : '—'} unit="t" /></View><V10Action height={58} icon="power" label="Gå online" onPress={p.onOnline} busy={p.busy} testID="driver-go-online" />
    </Sheet>}
  </View>;
}
