import React, { useEffect, useRef, useState, type RefObject } from 'react';
import { CustomerJourney, confirmedPaymentMethod, finiteMetric, paymentLabel } from '@/src/components/BookingPrimitives';
export { CustomerJourney, confirmedPaymentMethod, finiteMetric, paymentLabel } from '@/src/components/BookingPrimitives';
import { V10Glass } from './V10Glass';
import { V10CustomerAvatar } from './V10CustomerAvatar';
import { V10Entrance } from './V10Entrance';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/src/components/Typography';
import { V10Icon } from '@/src/components/V10Icon';
import { V10Action, v10 } from '@/src/components/V10UI';
import { V10CategoryImage } from './V10CategoryImage';
import { useReducedMotion } from '@/src/components/Motion';
import { colors, font, useColorTheme, themedStyles } from '@/src/theme';
import { kr } from '@/src/lib/format';
import { CollapsibleMapPanel } from './CollapsibleMapPanel';
import { DriverAvailabilityBadge } from './DriverAvailabilityBadge';
import type { Availability } from '@/src/lib/carAvailability';

export type BookingStage = 'route' | 'vehicles' | 'payment';
type Props = {
  stage: BookingStage; reviewing: boolean; pickup: string; destination: any; estimate: any; quotedAt?: number | null;
  vehicleEtas?: Record<string, number>; vehicle: string; price: number | null; promoBalance?: number; nearest: number | null; payment: any; methods: any[];
  waitingPolicy: any; waitingAccepted: boolean; busy: boolean; canReview: boolean; canBook: boolean;
  error: string; firstName: string; initials: string; places: any[]; placesIssue: boolean;
  locationReady: boolean; onStage: (stage: BookingStage) => void; onReview: (value: boolean) => void;
  onVehicle: (type: string) => void; onSearch: (target: 'pickup' | 'dropoff') => void; onNearby?: () => void;
  onPlace: (place: any) => void; onLocate: () => void; onVoice: () => void; onProfile: () => void; onNotifications?: () => void; onSchedule?: () => void;
  onPlaces: () => void; onRetryPlaces: () => void; onPayment: () => void; onConsent: () => void;
  onBook: () => void; onBack: () => void; onRetryQuote?: () => void; onHeight: (height: number) => void; stops: any[];
  availability?: React.ReactNode; driverAvailability?: Availability; mapBlurTarget?: RefObject<View | null>; avatarVersion?: string;
};
const vehicleNames: Record<string, string> = { 'ai-first': 'SNAR Standard', enkelt: 'SNAR Enkelt', trygg: 'SNAR XL', premium: 'SNAR Premium' };
export function CustomerBookingView(p: Props) {
  useColorTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [homeHeight, setHomeHeight] = useState(300);
  // Keep the voice/locate column below the header row (avatar + bell) however tall the sheet gets.
  const toolsMaxBottom = Math.max(16, windowHeight - (Math.max(58, insets.top + 10) + 112 + 16) - 160);
  const vehicleName = vehicleNames[p.vehicle] || 'SNAR';
  const pickupEta = typeof p.nearest === 'number' && Number.isFinite(p.nearest) && p.nearest > 0 ? Math.ceil(p.nearest) : null;
  const panelTitle = !p.destination ? 'Planlegg reisen' : p.reviewing ? 'Bekreft tur' : p.stage === 'vehicles' ? 'Velg bil' : p.stage === 'payment' ? 'Betaling' : 'Reiserute';
  const sheet = (children: React.ReactNode, home = false) => <CollapsibleMapPanel key={home ? 'home' : p.reviewing ? 'confirm' : p.stage}
    id={p.reviewing ? 'booking-review-screen' : p.destination ? 'home-ride-sheet' : 'home-browse-sheet'} title={panelTitle}
    summary={p.destination ? `${vehicleName} · ${kr(p.price)} · ${p.destination.name}` : 'Hvor skal du?'}
    heightFraction={home ? .3 : .7} bottomOffset={home ? insets.bottom + 82 : 0} bottomInset={home ? 0 : insets.bottom}
    onHeight={height => { p.onHeight(height); if (home) setHomeHeight(height); }}>{children}</CollapsibleMapPanel>;
  const back = () => p.reviewing ? p.onReview(false) : p.stage === 'payment' ? p.onStage('vehicles') : p.stage === 'vehicles' ? p.onStage('route') : p.onBack();
  const error = p.error ? <Text accessibilityRole="alert" testID="home-error" style={[v10.secondary, { color: colors.danger, marginVertical: 12 }]}>{p.error}</Text> : null;
  if (!p.destination) return <>
    <V10Entrance testID="home-header" style={{ position: 'absolute', top: Math.max(58, insets.top + 10), left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Pressable onPress={p.onProfile} accessibilityRole="button" accessibilityLabel="Åpne profilen" style={styles.identity}><V10Glass target={p.mapBlurTarget} /><V10CustomerAvatar initials={p.initials} version={p.avatarVersion} /><Text style={[v10.secondary, { color: colors.text, flexShrink: 1 }]} numberOfLines={1}>Hei, {p.firstName}</Text></Pressable>
      <Tool id="home-notifications" icon="bell" label="Varsler" onPress={p.onNotifications || p.onProfile} target={p.mapBlurTarget} />
    </V10Entrance>
    {p.driverAvailability ? <View style={{ position: 'absolute', top: Math.max(58, insets.top + 10) + 58, left: 20, right: 20 }}>
      <DriverAvailabilityBadge search={p.driverAvailability} ready={p.locationReady} />
    </View> : null}
    <View style={windowHeight < 500 ? { position: 'absolute', right: 20, top: Math.max(58, insets.top + 10) + 58, flexDirection: 'row', gap: 8 }
      : { position: 'absolute', right: 20, bottom: Math.min(homeHeight + 20, toolsMaxBottom), gap: 8 }}>
      {p.onNearby ? <Tool id="home-nearby-drivers" icon="vehicle" label="Vis ledige sjåfører" onPress={p.onNearby} target={p.mapBlurTarget} /> : null}
      <Tool id="home-voice" icon="voice" label="Snakk med SNAR" onPress={p.onVoice} target={p.mapBlurTarget} /><Tool id="home-recenter" icon="locate" label="Min posisjon" onPress={p.onLocate} target={p.mapBlurTarget} /></View>
    {sheet(<>
      <Pressable testID="home-where-to" accessibilityRole="button" accessibilityLabel="Søk etter destinasjon" onPress={() => p.onSearch('dropoff')} style={styles.search}><V10Icon name="search" /><Text style={[v10.body, { flex: 1, fontSize: 18 }]}>Hvor skal du?</Text><Pressable testID="home-schedule" accessibilityRole="button" accessibilityLabel="Velg hentetid" disabled={!p.onSchedule} onPress={event => { event.stopPropagation(); p.onSchedule?.(); }} style={styles.now}><V10Icon name="clock" size={16} /><Text style={v10.caption}>Nå</Text></Pressable></Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 12 }}>
        {p.places.slice(0, 3).map((place, i) => <Pressable key={place.id || `${place.name}-${i}`} testID={`quick-${place.label || i}`} onPress={() => p.onPlace(place)} accessibilityRole="button" style={styles.chip}><V10Icon name={place.label === 'Hjem' ? 'home' : place.label === 'Jobb' ? 'work' : 'clock'} size={18} /><Text style={v10.secondary} numberOfLines={1}>{place.label || place.name}</Text></Pressable>)}
        {!p.places.length && <Pressable testID="home-add-place" onPress={p.onPlaces} style={styles.chip}><V10Icon name="plus" size={18} /><Text style={v10.secondary}>Legg til fast sted</Text></Pressable>}
      </ScrollView>
      {p.locationReady && pickupEta ? <View testID="home-pickup-eta" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 14 }}><V10Icon name="clock" size={16} /><Text style={[v10.body, { fontFamily: font.semibold }]}>{vehicleName} · bil om {pickupEta} min</Text></View> : null}
      {!p.locationReady ? <Pressable testID="home-location-required" onPress={() => p.onSearch('pickup')} style={{ paddingTop: 12 }}><Text style={v10.secondary}>Velg hentested eller del posisjonen din.</Text></Pressable> : p.availability}
      {p.placesIssue ? <Pressable testID="home-places-retry" onPress={p.onRetryPlaces}><Text testID="home-places-error" style={[v10.caption, { marginTop: 8 }]}>Kunne ikke oppdatere faste steder. Prøv igjen.</Text></Pressable> : null}{error}</>, true)}
  </>;
  return <><View style={{ position: 'absolute', top: Math.max(58, insets.top + 10), left: 20 }}><Tool id="booking-back" icon="chevL" label="Tilbake" onPress={back} target={p.mapBlurTarget} /></View>
    {sheet(p.reviewing ? <><Text style={[v10.heading, { marginBottom: 16 }]}>Bekreft tur</Text><CustomerJourney pickup={p.pickup} destination={p.destination.name} destinationDetail={arrivalTime(p.estimate?.duration_min, p.quotedAt) !== '—' ? `Ankomst ca. ${arrivalTime(p.estimate.duration_min, p.quotedAt)}` : p.destination.address} stops={p.stops} onPickup={() => p.onSearch('pickup')} onDestination={() => p.onSearch('dropoff')} />
      <View style={{ flexDirection: 'row', gap: 8, marginVertical: 20 }}><Info title="Kjøretøy" value={vehicleName} /><Info title="Betaling" value={paymentLabel(p.payment)} onPress={() => { p.onReview(false); p.onStage('payment'); }} /></View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}><Text style={v10.secondary}>Fast pris, inkl. mva</Text><Text style={v10.title}>{kr(p.price)}</Text></View>
      {p.promoBalance && p.promoBalance > 0 ? <Text testID="booking-promo-credit" style={[v10.caption, { marginTop: -10, marginBottom: 16, color: colors.online }]}>Du har {kr(p.promoBalance)} SNAR-kreditt. Rabatten trekkes automatisk og vises på kvitteringen.</Text> : null}
      {confirmedWaitingPolicy(p.waitingPolicy) ? <View style={{ marginBottom: 16 }}><Pressable testID="waiting-policy-consent" accessibilityRole="checkbox" accessibilityState={{ checked: p.waitingAccepted, disabled: p.busy }} disabled={p.busy} onPress={p.onConsent} style={{ flexDirection: 'row', gap: 10, minHeight: 44 }}><View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: p.waitingAccepted ? colors.accent : colors.lineStrong, backgroundColor: p.waitingAccepted ? colors.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{p.waitingAccepted ? <V10Icon name="check" size={15} color={colors.accentOn} /> : null}</View><Text style={[v10.secondary, { flex: 1 }]}>Jeg godtar ventetid: {p.waitingPolicy.free_minutes} min gratis, så {kr(p.waitingPolicy.per_minute)}/min (maks {kr(p.waitingPolicy.max_fee)}).</Text></Pressable><Text style={[v10.caption, { marginTop: 6 }]}>Reserverer opptil {kr(Number(p.price || 0) + p.waitingPolicy.max_fee)} på kortet. Bare turpris og faktisk ventetid trekkes; resten frigjøres.</Text></View> : <View style={{ marginBottom: 16 }}><Text accessibilityRole="alert" style={v10.secondary}>Vilkårene for ventetid kunne ikke bekreftes.</Text>{p.onRetryQuote ? <V10Action testID="booking-refresh-quote" label="Oppdater tilbud" kind="soft" small onPress={p.onRetryQuote} disabled={p.busy} /> : null}</View>}
      {error}<V10Action testID="booking-confirm" label="Bekreft og bestill" disabled={!p.canBook} busy={p.busy} onPress={p.onBook} />
    </> : p.stage === 'route' ? <><CustomerJourney pickup={p.pickup} destination={p.destination.name} destinationDetail={p.destination.address} stops={p.stops} onPickup={() => p.onSearch('pickup')} onDestination={() => p.onSearch('dropoff')} />
      <View style={styles.metrics}><Metric label="Kjøretid" value={finiteMetric(p.estimate?.duration_min, 'min')} /><Metric label="Distanse" value={finiteMetric(p.estimate?.distance_km, 'km')} /><Metric label="Ankomst" value={arrivalTime(p.estimate?.duration_min, p.quotedAt)} /></View>
      {error}<View style={{ flexDirection: 'row', gap: 8 }}><View style={{ width: 56 }}><Pressable testID="route-adjust-pickup" accessibilityRole="button" accessibilityLabel="Juster hentested" onPress={() => p.onSearch('pickup')} style={{ height: 56, borderRadius: 16, backgroundColor: colors.cardSubtle, alignItems: 'center', justifyContent: 'center' }}><V10Icon name="pickup" /></Pressable></View><View style={{ flex: 1 }}><V10Action testID="route-choose-vehicle" label="Velg bil" disabled={!p.canReview} onPress={() => p.onStage('vehicles')} /></View></View>
    </> : p.stage === 'vehicles' ? <><View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 12 }}><Text style={[v10.heading, { flex: 1 }]}>Velg bil</Text><Text style={v10.caption} numberOfLines={1}>Til {p.destination.name} · {finiteMetric(p.estimate?.duration_min, 'min')}</Text></View>
      <View accessibilityRole="radiogroup" accessibilityLabel="Kjøretøykategori" style={{ gap: 8 }}>{vehicleChoices.map(choice => <VehicleChoice key={choice.type} choice={choice} selected={p.vehicle === choice.type}
        option={p.estimate?.options?.find((option: any) => option.vehicle_type === choice.type)} eta={p.vehicleEtas?.[choice.type] ?? (p.vehicle === choice.type ? p.nearest : null)} onSelect={p.onVehicle} />)}</View>
      <Pressable testID="booking-payment-row" onPress={() => p.onStage('payment')} style={{ flexDirection: 'row', gap: 14, alignItems: 'center', minHeight: 48, paddingHorizontal: 4, paddingVertical: 12 }}><V10Icon name="payment" size={20} /><Text style={[v10.body, { flex: 1 }]}>{paymentLabel(p.payment)}</Text><V10Icon name="chevR" size={18} color={colors.textMuted} /></Pressable>
      {error}<V10Action testID="booking-review" label={`Bestill ${vehicleName} · ${kr(p.price)}`} disabled={!p.canReview} onPress={() => p.onReview(true)} />
    </> : <><Text style={[v10.heading, { marginBottom: 14 }]}>Betal med</Text>
      <View style={{ borderRadius: 22, overflow: 'hidden', backgroundColor: colors.cardSubtle }}>
        <PaymentChoice id="apple" icon="apple" title="Apple Pay" subtitle="Bruk betalingskort til denne turen" disabled onPress={() => {}} />
        <PaymentChoice id="card" icon="payment" title={paymentLabel(p.payment)} subtitle={p.payment ? cardExpiryLabel(p.payment) || 'Verifisert betalingskort' : 'Verifiser et kort før bestilling'} selected={Boolean(p.payment)} onPress={() => p.payment ? p.onStage('vehicles') : p.onPayment()} />
        <PaymentChoice id="google" icon="google" title="Google Pay" subtitle="Bruk betalingskort til denne turen" disabled onPress={() => {}} />
        <PaymentChoice id="business" icon="work" title="SNAR Bedrift" subtitle="Bedriftsbetaling er ikke tilgjengelig" disabled onPress={() => {}} />
        <PaymentChoice id="vipps" icon="payment" title="Vipps" subtitle="Bruk betalingskort til denne turen" disabled onPress={() => {}} />
      </View>
      <View style={{ marginTop: 12 }}><V10Action testID="booking-add-payment" kind="soft" small icon="plus" label="Legg til betalingsmåte" onPress={p.onPayment} /></View>
      <Text style={[v10.caption, { marginTop: 12 }]}>Turen reserveres på ditt verifiserte standardkort. Endre kort under Betalingsmåter.</Text>
      <V10Action testID="booking-payment-done" kind="ghost" label="Tilbake til bilvalg" onPress={() => p.onStage('vehicles')} />{error}</>)}
  </>;
}
const vehicleChoices = [
  { type: 'ai-first', name: 'SNAR Standard', note: 'Hverdagsreisen' },
  { type: 'enkelt', name: 'SNAR Enkelt', note: 'En enkel reise' },
  { type: 'trygg', name: 'SNAR XL', note: 'Mer plass' },
  { type: 'premium', name: 'SNAR Premium', note: 'En oppgradert reise' },
] as const;
function VehicleChoice({ choice, option, selected, eta, onSelect }: { choice: typeof vehicleChoices[number]; option: any; selected: boolean; eta?: number | null; onSelect: (type: string) => void }) {
  useColorTheme();
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { progress.setValue(selected ? 1 : 0); return; }
    const animation = Animated.timing(progress, { toValue: selected ? 1 : 0, duration: 210, easing: Easing.bezier(.2, .8, .2, 1), useNativeDriver: false });
    animation.start(); return () => animation.stop();
  }, [selected, reduced, progress]);
  // Every displayed category uses its own canonical quote; never substitute another class's fare.
  const supported = validVehiclePrice(option?.price);
  const arrival = Number.isFinite(eta) && Number(eta) > 0 ? `${eta} min unna · ` : '';
  const seats = Number.isInteger(option?.passenger_seats) && option.passenger_seats > 0 ? option.passenger_seats : null;
  return <Pressable testID={`vehicle-${choice.type}`} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled: !supported }} aria-checked={selected} aria-disabled={!supported} disabled={!supported}
    onPress={() => { if (supported) onSelect(choice.type); }} style={[styles.vehicle, !supported && { opacity: .5 }]}>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 18, borderWidth: 1.5,
      borderColor: progress.interpolate({ inputRange: [0, 1], outputRange: ['transparent', colors.text] }), backgroundColor: progress.interpolate({ inputRange: [0, 1], outputRange: ['transparent', colors.cardSubtle] }) }]} />
    <V10CategoryImage kind={choice.type} selected={selected} />
    <View style={{ flex: 1 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Text style={v10.body}>{choice.name}</Text>{seats ? <><Text style={v10.caption}>· {seats}</Text><V10Icon name="user" size={12} color={colors.textMuted} /></> : null}</View><Text style={v10.caption}>{supported ? arrival + choice.note : 'Ikke tilgjengelig'}</Text></View>
    <View style={{ alignItems: 'flex-end', gap: 6 }}><Text style={{ fontFamily: font.semibold, fontSize: 17, color: colors.text, fontVariant: ['tabular-nums'] }}>{supported ? kr(option.price) : '—'}</Text>
      <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: selected ? 5 : 1.5, borderColor: selected ? colors.accent : colors.lineStrong }} /></View>
  </Pressable>;
}
export function validVehiclePrice(price: any) { return typeof price === 'number' && Number.isFinite(price) && price > 0; }
export function confirmedWaitingPolicy(policy: any): boolean {
  return typeof policy?.token === 'string' && policy.token.trim().length > 0
    && ['free_minutes', 'per_minute', 'max_fee'].every(key => typeof policy[key] === 'number' && Number.isFinite(policy[key]) && policy[key] >= 0);
}
export function cardExpiryLabel(card: any) {
  return Number.isInteger(card?.exp_month) && card.exp_month >= 1 && card.exp_month <= 12 && Number.isInteger(card.exp_year)
    ? `Utløper ${String(card.exp_month).padStart(2, '0')}/${String(card.exp_year).slice(-2)}` : null;
}
function PaymentChoice({ id, icon, title, subtitle, selected = false, disabled = false, onPress }: { id: string; icon: string; title: string; subtitle?: string; selected?: boolean; disabled?: boolean; onPress: () => void }) {
  useColorTheme();
  return <Pressable testID={`booking-pay-${id}`} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={() => { if (!disabled) onPress(); }} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14, opacity: disabled ? .5 : 1 }}>
    {id !== 'apple' ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.line }} /> : null}
    <View style={[v10.icon, { backgroundColor: colors.surface }]}><V10Icon name={icon} size={20} /></View><View style={{ flex: 1 }}><Text style={v10.body}>{title}</Text>{subtitle ? <Text style={[v10.caption, { marginTop: 2 }]}>{subtitle}</Text> : null}</View>
    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: selected ? 7 : 1.5, borderColor: selected ? colors.text : colors.lineStrong }} />
  </Pressable>;
}

export function arrivalTime(duration: any, quotedAt?: number | null) {
  if (duration == null || !Number.isFinite(Number(duration)) || Number(duration) < 0 || quotedAt == null || !Number.isFinite(quotedAt)) return '—';
  const arrival = new Date(quotedAt + Number(duration) * 60000);
  return Number.isFinite(arrival.getTime()) ? arrival.toLocaleTimeString('nb-NO', { timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit' }) : '—';
}
function Tool({ id, icon, label, onPress, target }: { id: string; icon: string; label: string; onPress: () => void; target?: RefObject<View | null> }) {
  useColorTheme(); return <Pressable testID={id} onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.tool}><V10Glass target={target} /><View style={{ zIndex: 1 }}><V10Icon name={icon} /></View></Pressable>; }
function Metric({ label, value }: { label: string; value: string }) {
  useColorTheme(); return <View style={{ flexShrink: 1 }}><Text style={v10.caption}>{label}</Text><Text style={[v10.heading, { fontVariant: ['tabular-nums'] }]}>{value}</Text></View>; }
function Info({ title, value, onPress }: { title: string; value: string; onPress?: () => void }) {
  useColorTheme(); const content = <><Text style={v10.caption}>{title}</Text><Text style={v10.body}>{value}</Text></>; return onPress ? <Pressable onPress={onPress} testID="booking-payment-row" style={styles.info}>{content}</Pressable> : <View style={styles.info}>{content}</View>; }
const styles = themedStyles(() => StyleSheet.create({
  tool: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glass, boxShadow: colors.elevation2, overflow: 'hidden' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 6, paddingRight: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.glass, flexShrink: 1, overflow: 'hidden', boxShadow: colors.elevation2 },
  avatar: { width: 32, height: 32, borderRadius: 11, backgroundColor: colors.cardSubtle, alignItems: 'center', justifyContent: 'center' },
  search: { height: 60, borderRadius: 16, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.cardSubtle, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  now: { height: 34, borderRadius: 12, backgroundColor: colors.surface, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chip: { minHeight: 44, borderRadius: 12, backgroundColor: colors.cardSubtle, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 190 },
  metrics: { flexDirection: 'row', gap: 24, marginVertical: 20, paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  info: { flex: 1, padding: 14, borderRadius: 16, backgroundColor: colors.cardSubtle, gap: 2 },
  vehicle: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 88, paddingVertical: 6, paddingLeft: 6, paddingRight: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
}));
