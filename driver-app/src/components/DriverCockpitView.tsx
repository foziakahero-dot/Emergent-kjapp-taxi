import { EarningsCount } from './snar10/driver/EarningsCount';
import { Sheet as SourceSheet } from './snar10/Sheet';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ring } from './snar10/Ring';
import { TurnBanner } from './snar10/driver/TurnBanner';
import { OnlineChip } from './snar10/driver/OnlineChip';
import { OfferSheet } from './snar10/driver/OfferSheet';
import { Text } from '@/src/components/Typography';
import { V10Icon } from '@/src/components/V10Icon';
import { V10Action, V10Badge, V10Group, V10Row, V10Screen, v10 } from '@/src/components/V10UI';
import { HoldButton as V10HoldAction } from './snar10/driver/HoldButton';
import { ExperienceStudio, type StudioOption } from '@/src/components/ExperienceStudio';
import { usePersonalShiftGoal } from '@/src/lib/usePersonalShiftGoal';
import { FigmaGradient } from '@/src/components/FigmaGradient';
import { V10Entrance } from '@/src/components/V10Entrance';
import { DriverAvatar } from '@/src/components/DriverAvatar';
import { useReducedMotion } from '@/src/components/Motion';
import { kr } from '@/src/lib/format';
import { colors, font, useColorTheme } from '@/src/theme';

type Props = {
  connected: boolean; readiness: any; readinessError: string; onRefreshReadiness: () => void;
  user: any; online: boolean; busy: boolean; error: string; summary: any; current: any; completed: any; offer: any;
  offerRemaining: number | null; offerExpired: boolean; offerDistance: number | null; offerDuration: number | null;
  mapTarget?: React.RefObject<View | null>; gpsReady: boolean; minimized: boolean; extras: string;
  onOnline: () => void; onAccept: () => void; onDecline: () => void; onAdvance: () => Promise<void>;
  onCancel: () => void; onNoShow: () => void; onCall: () => void; onChat: () => void; onNavigate: () => void;
  onEmergency: () => void; onMinimize: (value: boolean) => void; onContinue: () => void; onPause: () => void;
  onError: (error: unknown) => void; onCashReceived?: () => void;
};
const known = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
const breakdownAmount = (value: unknown) => known(value) && (value as number) >= 0 ? (value as number).toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'Avventer';
const minutes = (value: unknown) => known(value) ? `${Math.floor((value as number) / 60)} t ${(value as number) % 60} min` : '—';
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
  return <SourceSheet paddingBottom={padBottom}>{children}</SourceSheet>;
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
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [clock, setClock] = useState(Date.now());
  useEffect(() => { setPhase('base'); }, [p.current?.trip_id, p.current?.status]);
  useEffect(() => { if (p.current?.status !== 'at_pickup') return; const timer = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, [p.current?.status]);
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
    {p.online ? <OnlineChip target={p.mapTarget} onlineTime={minutes(p.summary?.online_minutes)} income={kr(p.summary?.income)} disabled={p.busy || !!trip}
      onEarnings={() => router.navigate('/(driver)/earnings')} onOffline={p.onOnline} /> : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 6, paddingRight: 14, borderRadius: 16, backgroundColor: colors.glass, boxShadow: colors.elevation2 }}><DriverAvatar account={p.user} size={32} /><V10Badge inline>Offline</V10Badge></View>}
    {!p.online ? <Pressable accessibilityRole="button" accessibilityLabel="Innstillinger" onPress={() => router.push('/driver-settings')} style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.glass, boxShadow: colors.elevation2, alignItems: 'center', justifyContent: 'center' }}><V10Icon name="settings" /></Pressable> : null}
  </V10Entrance>;
  if (p.busy && !trip && !p.offer && !p.completed) return <V10Entrance fade testID="driver-shift-pending" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
    <V10Entrance pop style={{ borderRadius: 28, paddingVertical: 28, paddingHorizontal: 32, backgroundColor: colors.glass, boxShadow: colors.elevation2, alignItems: 'center' }}><ShiftStatusRing /><Text style={[v10.heading, { marginTop: 16 }]}>Oppdaterer vaktstatus</Text><Text style={v10.secondary}>Venter på bekreftelse fra SNAR</Text></V10Entrance>
  </V10Entrance>;
  if (p.completed && !trip && !(p.offer && p.online)) {
    const done = p.completed, paid = done.payment_status === 'paid' && known(done.driver_earnings) && done.driver_earnings >= 0;
    const cashDue = done.payment_flow === 'cash' && done.payment_status !== 'paid';
    const subscription = done.business_model === 'subscription' || done.commission_source === 'subscription_v1';
    const platformAmount = paid && known(done.price) && done.price >= done.driver_earnings ? done.price - done.driver_earnings : null;
    const rows = [
      ['Kundepris', breakdownAmount(done.price)],
      [subscription ? 'SNAR abonnement' : known(done.commission_rate) ? `SNAR plattform (${Math.round(done.commission_rate * 100)} %)` : 'SNAR plattform', subscription ? '0 % turprovisjon' : platformAmount !== null ? `−${breakdownAmount(platformAmount)}` : 'Avventer'],
      ['Din andel', paid ? breakdownAmount(done.driver_earnings) : 'Avventer'],
      ['Tid', known(done.duration_min) ? `${done.duration_min} min` : '—'],
      ['Distanse', known(done.distance_km) ? `${done.distance_km.toLocaleString('nb-NO')} km` : '—'],
    ];
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]}><V10Screen testID="driver-summary-screen"><V10Entrance fade>
      {p.error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{p.error}</Text> : null}
      <V10Entrance pop key={`${done.trip_id}:${paid ? 'paid' : 'pending'}`} style={{ marginTop: 24 }}>
        <V10Badge tone="positive">Tur fullført</V10Badge><Text style={[v10.caption, { marginTop: 16 }]}>Din inntekt</Text>
        {paid ? <EarningsCount amount={done.driver_earnings} /> : <Text style={{ color: colors.text, fontFamily: font.semibold, fontSize: 32, lineHeight: 56, letterSpacing: -1.82 }}>Betaling avventer</Text>}
        <Text style={v10.secondary}>{done.payment_flow === 'cash' ? paid ? 'Kontant mottatt · ingen Stripe-utbetaling for denne turen.' : done.price_review_required ? 'SNAR må kontrollere turprisen før du bekrefter kontantbeløpet.' : `Kunden betaler ${kr(done.price)} kontant direkte til deg. Bekreft først når du har mottatt hele beløpet.` : paid ? `Bekreftet · i dag totalt ${kr(p.summary?.income)}` : 'Inntekt vises når betalingen er bekreftet.'}</Text>
      </V10Entrance>
      <V10Group style={{ marginTop: 24, paddingVertical: 6, paddingHorizontal: 16 }}>{rows.map(([label, value], index) => <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: index ? 1 : 0, borderTopColor: colors.line, gap: 12 }}>
        <Text style={index === 2 ? v10.body : v10.secondary}>{label}</Text><Text style={index === 2 ? [v10.body, { fontVariant: ['tabular-nums'] }] : { fontFamily: font.medium, fontSize: 16, lineHeight: 23, fontVariant: ['tabular-nums'] }}>{value}</Text>
      </View>)}</V10Group>
      {cashDue ? <View style={{ marginTop: 20 }}><V10Action testID="driver-confirm-cash" label={`Kontant mottatt · ${kr(done.price)}`} onPress={() => p.onCashReceived?.()} busy={p.busy} disabled={done.price_review_required === true || !p.onCashReceived} /><V10Action kind="ghost" label="Kontakt flåten" onPress={() => router.push('/driver-fleet')} /></View> : null}
      <View style={{ marginTop: 24, gap: 4 }}><V10Action disabled={cashDue} height={58} label="Fortsett å kjøre" onPress={p.onContinue} busy={p.busy} testID="driver-summary-continue" /><V10Action kind="ghost" label="Ta pause" onPress={p.onPause} disabled={p.busy || cashDue} testID="driver-summary-pause" /></View>
    </V10Entrance></V10Screen></View>;
  }
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    {!trip && !(p.offer && p.online) ? header : null}
    {p.error ? <View style={{ position: 'absolute', top: insets.top + (trip ? 124 : 76), left: 16, right: 16, padding: 10, borderRadius: 12, backgroundColor: colors.dangerSoft, zIndex: 55 }}><Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12, lineHeight: 16 }}>{p.error}</Text></View> : null}
    {trip && p.minimized ? <View style={{ position: 'absolute', left: 16, right: 16, bottom: Math.max(108, insets.bottom + 74) }}><Pressable accessibilityRole="button" accessibilityLabel="Åpne aktiv tur" onPress={() => p.onMinimize(false)} testID="driver-trip-reopen" style={{ minHeight: 60, borderRadius: 20, padding: 14, backgroundColor: colors.surfaceInverse }}><Text style={[v10.body, { color: colors.onInverse }]}>{trip.status === 'in_trip' ? 'Tur pågår' : trip.status === 'at_pickup' ? 'Venter på passasjer' : 'På vei til henting'}</Text><Text style={[v10.caption, { color: colors.onInverse }]}>{name} · {trip.status === 'in_trip' ? trip.dropoff_address : trip.pickup_address}</Text></Pressable></View> : trip ? <>
      {!hasTurnBanner ? <Pressable accessibilityRole="button" accessibilityLabel="Minimer tur" testID="driver-trip-minimize" onPress={() => p.onMinimize(true)} style={{ position: 'absolute', right: 16, top: insets.top + 12, width: 48, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.surface, zIndex: 40 }}><V10Icon name="chevD" size={18} /></Pressable> : null}
      {hasTurnBanner ? <TurnBanner dist={pickupNavigation ? eta !== null ? `${eta} min` : 'Kjør til henting' : 'Til destinasjon'} street={trip.status === 'in_trip' ? trip.dropoff_address : trip.pickup_address} style={{ top: Math.max(56, insets.top + 8) }}>
        <View style={{ gap: 4 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Minimer tur" testID="driver-trip-minimize" onPress={() => p.onMinimize(true)} style={{ width: 40, height: 36, alignItems: 'center', justifyContent: 'center' }}><V10Icon name="chevD" size={18} color={colors.onInverse} /></Pressable>
          {!pickupNavigation ? <Pressable accessibilityRole="button" accessibilityLabel="Åpne navigasjon" testID="driver-navigation" onPress={p.onNavigate} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}><V10Icon name="share" color={colors.onInverse} /></Pressable> : null}
        </View>
      </TurnBanner> : null}
      {inside && trip.status === 'driver_on_way' && phase === 'base' ? <V10Entrance testID="driver-waiting-inside" style={{ position: 'absolute', top: Math.max(172, insets.top + 124), left: 12, right: 12, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.surface, boxShadow: colors.elevation2, flexDirection: 'row', gap: 10, alignItems: 'center' }}><V10Icon name="inside" size={20} color={colors.success} /><Text style={[v10.body, { flex: 1, fontSize: 15 }]}>{name.split(' ')[0]} venter inne</Text><Text style={v10.caption}>Ring ved ankomst</Text></V10Entrance> : null}
      <Sheet key={`${trip.trip_id}:${trip.status}:${phase}`}>
        {trip.payment_flow === 'cash' ? <Text testID="driver-cash-trip" style={[v10.body, { marginBottom: 12 }]}>Kontantbetaling · {kr(trip.price)}</Text> : null}
        {trip.status === 'driver_on_way' ? phase === 'arrival' ? <><V10Badge tone="positive">Bekreft hentepunktet</V10Badge><Text style={[v10.title, { marginTop: 10 }]}>{trip.pickup_address}</Text><Text style={[v10.secondary, { marginTop: 4 }]}>{name} blir varslet når ankomsten er bekreftet.</Text><View style={{ marginTop: 20 }}><V10Action height={58} label="Jeg har ankommet" onPress={() => void p.onAdvance().catch(p.onError)} busy={p.busy} testID="driver-advance" /><V10Action kind="ghost" label="Tilbake" onPress={() => setPhase('base')} /></View></> : <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}><View style={{ width: 52, height: 52, borderRadius: 17.68, backgroundColor: colors.cardSubtle, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 18.72, fontFamily: font.semibold }}>{name.split(' ').map((part: string) => part[0]).join('').slice(0, 2)}</Text></View><View style={{ flex: 1 }}><Text style={v10.heading}>{name}</Text><Text style={v10.secondary}>{trip.pickup_address}</Text></View><Text style={v10.title}>{eta ?? '—'}<Text style={v10.caption}> min</Text></Text></View>
          {p.extras ? <Text style={[v10.caption, { marginTop: 8 }]}>{p.extras}</Text> : null}{trip.passenger_note ? <Text style={[v10.secondary, { marginTop: 8 }]}>{trip.passenger_note}</Text> : null}
          {contact}<V10Action height={58} label="Jeg har ankommet" onPress={() => setPhase('arrival')} disabled={p.busy} testID="driver-arrival-review" /><V10Action kind="ghost" label="Avbryt tur" onPress={p.onCancel} disabled={p.busy} />
        </> : trip.status === 'at_pickup' ? phase === 'start' ? <><Text style={v10.caption}>Bekreft passasjer</Text><Text style={v10.title}>{name} til {trip.dropoff_address}</Text><Text style={[v10.secondary, { marginTop: 6 }]}>Spør om navnet før du starter. {trip.waiting_policy_accepted_at && trip.waiting_policy?.per_minute > 0 ? 'Avtalt pris før eventuell ventetid' : 'Prisen er fast'}: <Text style={{ fontVariant: ['tabular-nums'] }}>{kr(trip.price)}</Text>.</Text><View style={{ marginTop: 20 }}><V10HoldAction label="Start tur" onConfirm={p.onAdvance} onError={p.onError} disabled={p.busy} testID="driver-advance" /></View><V10Action kind="ghost" label="Tilbake" onPress={() => setPhase('base')} disabled={p.busy} /></> : <>
          <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}><Ring stroke={4} value={left !== null && free && free > 0 ? left / free : null}><V10Icon name="timer" /></Ring><View style={{ flex: 1 }}><Text style={v10.caption}>{left !== null ? 'Gratis venting igjen' : 'Venter på passasjer'}</Text><Text style={{ fontFamily: font.semibold, fontSize: 32, lineHeight: 38, fontVariant: ['tabular-nums'] }}>{left !== null ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : '—'}</Text></View></View>
          <V10Group style={{ marginTop: 16, backgroundColor: colors.cardSubtle, boxShadow: 'none' }}><V10Row icon="user" title={name} subtitle={trip.passenger_note || 'Ingen henteinstruks oppgitt'} /><V10Row border icon="door" title="Hentested" subtitle={trip.pickup_address} /></V10Group>
          {contact}<V10Action kind="ink" label="Passasjeren er i bilen" onPress={() => setPhase('start')} disabled={p.busy} testID="driver-passenger-confirm" /><V10Action kind="ghost" label="Kunden kom ikke?" onPress={p.onNoShow} disabled={p.busy} testID="driver-no-show" /><V10Action kind="ghost" label="Avbryt tur" onPress={p.onCancel} disabled={p.busy} />
        </> : trip.status === 'in_trip' ? phase === 'complete' ? <><Text style={v10.caption}>{name} · {trip.dropoff_address}</Text><Text style={v10.title}>Fullfør turen</Text><Text style={[v10.secondary, { marginTop: 6 }]}>Sjekk at passasjeren har gått ut og ikke glemt noe.</Text><View style={{ marginTop: 20 }}><V10HoldAction label="Fullfør tur" onConfirm={p.onAdvance} onError={p.onError} disabled={p.busy} testID="driver-advance" /></View><V10Action kind="ghost" label="Tilbake" onPress={() => setPhase('arriving')} disabled={p.busy} /></> : phase === 'arriving' ? <><Text style={v10.caption}>Ankommer</Text><Text style={v10.title}>{trip.dropoff_address}</Text><Text style={[v10.secondary, { marginTop: 6 }]}>Bekreft når du er fremme og passasjeren kan gå ut.</Text><View style={{ marginTop: 18 }}><V10Action height={58} kind="ink" label="Fremme ved destinasjon" onPress={() => setPhase('complete')} testID="driver-completion-review" /><V10Action kind="ghost" label="Fortsett turen" onPress={() => setPhase('base')} /></View></> : <>
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}><View style={[v10.icon, { backgroundColor: colors.surfaceInverse }]}><V10Icon name="destination" color={colors.onInverse} size={20} /></View><View style={{ flex: 1 }}><Text style={v10.heading}>{trip.dropoff_address}</Text><Text style={v10.secondary}>{p.gpsReady ? 'Naviger til avtalt destinasjon' : 'Venter på oppdatert posisjon'}</Text></View></View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}><View style={{ flex: 1 }}><V10Action small kind="soft" icon="message" label="Melding" onPress={p.onChat} /></View><View style={{ flex: 1 }}><V10Action small kind="soft" icon="safety" label="Sikkerhet" onPress={p.onEmergency} /></View></View><View style={{ marginTop: 12 }}><V10Action height={58} kind="ink" label="Ankommer destinasjon" onPress={() => setPhase('arriving')} testID="driver-arriving-review" /></View>
        </> : null}
      </Sheet>
    </> : p.offer && p.online ? <OfferSheet offer={p.offer} offerRemaining={p.offerRemaining} offerExpired={p.offerExpired}
      offerDistance={p.offerDistance} offerDuration={p.offerDuration} extras={p.extras} busy={p.busy} onAccept={p.onAccept} onDecline={p.onDecline} /> : p.online ? <View style={{ position: 'absolute', left: 16, right: 16, bottom: Math.max(104, insets.bottom + 70), gap: 8 }}>
      <V10Entrance><View testID="driver-online-status" accessibilityLiveRegion="polite" style={{ borderRadius: 20, padding: 16, gap: 6, backgroundColor: colors.surface, boxShadow: colors.elevation2 }}><Text style={[v10.heading, { color: p.connected && p.gpsReady ? colors.success : colors.warning }]}>{p.connected && p.gpsReady ? 'Du er online' : 'Bekrefter forbindelsen…'}</Text><Text style={v10.caption}>{p.connected && p.gpsReady ? 'Klar for nye turforespørsler.' : 'Venter på oppdatert forbindelse og posisjon. Turforespørsler kan være utilgjengelige.'}</Text></View></V10Entrance>
      <V10Entrance delay={60} style={{ borderRadius: 20, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.glass, boxShadow: colors.elevation2 }}><Text style={[v10.secondary, { color: colors.text }]}>Venter på tur · {p.user?.plate || 'Skilt ikke tilgjengelig'}</Text><Text style={v10.caption}>{p.gpsReady ? 'Posisjonen din deles med dispatch.' : 'Finner GPS…'}</Text></V10Entrance>
    </View> : <Sheet padBottom={108}>
      <Text style={v10.overline}>SNAR DRIVER</Text><Text style={[v10.title, { marginTop: 6 }]}>Du er offline</Text>
      <Text style={[v10.secondary, { marginTop: 6, marginBottom: 18 }]}>Du mottar ingen turforespørsler. Gå online når du er klar.</Text>
      <V10Action height={58} icon="power" label="Gå online" onPress={p.onOnline} busy={p.busy} testID="driver-go-online" />
      <View testID="driver-readiness" style={{ marginTop: 18, gap: 6 }}>
        {p.readinessError ? <><Text accessibilityRole="alert" style={v10.secondary}>{p.readinessError}</Text><V10Action kind="ghost" small label="Oppdater kontostatus" onPress={p.onRefreshReadiness} /></> : !p.readiness ? <Text style={v10.caption}>Henter kontostatus…</Text> : <>
          {[
            ['Profil', p.readiness.account_approved === true && p.readiness.profile_photo_ok === true],
            ['Bil', !!p.readiness.vehicle_id && p.readiness.vehicle?.operational === true],
            ['Dokumenter', p.readiness.driver?.operational === true && p.readiness.vehicle?.operational === true],
          ].map(([label, ready]) => <View key={String(label)} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><Text style={v10.secondary}>{label}</Text><Text style={[v10.caption, { color: ready ? colors.success : colors.warning }]}>{ready ? 'OK' : 'Må kontrolleres'}</Text></View>)}
          {p.readiness.message ? <Text accessibilityRole="alert" style={[v10.caption, { marginTop: 6 }]}>{p.readiness.message}</Text> : null}
          {p.readiness.internal_beta_test ? <Text style={v10.caption}>Intern testtilgang. Dokumenter er ikke godkjent for ordinær drift.</Text> : null}
        </>}
        {!p.connected ? <Text accessibilityRole="alert" style={v10.caption}>Kontrollerer forbindelsen til SNAR. Online-status er ikke bekreftet.</Text> : null}
      </View>
      <Pressable accessibilityRole="button" onPress={() => router.push('/driver-vehicles')} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 14 }}><View style={{ width: 72, height: 44, borderRadius: 12, backgroundColor: colors.cardSubtle, alignItems: 'center', justifyContent: 'center' }}><V10Icon name="vehicle" size={32} /></View><View style={{ flex: 1 }}><Text style={v10.body}>{p.user?.car || 'Velg kjøretøy'}</Text><Text style={v10.caption}>{p.user?.plate || 'Ingen aktiv bil valgt'}</Text></View><V10Icon name="chevR" size={18} color={colors.textMuted} /></Pressable>
      <View style={{ flexDirection: 'row', gap: 12, paddingTop: 14, paddingBottom: 18, borderTopWidth: 1, borderTopColor: colors.line }}><Kpi label="I dag" value={kr(p.summary?.income).replace(/\s+kr$/, '')} unit="kr" /><Kpi label="Turer" value={known(p.summary?.trips) ? String(p.summary.trips) : '—'} /></View>
      <Pressable testID="driver-goals-toggle" accessibilityRole="button" accessibilityState={{ expanded: goalsOpen }} onPress={() => setGoalsOpen(value => !value)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={v10.caption}>Personlig dagsmål</Text></Pressable>
      {goalsOpen ? <ExperienceStudio key={p.user?.id} product="driver" value={goal} options={studioOptions} earnings={p.summary?.income} onApply={save} onContinue={() => router.push('/(driver)/intel')} /> : null}
    </Sheet>}
  </View>;
}
