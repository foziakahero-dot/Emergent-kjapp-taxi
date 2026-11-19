import { BookingPrice } from './BookingPrice';
import { SheetFrame, SheetHandle } from './snar10/Sheet';
import { WebWalletSetup } from '@/src/components/WebWalletSetup';
import { ApplePaySetupButton } from '@/src/components/ApplePaySetupButton';
import React, { useEffect, useRef, useState, type RefObject } from 'react';
import { CustomerJourney, confirmedPaymentMethod, finiteMetric, paymentLabel } from '@/src/components/BookingPrimitives';
export { CustomerJourney, confirmedPaymentMethod, finiteMetric, paymentLabel } from '@/src/components/BookingPrimitives';
import { FigmaGradient } from './FigmaGradient';
import { V10Glass } from './V10Glass';
import { V10CustomerAvatar } from './V10CustomerAvatar';
import { V10Entrance } from './V10Entrance';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/src/components/Typography';
import { V10Icon } from '@/src/components/V10Icon';
import { V10Action, v10 } from '@/src/components/V10UI';
import { GooglePaySetupButton } from './GooglePaySetupButton';
import { AvailableDriverList } from './AvailableDriverList';
import { MapCarData } from '@/src/lib/liveCars';
import { V10CategoryImage } from './V10CategoryImage';
import { useReducedMotion } from '@/src/components/Motion';
import { colors, font, useColorTheme, themedStyles } from '@/src/theme';
import { kr } from '@/src/lib/format';
import { CUSTOMER_VEHICLE_ART } from '@/src/lib/vehicleAssets';
import type { BookingPaymentChoice } from '@/src/lib/usePaymentPreference';

export type BookingStage = 'route' | 'vehicles' | 'payment';
type PickupOption = { distance_km: number; eta_min: number | null };
type Props = {
  stage: BookingStage; reviewing: boolean; pickup: string; destination: any; estimate: any; quotedAt?: number | null; quoteFresh?: boolean;
  availableDrivers?: MapCarData[]; driverPosition?: { lat: number; lng: number } | null;
  pickupOptions?: Record<string, PickupOption>; pickupOptionsUnavailable?: boolean;
  vehicleEtas?: Record<string, number>; vehicle: string; price: number | null; nearest: number | null; payment: any; methods: any[];
  waitingPolicy: any; busy: boolean; canReview: boolean; canBook: boolean;
  error: string; firstName: string; initials: string; places: any[]; placesIssue: boolean;
  locationReady: boolean; locationHint?: string; locationActionLabel?: string; locationBusy?: boolean;
  onStage: (stage: BookingStage) => void; onReview: (value: boolean) => void;
  onVehicle: (type: string) => void; onSearch: (target: 'pickup' | 'dropoff') => void;
  onPlace: (place: any) => void; onLocate: () => void; onVoice: () => void; onProfile: () => void; onNotifications?: () => void; onSchedule?: () => void;
  onPlaces: () => void; onRetryPlaces: () => void; onPayment: () => void;
  onBook: () => void; onBack: () => void; onRetryQuote?: () => void; onHeight: (height: number) => void; onMinimize?: () => void; stops: any[];
  availability?: React.ReactNode; mapBlurTarget?: RefObject<View | null>; avatarVersion?: string;
  travelDetails?: React.ReactNode;
  onWalletSaved?: (card: any) => void | Promise<void>;
  cashEnabled?: boolean; cardEnabled?: boolean; cardPayment?: any; onPaymentChoice?: (choice: BookingPaymentChoice) => void;
  businessEnabled?: boolean; businessName?: string; onBusinessSetup?: () => void; vippsEnabled?: boolean;
  wallet?: { kind: 'apple' | 'google'; label: string } | null; onWallet?: () => void;
};
const vehicleNames: Record<string, string> = Object.fromEntries(Object.entries(CUSTOMER_VEHICLE_ART).map(([id, art]) => [id, art.label]));
export function CustomerBookingView(p: Props) {
  useColorTheme();
  const insets = useSafeAreaInsets();
  const [homeHeight, setHomeHeight] = useState(500);
  const vehicleName = vehicleNames[p.vehicle] || 'SNAR';
  const pickupOption = p.pickupOptions?.[p.vehicle];
  const pickupSummary = pickupOption ? pickupEstimate(pickupOption)
    : p.pickupOptions ? 'Ingen ledige sjåfører for denne biltypen akkurat nå. Velg en annen biltype, endre hentested eller søk likevel.'
    : p.pickupOptionsUnavailable ? 'Kan ikke sjekke ledige biler akkurat nå. Du kan fortsatt søke.'
    : 'Sjekker ledige biler ved hentestedet…';
  const pickupStatus = <Text testID="booking-pickup-availability" accessibilityLiveRegion="polite" style={[v10.secondary, { marginBottom: 12 }]}>{pickupSummary}</Text>;
  const stopFee = p.estimate?.options?.find((option: any) => option.vehicle_type === p.vehicle)?.extra_stop_fee_total;
  const priceDetails = p.quoteFresh !== false && validVehiclePrice(p.price) ? <Text testID="booking-price-details" style={[v10.secondary, { marginBottom: 12 }]}>
    Fastprisen inkluderer mva{validVehiclePrice(stopFee) ? ` og ${kr(stopFee)} for ekstra stopp` : ''}.{confirmedWaitingPolicy(p.waitingPolicy) && p.waitingPolicy.max_fee > 0 ? ' Venting utover inkludert tid kan koste ekstra.' : ''}
  </Text> : null;
  const locationActions = <View style={{ marginVertical: 12, gap: 6 }}>
    <Text style={v10.secondary}>{p.locationHint || 'Del posisjonen din, så kan du se ledige biler der du er.'}</Text>
    <V10Action testID="home-enable-location" label={p.locationActionLabel || 'Gi tilgang til posisjon'} icon="locate" busy={p.locationBusy} onPress={p.onLocate} />
    <V10Action kind="ghost" small testID={p.destination ? 'route-manual-pickup' : 'home-location-required'} label="Skriv inn hentested" onPress={() => p.onSearch('pickup')} />
  </View>;
  const sheet = (children: React.ReactNode, home = false) => <SheetFrame key={home ? 'home' : p.reviewing ? 'confirm' : p.stage} style={{ maxHeight: home ? '42%' : '70%' }}><ScrollView testID={p.reviewing ? 'booking-review-screen' : p.destination ? 'home-ride-sheet' : 'home-browse-sheet'}
    style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
    onLayout={event => { p.onHeight(event.nativeEvent.layout.height); if (home) setHomeHeight(event.nativeEvent.layout.height); }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: home ? Math.max(108, insets.bottom + 74) : Math.max(34, insets.bottom) }}>
    <Pressable testID="home-search-toggle" accessibilityRole="button" accessibilityLabel="Minimer til kart" disabled={!p.onMinimize} onPress={p.onMinimize} hitSlop={8}><SheetHandle /></Pressable>{children}</ScrollView></SheetFrame>;
  const back = () => p.reviewing ? p.onReview(false) : p.stage === 'payment' ? p.onStage('vehicles') : p.stage === 'vehicles' ? p.onStage('route') : p.onBack();
  const error = p.error ? <Text accessibilityRole="alert" testID="home-error" style={[v10.secondary, { color: colors.danger, marginVertical: 12 }]}>{p.error}</Text> : null;
  if (!p.destination) return <>
    <V10Entrance testID="home-header" style={{ position: 'absolute', top: Math.max(58, insets.top + 10), left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Pressable onPress={p.onProfile} accessibilityRole="button" accessibilityLabel="Åpne profilen" style={styles.identity}><V10Glass target={p.mapBlurTarget} /><V10CustomerAvatar initials={p.initials} version={p.avatarVersion} /><Text style={[v10.secondary, { color: colors.text, flexShrink: 1 }]} numberOfLines={1}>{p.firstName ? `Hei, ${p.firstName.charAt(0).toLocaleUpperCase('nb-NO')}${p.firstName.slice(1)}` : 'Min konto'}</Text></Pressable>
      <Tool id="home-notifications" icon="bell" label="Varsler" onPress={p.onNotifications || p.onProfile} target={p.mapBlurTarget} />
    </V10Entrance>
    {p.locationReady ? <View style={{ position: 'absolute', right: 20, bottom: homeHeight + 20, gap: 8 }}><Tool id="home-recenter" icon="locate" label="Min posisjon" onPress={p.onLocate} target={p.mapBlurTarget} /></View> : null}
    {sheet(<>
      <Pressable testID="home-where-to" accessibilityRole="button" accessibilityLabel="Søk etter reisemål" onPress={() => p.onSearch('dropoff')} style={styles.search}><V10Icon name="search" /><Text style={[v10.body, { flex: 1, fontSize: 18 }]}>Hvor skal du?</Text><Pressable testID="home-schedule" accessibilityRole="button" accessibilityLabel="Velg hentetid" disabled={!p.onSchedule} onPress={event => { event.stopPropagation(); p.onSchedule?.(); }} style={styles.now}><V10Icon name="clock" size={16} /><Text style={v10.caption}>Nå</Text></Pressable></Pressable>
      {!p.locationReady ? locationActions : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 12 }}>
        {p.places.map((place, i) => <Pressable key={place.id || `${place.name}-${i}`} testID={`quick-${place.label || i}`} onPress={() => p.onPlace(place)} accessibilityRole="button" style={styles.chip}><V10Icon name={place.label === 'Hjem' ? 'home' : place.label === 'Jobb' ? 'work' : place.icon === 'clock' ? 'clock' : 'destination'} size={18} /><Text style={v10.secondary} numberOfLines={1}>{place.label || place.name}</Text></Pressable>)}
        <Pressable testID="home-add-place" accessibilityRole="button" onPress={p.onPlaces} style={styles.chip}><V10Icon name="plus" size={18} /><Text style={v10.secondary}>Favoritter</Text></Pressable>
      </ScrollView>
      {p.locationReady ? p.availability : null}
      {p.placesIssue ? <Pressable testID="home-places-retry" onPress={p.onRetryPlaces}><Text testID="home-places-error" style={[v10.caption, { marginTop: 8 }]}>Kunne ikke oppdatere faste steder. Prøv igjen.</Text></Pressable> : null}
      <Pressable testID="home-ai-help" accessibilityRole="button" onPress={p.onVoice} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={v10.caption}>Bestill med tekst eller tale</Text></Pressable>
      {error}</>, true)}
  </>;
  return <><View style={{ position: 'absolute', top: Math.max(58, insets.top + 10), left: 20 }}><Tool id="booking-back" icon="chevL" label="Tilbake" onPress={back} target={p.mapBlurTarget} /></View>
    {sheet(p.reviewing ? <><Text style={[v10.heading, { marginBottom: 16 }]}>Bekreft tur</Text><CustomerJourney pickup={p.pickup} destination={p.destination.name} destinationDetail={arrivalTime(p.estimate?.duration_min, p.quotedAt) !== '—' ? `Ankomst ca. ${arrivalTime(p.estimate.duration_min, p.quotedAt)}` : p.destination.address} stops={p.stops} onPickup={() => p.onSearch('pickup')} onDestination={() => p.onSearch('dropoff')} />
      <View style={{ flexDirection: 'row', gap: 8, marginVertical: 20 }}><Info title="Kjøretøy" value={vehicleName} /><Info title="Betaling" value={!p.payment && p.cashEnabled ? 'Velg betalingsmåte' : paymentLabel(p.payment)} onPress={() => { p.onReview(false); p.onStage('payment'); }} /></View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}><Text style={v10.secondary}>Turpris</Text><BookingPrice amount={validVehiclePrice(p.price) ? p.price : null} large /></View>
      {priceDetails}{pickupStatus}
      {confirmedWaitingPolicy(p.waitingPolicy) ? <View style={{ marginBottom: 16 }}><Text testID="waiting-policy-notice" style={v10.secondary}>Ventetid: {p.waitingPolicy.free_minutes} min inkludert, deretter {kr(p.waitingPolicy.per_minute)}/min (maks {kr(p.waitingPolicy.max_fee)}).</Text><Text style={[v10.caption, { marginTop: 6 }]}>{p.payment?.type === 'cash' ? 'Du betaler turen og eventuell ventetid kontant til sjåføren etter turen.' : `Reserverer opptil ${kr(Number(p.price || 0) + p.waitingPolicy.max_fee)} ${p.payment?.type === 'vipps' ? 'med Vipps/MobilePay' : 'på kortet'}. Du betaler bare for turen og eventuell ventetid. Resten av reservasjonen frigjøres.`}</Text></View> : <View style={{ marginBottom: 16 }}><Text accessibilityRole="alert" style={v10.secondary}>Vi får ikke hentet prisen for ventetid akkurat nå.</Text>{p.onRetryQuote ? <V10Action testID="booking-refresh-quote" label="Oppdater tilbud" kind="soft" small onPress={p.onRetryQuote} disabled={p.busy} /> : null}</View>}
      {error}<V10Action testID="booking-confirm" label="Bekreft og bestill" disabled={!p.canBook} busy={p.busy} onPress={p.onBook} />
    </> : p.stage === 'route' ? <><CustomerJourney pickup={p.pickup} destination={p.destination.name} destinationDetail={p.destination.address} stops={p.stops} onPickup={() => p.onSearch('pickup')} onDestination={() => p.onSearch('dropoff')} />
      <View style={styles.metrics}><Metric label="Kjøretid" value={finiteMetric(p.estimate?.duration_min, 'min')} /><Metric label="Distanse" value={finiteMetric(p.estimate?.distance_km, 'km')} /><Metric label="Ankomst" value={arrivalTime(p.estimate?.duration_min, p.quotedAt)} /></View>
      {p.travelDetails}
      {!p.locationReady ? locationActions : null}
      {error}<View style={{ flexDirection: 'row', gap: 8 }}><View style={{ width: 56 }}><Pressable testID="route-adjust-pickup" accessibilityRole="button" accessibilityLabel="Juster hentested" onPress={() => p.onSearch('pickup')} style={{ height: 56, borderRadius: 16, backgroundColor: colors.cardSubtle, alignItems: 'center', justifyContent: 'center' }}><V10Icon name="pickup" /></Pressable></View><View style={{ flex: 1 }}><V10Action testID="route-choose-vehicle" label="Velg bil" disabled={!p.canReview} onPress={() => p.onStage('vehicles')} /></View></View>
    </> : p.stage === 'vehicles' ? <><Text style={[v10.title, { marginBottom: 4 }]}>Velg bil</Text><Text style={[v10.secondary, { marginBottom: 16 }]}>Fast pris før du bestiller</Text>
      <Text testID="booking-price-updates" accessibilityLiveRegion="polite" style={[v10.caption, { marginBottom: 10 }]}>{p.quoteFresh === false ? 'Henter ny pris …' : 'Du ser prisen før du bekrefter turen.'}</Text>
      <View style={{ gap: 6 }}>{vehicleChoices.map(choice => <VehicleChoice key={choice.type} choice={choice} selected={p.vehicle === choice.type} fresh={p.quoteFresh !== false}
        option={p.estimate?.options?.find((option: any) => option.vehicle_type === choice.type)}
        pickup={p.pickupOptions ? p.pickupOptions[choice.type] ?? null : undefined} onSelect={p.onVehicle} />)}</View>
      <View style={{ marginTop: 12 }}>{pickupStatus}{priceDetails}</View>
      {p.availableDrivers?.some(car => car.type === p.vehicle) ? <AvailableDriverList cars={p.availableDrivers.filter(car => car.type === p.vehicle)} point={p.driverPosition} /> : null}
      <Pressable testID="booking-payment-row" accessibilityRole="button" accessibilityLabel={`Endre betaling. ${paymentLabel(p.payment)}`} onPress={() => p.onStage('payment')} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 54, paddingHorizontal: 14, paddingVertical: 12, marginVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.surface }}><V10Icon name={p.payment?.type === 'cash' ? 'cash' : 'payment'} size={22} /><Text style={[v10.body, { flex: 1 }]}>{!p.payment && p.cashEnabled ? 'Velg betalingsmåte' : paymentLabel(p.payment)}</Text><Text style={v10.caption}>Endre</Text><V10Icon name="chevR" size={18} color={colors.textMuted} /></Pressable>
      {error}<V10Action testID="booking-review" label={`Bestill ${vehicleName} · ${kr(p.price)}`} disabled={!p.canReview} onPress={() => p.onReview(true)} />
    </> : <><Text style={[v10.heading, { marginBottom: 14 }]}>Betal med</Text>
      <View style={{ borderRadius: 22, overflow: 'hidden', backgroundColor: colors.cardSubtle }}>
        {Platform.OS === 'ios' ? p.wallet?.kind === 'apple' ? <View style={{ padding: 12, gap: 8 }}><Text style={v10.caption}>SNAR reserverer avtalt beløp ved bestilling og trekker det endelige turbeløpet etter turen.</Text><ApplePaySetupButton onPress={() => p.onWallet?.()} disabled={p.busy || !p.onWallet} testID="booking-pay-apple" /></View> : <PaymentChoice id="apple" icon="apple" title="Apple Pay" subtitle="Ikke tilgjengelig på denne enheten" disabled onPress={() => {}} /> : null}
        {Platform.OS === 'web' ? <WebWalletSetup disabled={p.busy} onSaved={async card => { await p.onWalletSaved?.(card); }} /> : null}
        <PaymentChoice id="card" icon="payment" title={paymentLabel(p.cardPayment)} disabled={p.cardEnabled === false || p.busy} subtitle={p.cardEnabled === false ? 'Kortbetaling er midlertidig utilgjengelig' : p.cardPayment ? cardExpiryLabel(p.cardPayment) || 'Verifisert betalingskort' : 'Verifiser et kort før bestilling'} selected={!!p.payment && !['cash', 'business', 'vipps'].includes(p.payment.type)} onPress={() => { p.onPaymentChoice?.('card'); p.cardPayment ? p.onStage('vehicles') : p.onPayment(); }} />
        {p.cashEnabled ? <PaymentChoice id="cash" icon="cash" title="Kontant" subtitle="Betal direkte til sjåføren etter turen" selected={p.payment?.type === 'cash'} disabled={p.busy} onPress={() => p.onPaymentChoice?.('cash')} /> : null}
        {Platform.OS === 'android' ? p.wallet?.kind === 'google' ? <View style={{ gap: 8, paddingVertical: 10 }}><Text style={v10.caption}>Lagre Google Pay for turene du bestiller. Avtalt beløp reserveres før turen og belastes når turen avsluttes.</Text><GooglePaySetupButton disabled={p.busy || !p.onWallet} onPress={() => p.onWallet?.()} testID="booking-pay-google" /></View>
          : <PaymentChoice id="google" icon="google" title="Google Pay" subtitle="Ikke tilgjengelig på denne enheten" disabled onPress={() => {}} /> : null}
        {p.businessEnabled ? <PaymentChoice id="business" icon="work" title="Bedriftskort"
          subtitle={p.businessName || 'Koble et verifisert kort og organisasjonsnummer'}
          selected={p.payment?.type === 'business'} disabled={p.busy || !p.onBusinessSetup}
          onPress={() => { if (p.businessName) { p.onPaymentChoice?.('business'); p.onStage('vehicles'); } else p.onBusinessSetup?.(); }} /> : null}
        {p.vippsEnabled ? <PaymentChoice id="vipps" icon="payment" title="Vipps/MobilePay"
          subtitle="Godkjenn reservasjonen i Vipps/MobilePay"
          selected={p.payment?.type === 'vipps'} disabled={p.busy}
          onPress={() => { p.onPaymentChoice?.('vipps'); p.onStage('vehicles'); }} /> : null}
      </View>
      {p.businessEnabled && p.businessName && p.onBusinessSetup ? <V10Action kind="ghost" small label="Endre bedriftskort" onPress={p.onBusinessSetup} disabled={p.busy} testID="booking-edit-business-card" /> : null}
      <View style={{ marginTop: 12 }}><V10Action testID="booking-add-payment" kind="soft" small icon="plus" label="Legg til betalingsmåte" onPress={p.onPayment} /></View>
      <Text style={[v10.caption, { marginTop: 12 }]}>{p.payment?.type === 'cash' ? 'Betal sjåføren kontant når turen er over.' : p.payment?.type === 'vipps' ? 'Betalingen bekreftes i Vipps/MobilePay før sjåførsøket starter.' : p.payment?.type === 'business' ? 'Du får kvittering med bedriftens navn og organisasjonsnummer etter betaling.' : 'Turen reserveres på den verifiserte betalingsmåten under Betalingsmåter.'}</Text>
      <V10Action testID="booking-payment-done" kind="ghost" label="Tilbake til bilvalg" onPress={() => p.onStage('vehicles')} />{error}</>)}
  </>;
}
const vehicleChoices = [
  { type: 'ai-first', name: CUSTOMER_VEHICLE_ART['ai-first'].label, note: 'Rask og enkel' },
  { type: 'premium', name: 'Premium', note: 'Ekstra komfort' },
  { type: 'suv', name: 'SUV', note: 'Mer plass' },
  { type: 'trygg', name: 'SNAR XL', note: 'For flere reisende' },
] as const;
function pickupEstimate(pickup: PickupOption) {
  const minutes = pickup.eta_min;
  const distance = pickup.distance_km.toLocaleString('nb-NO');
  return minutes != null ? `Ca. ${minutes} min til henting · ${distance} km unna` : `Nærmeste ledige bil er ${distance} km unna`;
}
function VehicleChoice({ choice, option, selected, fresh, pickup, onSelect }: { choice: typeof vehicleChoices[number]; option: any; selected: boolean; fresh: boolean; pickup?: PickupOption | null; onSelect: (type: string) => void }) {
  useColorTheme();
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    progress.stopAnimation();
    if (reduced) { progress.setValue(selected ? 1 : 0); return; }
    const animation = Animated.timing(progress, { toValue: selected ? 1 : 0, duration: 220, easing: Easing.bezier(.2, .8, .2, 1), useNativeDriver: true });
    animation.start(); return () => animation.stop();
  }, [selected, reduced, progress]);
  // Comfort is a distinct source class; legacy "enkelt" is not a Comfort contract.
  const supported = validVehiclePrice(option?.price);
  const disabled = !supported || !fresh;
  const seats = Number.isInteger(option?.passenger_seats) && option.passenger_seats > 0 ? option.passenger_seats : null;
  const availability = pickup ? pickupEstimate(pickup) : pickup === null ? 'Ingen ledige akkurat nå' : '';
  return <Pressable testID={`vehicle-${choice.type}`} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled }} disabled={disabled}
    accessibilityLabel={`${choice.name}${seats ? `, ${seats} seter` : ''}. ${!fresh ? 'Oppdaterer pris' : supported ? kr(option.price) : 'Ikke tilgjengelig'}${supported && availability ? `. ${availability}` : ''}`}
    onPress={() => { if (!disabled) onSelect(choice.type); }} style={[styles.vehicle, disabled && { opacity: .5 }]}>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 18, borderWidth: 1.5,
      opacity: progress, borderColor: colors.accent, backgroundColor: colors.accentSoft }]} />
    <V10CategoryImage kind={choice.type} selected={selected} />
    <View style={{ flex: 1, minWidth: 0 }}><Text style={[v10.body, { fontFamily: font.semibold }]}>{choice.name}</Text><Text style={[v10.caption, { marginTop: 3 }]}>{supported ? availability || (seats ? `${seats} seter` : choice.note) : 'Ikke tilgjengelig'}</Text></View>
    <BookingPrice amount={supported ? option.price : null} />
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
  tool: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', boxShadow: colors.elevation2, overflow: 'hidden' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 6, paddingRight: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: 'transparent', flexShrink: 1, overflow: 'hidden', boxShadow: colors.elevation2 },
  avatar: { width: 32, height: 32, borderRadius: 11, backgroundColor: colors.cardSubtle, alignItems: 'center', justifyContent: 'center' },
  search: { height: 60, borderRadius: 16, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.cardSubtle, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  now: { height: 34, borderRadius: 12, backgroundColor: colors.surface, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chip: { minHeight: 44, borderRadius: 12, backgroundColor: colors.cardSubtle, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 190 },
  metrics: { flexDirection: 'row', gap: 24, marginVertical: 20, paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  info: { flex: 1, padding: 14, borderRadius: 16, backgroundColor: colors.cardSubtle, gap: 2 },
  vehicle: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 82, paddingVertical: 10, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: 18, overflow: 'hidden' },
}));
