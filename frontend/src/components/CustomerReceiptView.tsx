import React, { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/src/components/Typography';
import { Map } from '@/src/components/Map';
import { BrandBadge } from '@/src/components/BrandBadge';
import { V10Icon } from '@/src/components/V10Icon';
import { V10Action, V10Group, V10Header, V10Screen, V10Sheet, v10 } from '@/src/components/V10UI';
import { finiteMetric } from '@/src/components/CustomerBookingView';
import { colors, font } from '@/src/theme';
import { kr } from '@/src/lib/format';

type Props = { trip: any; initialReceipt: boolean; rating: number; rated: boolean; ratingBusy: boolean; ratingError: string; paymentBusy: boolean; paymentError: string; refreshError: boolean; photo: any;
  onRating: (rating: number) => void; onSubmit: (feedback: string) => void; onPay: () => void; onRefresh: () => void; onHome: () => void; onBack: () => void; onSupport: () => void; onShare: () => void; onPhotoError: () => void };
export function receiptMoney(value: unknown, currency = false) { return typeof value === 'number' && Number.isFinite(value) ? `${value.toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currency ? ' kr' : ''}` : '—'; }
type Stage = 'complete' | 'paid' | 'receipt' | 'rating';
function point(lat: unknown, lng: unknown) { return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null; }
export function receiptDate(iso?: string, clock = false) {
  const value = new Date(iso || '');
  return Number.isFinite(value.getTime()) ? clock ? value.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Oslo' }) : value.toLocaleString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Oslo' }) : null;
}
export function CustomerReceiptView(p: Props) {
  const insets = useSafeAreaInsets();
  const paid = p.trip.payment_status === 'paid';
  const [stage, setStage] = useState<Stage>(p.initialReceipt ? 'receipt' : paid ? 'paid' : 'complete');
  const [feedback, setFeedback] = useState<string[]>([]);
  useEffect(() => { if (paid) setStage(current => current === 'complete' ? 'paid' : current); }, [paid]);
  const automatic = p.trip.payment_flow === 'reservation';
  const paymentNote = paid ? 'Betaling registrert' : automatic ? 'Turbeløpet ble reservert før turstart. SNAR trekker beløpet automatisk. Du skal ikke betale på nytt.' : 'Betalingen er ikke bekreftet. Beløpet kommer fra turen på serveren.';
  const issues = <>{p.refreshError ? <Text accessibilityRole="alert" style={[v10.caption, { color: colors.danger, marginTop: 12 }]}>Kunne ikke oppdatere status. Viser sist bekreftede turdata.</Text> : null}{p.paymentError ? <Text testID="receipt-payment-error" accessibilityRole="alert" style={[v10.secondary, { color: colors.danger, marginTop: 12 }]}>{p.paymentError}</Text> : null}</>;
  if (stage === 'receipt') return <V10Screen testID="customer-receipt-detail"><V10Header title="Kvittering" onBack={() => p.initialReceipt ? p.onBack() : setStage(paid ? 'paid' : 'complete')} right={<Pressable onPress={p.onShare} accessibilityRole="button" accessibilityLabel="Del turkvittering" testID="receipt-share" style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}><V10Icon name="share" /></Pressable>} />
    <V10Group style={{ padding: 20 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><BrandBadge size={32} /><Text style={[v10.caption, { flex: 1, textAlign: 'right' }]}>{p.trip.receipt_id ? `Nr. ${p.trip.receipt_id}` : 'Kvitteringsnummer ikke tilgjengelig'}{'\n'}{receiptDate(p.trip.created_at) || 'Dato ikke tilgjengelig'}</Text></View>
      <Text style={{ color: colors.text, fontFamily: font.semibold, fontSize: 40, lineHeight: 48, letterSpacing: -1.2, marginTop: 20 }}>{receiptMoney(p.trip.price, true)}</Text><Text style={v10.secondary}>{paymentNote}</Text><Divider />
      <JourneyRow first title={p.trip.pickup_address || 'Hentested'} sub={receiptDate(p.trip.started_at || p.trip.created_at, true)} /><View style={{ height: 14 }} /><JourneyRow title={p.trip.dropoff_address || 'Destinasjon'} sub={[receiptDate(p.trip.arrived_at, true), finiteMetric(p.trip.duration_min, 'min'), finiteMetric(p.trip.distance_km, 'km')].filter(Boolean).join(' · ')} /><Divider />
      <ReceiptRow label="Turpris" value={receiptMoney(p.trip.quoted_ride_price ?? p.trip.price)} />
      {typeof p.trip.waiting_fee_total === 'number' && (p.trip.waiting_policy || p.trip.waiting_fee_total > 0) ? <ReceiptRow label="Ventetid" value={receiptMoney(p.trip.waiting_fee_total)} /> : null}
      {typeof p.trip.service_fee === 'number' ? <ReceiptRow label="Servicegebyr" value={receiptMoney(p.trip.service_fee)} /> : null}
      {typeof p.trip.vat_amount === 'number' ? <ReceiptRow label="Herav mva" value={receiptMoney(p.trip.vat_amount)} /> : null}
      {p.trip.driver?.name ? <ReceiptRow label="Sjåfør" value={p.trip.driver.name} /> : null}
      {p.trip.driver?.car || p.trip.driver?.plate ? <ReceiptRow label="Kjøretøy" value={[p.trip.driver.car, p.trip.driver.plate].filter(Boolean).join(' · ')} /> : null}
      {p.trip.fleet_name || p.trip.driver?.fleet_name ? <ReceiptRow label="Løyvehaver" value={p.trip.fleet_name || p.trip.driver.fleet_name} /> : null}
    </V10Group>{issues}
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}><View style={{ flex: 1 }}><V10Action small kind="soft" icon="download" label="Last ned PDF" disabled onPress={() => {}} testID="receipt-pdf-unavailable" /></View><View style={{ flex: 1 }}><V10Action small kind="soft" icon="help" label="Få hjelp" onPress={p.onSupport} /></View></View><Text style={[v10.caption, { marginTop: 8 }]}>PDF-kvittering er ikke tilgjengelig ennå. Du kan dele turens registrerte opplysninger ovenfor.</Text>
  </V10Screen>;
  if (stage === 'paid' && paid) return <View testID="customer-paid-screen" style={{ flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24, paddingBottom: 48, alignItems: 'center', justifyContent: 'center' }}>
    <Svg width={88} height={88} viewBox="0 0 88 88" accessibilityLabel="Betaling bekreftet"><Circle cx={44} cy={44} r={42} fill="rgba(13,122,88,.1)" /><Path d="M28 45l11 11 21-23" fill="none" stroke={colors.success} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" /></Svg><Text style={[v10.title, { marginTop: 24 }]}>Betalt</Text><Text style={{ color: colors.text, fontFamily: font.semibold, fontSize: 44, lineHeight: 54, letterSpacing: -1.32, marginTop: 4 }}>{kr(p.trip.price)}</Text><Text style={[v10.secondary, { marginTop: 14 }]}>Betalingen er bekreftet av SNAR.</Text>{issues}
    <View style={{ position: 'absolute', bottom: Math.max(40, insets.bottom + 6), left: 24, right: 24, gap: 4 }}><V10Action kind="ink" label="Ferdig" onPress={() => p.rated ? p.onHome() : setStage('rating')} testID="receipt-done" /><V10Action kind="ghost" label="Se kvittering" onPress={() => setStage('receipt')} testID="receipt-view" /></View>
  </View>;
  const pickup = point(p.trip.pickup_lat, p.trip.pickup_lng), dropoff = point(p.trip.dropoff_lat, p.trip.dropoff_lng);
  return <View style={{ flex: 1, backgroundColor: colors.bg }}>
    {pickup && dropoff ? <Map style={{ position: 'absolute', inset: 0 }} pickup={pickup} dropoff={dropoff} route={p.trip.geometry?.coordinates} interactive={false} contentInsets={{ top: insets.top + 24, bottom: insets.bottom + 380, left: 40, right: 40 }} /> : null}
    <Pressable testID="receipt-back" onPress={p.onHome} accessibilityRole="button" accessibilityLabel="Tilbake til hjem" style={{ position: 'absolute', top: Math.max(58, insets.top + 10), left: 20, width: 48, height: 48, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}><V10Icon name="chevL" /></Pressable>
    <V10Sheet testID={stage === 'rating' && paid ? 'customer-rating-sheet' : 'customer-complete-sheet'}>
      {stage === 'rating' && paid ? <><View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}><View style={{ width: 52, height: 52, borderRadius: 17.68, overflow: 'hidden', backgroundColor: colors.cardSubtle, alignItems: 'center', justifyContent: 'center' }}>{p.photo ? <Image source={p.photo} onError={p.onPhotoError} style={{ width: 52, height: 52 }} /> : <Text style={v10.heading}>{(p.trip.driver?.name || 'S').slice(0, 1)}</Text>}</View><View style={{ flex: 1 }}><Text style={v10.heading}>{p.rated ? 'Takk for vurderingen!' : `Hvordan var turen${p.trip.driver?.name ? ` med ${p.trip.driver.name.split(' ')[0]}` : ''}?`}</Text><Text style={v10.caption}>Valgfritt</Text></View></View>
        <View accessibilityRole="radiogroup" accessibilityLabel="Vurdering" style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 24, marginHorizontal: 8 }}>{[1, 2, 3, 4, 5].map(n => <Pressable key={n} disabled={p.rated || p.ratingBusy} onPress={() => p.onRating(n)} testID={`rate-star-${n}`} accessibilityRole="radio" accessibilityLabel={`${n} stjerner`} accessibilityState={{ checked: p.rating === n, disabled: p.rated || p.ratingBusy }} style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center', transform: [{ scale: n <= p.rating ? 1.08 : 1 }] }}><Svg width={34} height={34} viewBox="0 0 24 24"><Path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" fill={n <= p.rating ? colors.text : 'none'} stroke={n <= p.rating ? colors.text : colors.lineStrong} strokeWidth={1.6} strokeLinejoin="round" /></Svg></Pressable>)}</View>
        {p.rating >= 4 && !p.rated ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>{['Rolig kjøring', 'Ren bil', 'Presis', 'Hyggelig'].map(label => <Pressable key={label} testID={`rating-feedback-${label}`} accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked: feedback.includes(label), disabled: p.ratingBusy }} disabled={p.ratingBusy} onPress={() => setFeedback(current => current.includes(label) ? current.filter(item => item !== label) : [...current, label])} style={{ minHeight: 36, borderRadius: 12, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: feedback.includes(label) ? colors.surfaceInverse : colors.cardSubtle }}><Text style={[v10.secondary, { color: feedback.includes(label) ? colors.onInverse : colors.text }]}>{label}</Text></Pressable>)}</View> : null}
        {p.ratingError ? <Text testID="receipt-rating-error" accessibilityRole="alert" style={[v10.secondary, { marginBottom: 12, color: colors.danger }]}>{p.ratingError}</Text> : null}<V10Action kind="ink" label={p.rated ? 'Ferdig' : p.rating ? 'Send' : 'Hopp over'} onPress={() => p.rated || !p.rating ? p.onHome() : p.onSubmit(p.rating >= 4 ? feedback.join(' · ') : '')} busy={p.ratingBusy} testID="receipt-submit-rating" />
      </> : <><Text style={v10.caption}>Turen er fullført{receiptDate(p.trip.arrived_at, true) ? ` · ${receiptDate(p.trip.arrived_at, true)}` : ''}</Text><Text style={v10.title}>{p.trip.dropoff_address ? `Velkommen til ${p.trip.dropoff_address}` : 'Takk for turen'}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginVertical: 20 }}>{[['Tid', finiteMetric(p.trip.duration_min, 'min')], ['Distanse', finiteMetric(p.trip.distance_km, 'km')], ['Pris', kr(p.trip.price)]].map(([label, value]) => <View key={label} style={{ flex: 1, padding: 14, borderRadius: 16, backgroundColor: colors.cardSubtle }}><Text style={v10.caption}>{label}</Text><Text style={[v10.body, { fontSize: 18 }]}>{value}</Text></View>)}</View><Text style={v10.secondary}>{paymentNote}</Text>
        {!paid && !automatic ? <View style={{ marginTop: 16 }}><V10Action label={`Betal ${kr(p.trip.price)}`} onPress={p.onPay} busy={p.paymentBusy} testID="receipt-pay" /></View> : null}{issues}<View style={{ marginTop: 8 }}><V10Action kind="ghost" label="Sjekk betaling" onPress={p.onRefresh} disabled={p.paymentBusy} testID="receipt-check-payment" /><V10Action small kind="ghost" label="Se turdetaljer" onPress={() => setStage('receipt')} testID="receipt-view" /></View>
      </>}
    </V10Sheet>
  </View>;
}
function Divider() { return <View style={{ marginVertical: 20, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.lineStrong }} />; }
function JourneyRow({ first, title, sub }: { first?: boolean; title: string; sub: string | null }) { return <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}><View style={{ width: 10, height: 10, borderRadius: first ? 5 : 2, backgroundColor: first ? colors.accent : colors.text }} /><View style={{ flex: 1 }}><Text style={v10.body}>{title}</Text>{sub ? <Text style={v10.caption}>{sub}</Text> : null}</View></View>; }
function ReceiptRow({ label, value }: { label: string; value: string }) { return <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 7 }}><Text style={v10.secondary}>{label}</Text><Text style={[v10.secondary, { color: colors.text, fontFamily: font.semibold, maxWidth: '64%', textAlign: 'right' }]}>{value}</Text></View>; }
