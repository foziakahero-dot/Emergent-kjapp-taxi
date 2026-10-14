import React, { useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/src/components/Typography';
import { DesignToggle } from '@/src/components/DesignToggle';
import { V10Icon } from '@/src/components/V10Icon';
import { V10Action, V10Badge, V10Sheet, V10State, v10 } from '@/src/components/V10UI';
import { AvailabilityStatus } from '@/src/components/AvailabilityStatus';
import { CustomerJourney } from '@/src/components/CustomerBookingView';
import { V10SearchIndicator } from '@/src/components/V10SearchIndicator';
import { V10Entrance } from '@/src/components/V10Entrance';
import { V10Glass } from '@/src/components/V10Glass';
import type { RefObject } from 'react';
import { destinationProximity, driverApproaching, pickupFreeWait } from '@/src/lib/tripPresence';
import { kr } from '@/src/lib/format';
import { colors, font, useColorTheme } from '@/src/theme';

type Props = { trip: any; driverPhoto: any; eta: number | null; distance: string | null; offline: boolean; gpsFresh: boolean; available: React.ComponentProps<typeof AvailabilityStatus>['search']; insideBusy: boolean; readyBusy: boolean; readySent?: boolean; authorizationBusy: boolean; cancelBusy: boolean; canCancel: boolean; onGuideChange?: (open: boolean) => void; mapBlurTarget?: RefObject<View | null>;
  onInside: (inside: boolean) => void; onCall: () => void; onChat: () => void; onShare: () => void; onSafety: () => void; onCancel: () => void; onMinimize: () => void; onHome: () => void; onWalk: () => void; onReady: () => void; onAuthorize: () => void; onPhotoError: () => void; onSheetLayout: (height: number) => void };
function DriverCard({ p, compact = false }: { p: Props; compact?: boolean }) {
  useColorTheme();
  const name = p.trip.driver?.name || 'Sjåføren din', size = compact ? 48 : 56;
  return <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
    <View style={{ width: size, height: size, borderRadius: size * .34, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardSubtle }}>{p.driverPhoto ? <Image source={p.driverPhoto} style={{ width: size, height: size }} onError={p.onPhotoError} testID="customer-driver-photo" /> : <Text style={{ fontFamily: font.semibold, fontSize: size * .36 }}>{name.split(' ').map((part: string) => part[0]).join('').slice(0, 2)}</Text>}</View>
    <View style={{ flex: 1 }}><Text style={v10.body}>{name.trim().split(/\s+/)[0]}{typeof p.trip.driver?.rating === 'number' && Number.isFinite(p.trip.driver.rating) ? <Text style={v10.caption}> ★ {p.trip.driver.rating.toLocaleString('nb-NO', { maximumFractionDigits: 2 })}</Text> : null}</Text><Text style={v10.secondary}>{p.trip.driver?.car || 'Bilinformasjon ikke tilgjengelig'}</Text></View>
    {p.trip.driver?.plate ? <Text style={{ color: colors.text, fontFamily: font.semibold, fontSize: 15, letterSpacing: .9, lineHeight: 20, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: colors.cardSubtle, borderWidth: 1, borderColor: colors.lineStrong }}>{p.trip.driver.plate}</Text> : null}
  </View>;
}
function Contacts({ p }: { p: Props }) {
  useColorTheme(); return <View style={{ flexDirection: 'row', gap: 8 }}><View style={{ flex: 1 }}><V10Action height={52} kind="soft" small icon="phone" label="Ring" onPress={p.onCall} disabled={!p.trip.driver?.phone} testID="action-call-driver" /></View><View style={{ flex: 1 }}><V10Action height={52} kind="soft" small icon="message" label="Melding" onPress={p.onChat} testID="action-message" /></View></View>; }
export function CustomerTripView(p: Props) {
  useColorTheme();
  const insets = useSafeAreaInsets();
  const [guide, setGuide] = useState(false);
  useEffect(() => { p.onGuideChange?.(guide); return () => p.onGuideChange?.(false); }, [guide, p.onGuideChange]);
  useEffect(() => setGuide(false), [p.trip.trip_id, p.trip.status]);
  const status = p.trip.status;
  const announcedDriver = useRef('');
  const announcedArrival = useRef('');
  useEffect(() => {
    if (!['driver_on_way', 'at_pickup'].includes(status) || !p.trip.driver_id || p.offline) return;
    const key = `${p.trip.trip_id}:${p.trip.driver_id}`;
    const marker = status === 'at_pickup' ? announcedArrival : announcedDriver;
    if (marker.current === key) return;
    marker.current = key;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, [p.trip.trip_id, p.trip.driver_id, status, p.offline]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (status !== 'at_pickup' || p.offline) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [status, p.offline, p.trip.trip_id]);
  const freeWait = !p.offline ? pickupFreeWait(p.trip, now) : null;
  const displayedEta = !p.offline && p.gpsFresh && typeof p.eta === 'number' && Number.isFinite(p.eta) && p.eta > 0 ? p.eta : null;
  const approaching = !p.offline && p.gpsFresh && driverApproaching(p.trip);
  const proximity = !p.offline ? destinationProximity(p.trip) : null;
  const searching = ['searching', 'booking'].includes(status);
  const cancelled = ['cancelled', 'cancelled_by_driver'].includes(status);
  const noDriver = status === 'cancelled' && p.trip.cancel_reason === 'no_driver_available';
  const first = (p.trip.driver?.name || 'Sjåføren').split(' ')[0];
  const network = p.offline || !p.gpsFresh ? <Text accessibilityRole="alert" style={[v10.caption, { marginTop: 8, marginBottom: 8 }]}>{p.offline ? 'Venter på oppdatert turstatus.' : 'Venter på oppdatert sjåførposisjon.'}</Text> : null;
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    {status === 'in_trip' ? <V10Entrance style={{ position: 'absolute', top: Math.max(58, insets.top + 10), left: 20, right: 20, borderRadius: 20, overflow: 'hidden', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.glass, flexDirection: 'row', gap: 12, alignItems: 'center' }}><V10Glass target={p.mapBlurTarget} /><View style={[v10.icon, { width: 36, height: 36, backgroundColor: colors.surfaceInverse }]}><V10Icon name="destination" size={18} color={colors.onInverse} /></View><View style={{ flex: 1 }}><Text style={v10.body}>{p.trip.dropoff_address}</Text><Text style={v10.caption}>{p.offline || !p.gpsFresh ? 'Venter på oppdatering' : 'Turen pågår'}</Text></View></V10Entrance> : null}
    <V10Sheet key={`${p.trip.trip_id}-${status}-${guide ? 'guide' : 'main'}`} testID={searching ? 'booking-matching-card' : status === 'in_trip' ? 'customer-trip-sheet' : 'customer-pickup-sheet'} onMinimize={status === 'in_trip' ? p.onMinimize : undefined} onLayout={event => p.onSheetLayout(event.nativeEvent.layout.height)} paddingBottom={status === 'in_trip' ? Math.max(106, insets.bottom + 90) : 34}>
      {status === 'payment_authorizing' ? <><V10State icon="payment" title="Godkjenn kortreservasjonen" body="Ingen sjåfør bestilles før banken har godkjent turbeløpet." /><View style={{ marginTop: 20 }}><V10Action label="Godkjenn turbeløpet" onPress={p.onAuthorize} disabled={p.offline} busy={p.authorizationBusy} testID="booking-authorize" /></View>{p.canCancel ? <V10Action kind="ghost" label="Avbestill tur" onPress={p.onCancel} busy={p.cancelBusy} /> : null}</> : searching ? <>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}><V10SearchIndicator /><View style={{ flex: 1 }}><Text style={v10.heading}>Finner sjåfør</Text><Text style={v10.secondary}>Ved {p.trip.pickup_address || 'valgt hentested'}</Text></View></View>
        <V10SearchIndicator bar />
        <CustomerJourney pickup={p.trip.pickup_address || 'Valgt hentested'} destination={p.trip.dropoff_address} />
        <View style={{ marginVertical: 16 }}><AvailabilityStatus search={p.available} trip={p.trip} /></View>
        {p.offline ? <Text testID="search-trip-offline" accessibilityRole="alert" style={v10.caption}>Mangler fersk turstatus. Søket fortsetter på serveren.</Text> : null}
        <V10Action kind="ghost" label="Avbryt søk" onPress={p.onCancel} disabled={!p.canCancel} busy={p.cancelBusy} testID="searching-cancel" />
      </> : cancelled ? <>
        <V10State icon={noDriver ? 'vehicle' : 'x'} title={noDriver ? 'Ingen ledig bil akkurat nå' : status === 'cancelled_by_driver' ? 'Sjåføren måtte avbryte' : 'Turen ble avbrutt'} body={noDriver ? 'Vi fant ingen sjåfør etter tre forsøk. Vil du prøve igjen om litt?' : 'Ingen aktiv tur pågår. Du kan starte en ny bestilling.'} />
        {noDriver ? <Text style={[v10.secondary, { marginTop: 12 }]}>{p.trip.reservation_status === 'released' ? 'Kortreservasjonen er frigitt. Banken kan bruke litt tid på å oppdatere saldoen.' : 'Kortreservasjonen frigis automatisk.'}</Text> : null}
        <View style={{ marginTop: 20 }}><V10Action label={noDriver ? 'Prøv igjen' : 'Tilbake til hjem'} onPress={p.onHome} testID="booking-home" /></View>
      </> : status === 'driver_on_way' ? guide ? <>
        <Text style={v10.caption}>{p.distance || 'Henteveiledning'}</Text><Text style={[v10.title, { marginTop: 2 }]}>Mot hentestedet</Text>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', padding: 14, borderRadius: 18, backgroundColor: colors.cardSubtle, marginTop: 16 }}><View style={[v10.icon, { backgroundColor: colors.surface }]}><V10Icon name="walk" size={20} /></View><View style={{ flex: 1 }}><Text style={v10.body}>{p.trip.pickup_address || 'Avtalt hentested'}</Text><Text style={v10.caption}>Følg gangveiledningen til det avtalte hentestedet.</Text></View></View>
        <Text style={[v10.overline, { marginTop: 18, marginBottom: 8 }]}>Se etter</Text><DriverCard p={p} compact />
        <View style={{ marginTop: 16 }}><Contacts p={p} /></View><View style={{ marginTop: 10 }}><V10Action kind="ink" label="Åpne gangveiledning" onPress={p.onWalk} testID="pickup-walking-directions" /><V10Action kind="ghost" label="Tilbake" onPress={() => setGuide(false)} /></View>
      </> : <>
        <View testID="driver-arrival-eta" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}><View style={{ flex: 1 }}><Text style={v10.caption}>{approaching ? 'Ankommer hentestedet' : 'Sjåfør funnet'}</Text><Text style={v10.title}>{first} er på vei</Text></View><Text style={{ fontFamily: font.semibold, fontSize: 32, lineHeight: 38, fontVariant: ['tabular-nums'] }}>{displayedEta ?? '—'}<Text style={v10.secondary}> min</Text></Text></View>
        <DriverCard p={p} />{network}
        <View style={{ flexDirection: 'row', gap: 14, paddingTop: 14, paddingBottom: 6, minHeight: 44, alignItems: 'center' }}><V10Icon name="inside" size={20} /><Text style={[v10.body, { flex: 1 }]}>Jeg venter inne</Text><DesignToggle label="Jeg venter inne" value={p.trip.pickup_waiting_inside === true} onChange={p.onInside} disabled={p.insideBusy || p.offline} testID="customer-waiting-inside" /></View>
        <View style={{ marginTop: 10 }}><Contacts p={p} /></View><V10Action kind="ghost" small label="Vis henteveiledning" onPress={() => setGuide(true)} testID="customer-pickup-guide" />
        {p.canCancel ? <V10Action kind="ghost" label="Avbestill tur" onPress={p.onCancel} busy={p.cancelBusy} testID="assigned-trip-cancel" /> : null}
      </> : status === 'at_pickup' ? <>
        <V10Entrance pop testID="pickup-identity" style={{ alignItems: 'center', paddingTop: 6, paddingBottom: 16 }}><View style={{ alignSelf: 'center' }}><V10Badge tone="positive">Sjåføren er her</V10Badge></View><Text style={{ width: '100%', textAlign: 'center', fontFamily: font.semibold, fontSize: p.trip.driver?.plate ? 44 : 20, lineHeight: p.trip.driver?.plate ? 53 : 26, letterSpacing: p.trip.driver?.plate ? 3.52 : -.36, marginTop: 14, paddingVertical: 10, borderRadius: 18, borderWidth: 1.5, borderColor: colors.text }}>{p.trip.driver?.plate || 'Skilt ikke tilgjengelig'}</Text><Text style={[v10.heading, { marginTop: 14 }]}>{p.trip.driver?.car || 'Bilen din'}</Text><Text style={v10.secondary}>{first} venter ved hentestedet{freeWait ? <Text style={{ fontVariant: ['tabular-nums'] }}> · gratis venting ca. {freeWait}</Text> : null}</Text></V10Entrance>{network}<Contacts p={p} />
        <View style={{ marginTop: 10 }}><V10Action label={p.readySent ? 'Sjåføren er varslet' : 'Jeg er i bilen · varsle sjåføren'} onPress={p.onReady} disabled={p.offline || p.readySent} busy={p.readyBusy} testID="customer-in-car" /><Text style={[v10.caption, { marginTop: 8, textAlign: 'center' }]}>Sjåføren bekrefter turstart.</Text></View>
        {p.trip.waiting_policy ? <Text style={[v10.caption, { marginTop: 12 }]} testID="pickup-waiting-policy">{p.trip.waiting_policy.free_minutes} min gratis ventetid. Deretter {kr(p.trip.waiting_policy.per_minute)}/min, maks {kr(p.trip.waiting_policy.max_fee)}.</Text> : null}
        {p.canCancel ? <V10Action kind="ghost" label="Avbestill tur" onPress={p.onCancel} busy={p.cancelBusy} testID="assigned-trip-cancel" /> : null}
      </> : status === 'in_trip' && proximity?.near ? <>
        <View testID="customer-arriving-view" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}><View style={{ flex: 1 }}><Text style={v10.caption}>Nesten fremme</Text><Text style={v10.title}>{p.trip.dropoff_address || 'Reisemålet ditt'}</Text></View><Text style={{ fontFamily: font.semibold, fontSize: 32, lineHeight: 38 }}>{proximity.meters}<Text style={v10.secondary}> m</Text></Text></View><Text style={[v10.caption, { marginTop: 4 }]}>Omtrentlig avstand i luftlinje fra siste ferske GPS-posisjon.</Text>
        <Text style={[v10.secondary, { marginTop: 8 }]}>{p.trip.payment_flow === 'reservation' ? 'Turbeløpet trekkes automatisk etter at sjåføren avslutter turen.' : 'Sjåføren avslutter turen før betaling og kvittering åpnes.'}</Text>
        <View style={{ marginTop: 18 }}><V10Action kind="ink" label="Venter på sjåførens avslutning" disabled onPress={() => {}} testID="customer-arrival-driver-authority" /></View><View style={{ marginTop: 10 }}><V10Action small kind="soft" label="Minimer turen" onPress={p.onMinimize} testID="active-trip-minimize" /><V10Action small kind="ghost" label="Sikkerhet" onPress={p.onSafety} testID="ontrip-safety" /></View>
      </> : status === 'in_trip' ? <>
        <DriverCard p={p} compact />{network}<View style={{ marginTop: 14 }}><V10Action small kind="soft" icon="chevD" label="Minimer — turen følger deg" onPress={p.onMinimize} testID="active-trip-minimize" /></View>
      </> : <V10State icon="trip" title="Oppdaterer turstatus" body="Venter på bekreftet status fra SNAR." />}
    </V10Sheet>
  </View>;
}
