import React, { type RefObject } from 'react';
import { V10Glass } from './V10Glass';
import { V10CustomerAvatar } from './V10CustomerAvatar';
import { V10Entrance } from './V10Entrance';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/src/components/Typography';
import { V10Icon } from '@/src/components/V10Icon';
import { V10Action, v10 } from '@/src/components/V10UI';
import { VehicleAsset } from '@/src/components/VehicleAsset';
import { colors, font, useColorTheme, themedStyles } from '@/src/theme';
import { kr } from '@/src/lib/format';

export type BookingStage = 'route' | 'vehicles' | 'payment';
export function confirmedPaymentMethod(methods: any[]) {
  // Mirror the reservation service: verified Stripe instruments, default first, newest next.
  return methods.filter(m => m.verified === true && m.setup_status === 'succeeded' && typeof m.stripe_payment_method_id === 'string' && m.stripe_payment_method_id.length > 0)
    .sort((a, b) => Number(Boolean(b.is_default)) - Number(Boolean(a.is_default)) || String(b.created_at || '').localeCompare(String(a.created_at || '')))[0];
}
export function paymentLabel(method: any) {
  return method ? `${method.label || method.type || 'Kort'}${method.last4 ? ` ·· ${method.last4}` : ''}` : 'Legg til betalingskort';
}
export function CustomerJourney({ pickup, destination, stops = [], onPickup, onDestination }: { pickup: string; destination?: string; stops?: any[]; onPickup?: () => void; onDestination?: () => void }) {
  useColorTheme();
  const rows: { name: string; action?: () => void }[] = [{ name: pickup, action: onPickup }, ...stops.map(stop => ({ name: stop.name || stop.address })), { name: destination || 'Velg reisemål', action: onDestination }];
  return <View style={{ gap: 10 }}>{rows.map((row, i) => <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
    <View style={{ width: 20, alignItems: 'center' }}><View style={{ width: 10, height: 10, borderRadius: i === 0 ? 5 : 3, backgroundColor: i === 0 ? colors.accent : colors.text }} /></View>
    {row.action ? <Pressable testID={i === 0 ? 'booking-edit-pickup' : 'booking-change-dest'} accessibilityRole="button" onPress={row.action} style={{ flex: 1, minHeight: 36, justifyContent: 'center' }}><Text style={v10.body} numberOfLines={2}>{row.name}</Text></Pressable> : <Text style={[v10.body, { flex: 1 }]} numberOfLines={2}>{row.name}</Text>}
  </View>)}</View>;
}
type Props = {
  stage: BookingStage; reviewing: boolean; pickup: string; destination: any; estimate: any;
  vehicle: string; price: number | null; nearest: number | null; payment: any; methods: any[];
  waitingPolicy: any; waitingAccepted: boolean; busy: boolean; canReview: boolean; canBook: boolean;
  error: string; firstName: string; initials: string; places: any[]; placesIssue: boolean;
  locationReady: boolean; onStage: (stage: BookingStage) => void; onReview: (value: boolean) => void;
  onVehicle: (type: string) => void; onSearch: (target: 'pickup' | 'dropoff') => void;
  onPlace: (place: any) => void; onLocate: () => void; onVoice: () => void; onProfile: () => void; onNotifications?: () => void;
  onPlaces: () => void; onRetryPlaces: () => void; onPayment: () => void; onConsent: () => void;
  onBook: () => void; onBack: () => void; onHeight: (height: number) => void; stops: any[];
  availability?: React.ReactNode; mapBlurTarget?: RefObject<View | null>; avatarVersion?: string;
};
const vehicleNames: Record<string, string> = { 'ai-first': 'SNAR', trygg: 'SNAR XL', premium: 'Premium' };
export function CustomerBookingView(p: Props) {
  useColorTheme();
  const insets = useSafeAreaInsets();
  const vehicleName = vehicleNames[p.vehicle] || 'SNAR';
  const sheet = (children: React.ReactNode, home = false) => <V10Entrance sheet style={[styles.sheet, { maxHeight: '78%' }]}><ScrollView testID={p.reviewing ? 'booking-review-screen' : p.destination ? 'home-ride-sheet' : 'home-browse-sheet'}
    style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
    onLayout={event => p.onHeight(event.nativeEvent.layout.height)} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: home ? insets.bottom + 108 : insets.bottom + 24 }}>
    <View style={styles.handle} />{children}</ScrollView></V10Entrance>;
  const back = () => p.reviewing ? p.onReview(false) : p.stage === 'payment' ? p.onStage('vehicles') : p.stage === 'vehicles' ? p.onStage('route') : p.onBack();
  const error = p.error ? <Text accessibilityRole="alert" testID="home-error" style={[v10.secondary, { color: colors.danger, marginVertical: 12 }]}>{p.error}</Text> : null;
  if (!p.destination) return <>
    <V10Entrance testID="home-header" style={{ position: 'absolute', top: Math.max(58, insets.top + 10), left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Pressable onPress={p.onProfile} accessibilityRole="button" accessibilityLabel="Åpne profilen" style={styles.identity}><V10Glass target={p.mapBlurTarget} /><V10CustomerAvatar initials={p.initials} version={p.avatarVersion} /><Text style={[v10.secondary, { color: colors.text, flexShrink: 1 }]} numberOfLines={1}>Hei, {p.firstName}</Text></Pressable>
      <Tool id="home-notifications" icon="bell" label="Varsler" onPress={p.onNotifications || p.onProfile} target={p.mapBlurTarget} />
    </V10Entrance>
    <View style={{ position: 'absolute', right: 20, bottom: insets.bottom + 316, gap: 8 }}><Tool id="home-voice" icon="voice" label="Snakk med SNAR" onPress={p.onVoice} target={p.mapBlurTarget} /><Tool id="home-recenter" icon="locate" label="Min posisjon" onPress={p.onLocate} target={p.mapBlurTarget} /></View>
    {sheet(<><Pressable testID="home-where-to" accessibilityRole="button" accessibilityLabel="Søk etter destinasjon" onPress={() => p.onSearch('dropoff')} style={styles.search}><V10Icon name="search" /><Text style={[v10.body, { flex: 1, fontSize: 18 }]}>Hvor skal du?</Text><View style={styles.now}><V10Icon name="clock" size={16} /><Text style={v10.caption}>Nå</Text></View></Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 12 }}>
        {p.places.slice(0, 3).map((place, i) => <Pressable key={place.id || `${place.name}-${i}`} testID={`quick-${place.label || i}`} onPress={() => p.onPlace(place)} accessibilityRole="button" style={styles.chip}><V10Icon name={place.label === 'Hjem' ? 'home' : place.label === 'Jobb' ? 'work' : 'clock'} size={18} /><Text style={v10.secondary} numberOfLines={1}>{place.label || place.name}</Text></Pressable>)}
        {!p.places.length && <Pressable testID="home-add-place" onPress={p.onPlaces} style={styles.chip}><V10Icon name="plus" size={18} /><Text style={v10.secondary}>Legg til fast sted</Text></Pressable>}
      </ScrollView>
      {!p.locationReady ? <Pressable testID="home-location-required" onPress={() => p.onSearch('pickup')} style={{ paddingTop: 12 }}><Text style={v10.secondary}>Velg hentested eller del posisjonen din.</Text></Pressable> : p.availability}
      {p.placesIssue ? <Pressable testID="home-places-retry" onPress={p.onRetryPlaces}><Text testID="home-places-error" style={[v10.caption, { marginTop: 8 }]}>Kunne ikke oppdatere faste steder. Prøv igjen.</Text></Pressable> : null}{error}</>, true)}
  </>;
  return <><View style={{ position: 'absolute', top: Math.max(58, insets.top + 10), left: 20 }}><Tool id="booking-back" icon="chevL" label="Tilbake" onPress={back} /></View>
    {sheet(p.reviewing ? <><Text style={[v10.heading, { marginBottom: 16 }]}>Bekreft tur</Text><CustomerJourney pickup={p.pickup} destination={p.destination.name} stops={p.stops} onPickup={() => p.onSearch('pickup')} onDestination={() => p.onSearch('dropoff')} />
      <View style={{ flexDirection: 'row', gap: 8, marginVertical: 20 }}><Info title="Kjøretøy" value={vehicleName} /><Info title="Betaling" value={paymentLabel(p.payment)} onPress={() => { p.onReview(false); p.onStage('payment'); }} /></View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}><Text style={v10.secondary}>Fast pris, inkl. mva</Text><Text style={v10.title}>{kr(p.price)}</Text></View>
      {p.waitingPolicy ? <Pressable testID="waiting-policy-consent" accessibilityRole="checkbox" accessibilityState={{ checked: p.waitingAccepted }} onPress={p.onConsent} style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}><V10Icon name={p.waitingAccepted ? 'check' : 'clock'} size={20} /><Text style={[v10.secondary, { flex: 1 }]}>Jeg godtar {p.waitingPolicy.free_minutes} min gratis ventetid, deretter {kr(p.waitingPolicy.per_minute)}/min, maks {kr(p.waitingPolicy.max_fee)}. Kortet reserveres for opptil {kr(Number(p.price || 0) + p.waitingPolicy.max_fee)}. Bare turpris og faktisk ventetid trekkes; resten frigjøres.</Text></Pressable> : null}
      {error}<V10Action testID="booking-confirm" label="Bekreft og bestill" disabled={!p.canBook} busy={p.busy} onPress={p.onBook} />
    </> : p.stage === 'route' ? <><CustomerJourney pickup={p.pickup} destination={p.destination.name} stops={p.stops} onPickup={() => p.onSearch('pickup')} onDestination={() => p.onSearch('dropoff')} />
      <View style={styles.metrics}><Metric label="Kjøretid" value={finiteMetric(p.estimate?.duration_min, 'min')} /><Metric label="Distanse" value={finiteMetric(p.estimate?.distance_km, 'km')} /></View>
      {error}<View style={{ flexDirection: 'row', gap: 8 }}><View style={{ width: 56 }}><Pressable testID="route-adjust-pickup" accessibilityRole="button" accessibilityLabel="Juster hentested" onPress={() => p.onSearch('pickup')} style={{ height: 56, borderRadius: 16, backgroundColor: colors.cardSubtle, alignItems: 'center', justifyContent: 'center' }}><V10Icon name="pickup" /></Pressable></View><View style={{ flex: 1 }}><V10Action testID="route-choose-vehicle" label="Velg bil" disabled={!p.canReview} onPress={() => p.onStage('vehicles')} /></View></View>
    </> : p.stage === 'vehicles' ? <><View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 12 }}><Text style={[v10.heading, { flex: 1 }]}>Velg bil</Text><Text style={v10.caption} numberOfLines={1}>{finiteMetric(p.estimate?.duration_min, 'min')}</Text></View>
      <View style={{ gap: 6 }}>{(['ai-first', 'trygg', 'premium'] as const).map(type => { const option = p.estimate?.options?.find((o: any) => o.vehicle_type === type); const selected = p.vehicle === type; return <Pressable testID={`vehicle-${type}`} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled: option?.price == null }} disabled={option?.price == null} key={type} onPress={() => p.onVehicle(type)} style={[styles.vehicle, selected && { backgroundColor: colors.cardSubtle, borderColor: colors.text }, option?.price == null && { opacity: .5 }]}>
        <View style={{ width: 84, height: 50, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface }}><VehicleAsset kind={type} width={84} height={50} selected={selected} /></View><View style={{ flex: 1 }}><Text style={v10.body}>{vehicleNames[type]}</Text><Text style={v10.caption}>{selected && p.nearest != null ? `${p.nearest} min unna` : type === 'trygg' ? 'Mer plass' : type === 'premium' ? 'Premium' : 'Rask og enkel'}</Text></View><Text style={{ fontFamily: font.semibold, fontSize: 17, color: colors.text }}>{option?.price == null ? '—' : kr(option.price)}</Text></Pressable>; })}</View>
      <Pressable testID="booking-payment-row" onPress={() => p.onStage('payment')} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 48, marginVertical: 8 }}><V10Icon name="payment" size={20} /><Text style={[v10.body, { flex: 1 }]}>{paymentLabel(p.payment)}</Text><V10Icon name="chevR" size={18} color={colors.textMuted} /></Pressable>
      {error}<V10Action testID="booking-review" label={`Bestill ${vehicleName} · ${kr(p.price)}`} disabled={!p.canReview} onPress={() => p.onReview(true)} />
    </> : <><Text style={[v10.heading, { marginBottom: 14 }]}>Betal med</Text><View style={{ padding: 16, borderRadius: 22, backgroundColor: colors.cardSubtle }}><View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}><V10Icon name="payment" /><View style={{ flex: 1 }}><Text style={v10.body}>{paymentLabel(p.payment)}</Text><Text style={v10.caption}>{p.payment ? 'Kort for denne bestillingen' : 'Verifiser et kort før bestilling'}</Text></View>{p.payment ? <V10Icon name="check" size={22} /> : null}</View></View>
      <Text style={[v10.secondary, { marginVertical: 12 }]}>Turen reserveres på ditt verifiserte standardkort. Du kan administrere kortene dine nedenfor.</Text><V10Action testID="booking-add-payment" kind="soft" small icon="plus" label="Administrer betalingskort" onPress={p.onPayment} /><View style={{ marginTop: 12 }}><V10Action testID="booking-payment-done" kind="ghost" label="Tilbake til bilvalg" onPress={() => p.onStage('vehicles')} /></View>{error}</>)}
  </>;
}
export function finiteMetric(value: any, unit: string) { return value != null && Number.isFinite(Number(value)) && Number(value) >= 0 ? `${Number(value).toLocaleString('nb-NO', { maximumFractionDigits: 1 })} ${unit}` : '—'; }
function Tool({ id, icon, label, onPress, target }: { id: string; icon: string; label: string; onPress: () => void; target?: RefObject<View | null> }) {
  useColorTheme(); return <Pressable testID={id} onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.tool}><V10Glass target={target} /><View style={{ zIndex: 1 }}><V10Icon name={icon} /></View></Pressable>; }
function Metric({ label, value }: { label: string; value: string }) {
  useColorTheme(); return <View><Text style={v10.caption}>{label}</Text><Text style={v10.heading}>{value}</Text></View>; }
function Info({ title, value, onPress }: { title: string; value: string; onPress?: () => void }) {
  useColorTheme(); const content = <><Text style={v10.caption}>{title}</Text><Text style={v10.body}>{value}</Text></>; return onPress ? <Pressable onPress={onPress} testID="booking-payment-row" style={styles.info}>{content}</Pressable> : <View style={styles.info}>{content}</View>; }
const styles = themedStyles(() => StyleSheet.create({
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: colors.surface, boxShadow: '0 -6px 28px rgba(11,26,44,.12)' },
  handle: { width: 36, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong, alignSelf: 'center', marginBottom: 14 },
  tool: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glass, boxShadow: colors.elevation2, overflow: 'hidden' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 6, paddingRight: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.glass, flexShrink: 1, overflow: 'hidden', boxShadow: colors.elevation2 },
  avatar: { width: 32, height: 32, borderRadius: 11, backgroundColor: colors.cardSubtle, alignItems: 'center', justifyContent: 'center' },
  search: { height: 60, borderRadius: 16, backgroundColor: colors.cardSubtle, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  now: { height: 34, borderRadius: 12, backgroundColor: colors.surface, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chip: { minHeight: 44, borderRadius: 12, backgroundColor: colors.cardSubtle, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 190 },
  metrics: { flexDirection: 'row', gap: 24, marginVertical: 20, paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  info: { flex: 1, padding: 14, borderRadius: 16, backgroundColor: colors.cardSubtle, gap: 2 },
  vehicle: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingLeft: 6, paddingRight: 14, borderRadius: 18, borderWidth: 1.5, borderColor: 'transparent' },
}));
