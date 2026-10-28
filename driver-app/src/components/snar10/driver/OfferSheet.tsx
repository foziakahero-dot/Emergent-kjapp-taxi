import React, { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Sheet } from '../Sheet';
import { Ring } from '../Ring';
import { Text } from '@/src/components/Typography';
import { V10Icon } from '@/src/components/V10Icon';
import { V10Action, V10Badge, v10 } from '@/src/components/V10UI';
import { colors, font, useColorTheme } from '@/src/theme';
import { kr } from '@/src/lib/format';
type Props = { offer: any; offerRemaining: number | null; offerExpired: boolean; offerDuration: number | null; offerDistance: number | null; extras: string; busy: boolean; onAccept: () => void; onDecline: () => void };
const known = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
/** The server expiration remains authoritative; no local demo timeout. */
export function OfferSheet(p: Props) {
  useColorTheme();
  const initialRemaining = useRef<{ id?: string; remaining: number | null }>({ remaining: null });
  if (initialRemaining.current.id !== p.offer.trip_id || initialRemaining.current.remaining === null) initialRemaining.current = { id: p.offer.trip_id, remaining: p.offerRemaining };
  return <><View pointerEvents="none" testID="driver-offer-dim" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,.12)' }]} /><Sheet>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><V10Badge inline icon="vehicle">{({ 'ai-first': 'Standard', trygg: 'XL', premium: 'Premium' } as Record<string, string>)[p.offer.vehicle_type] || 'SNAR'} · ny tur</V10Badge><Ring size={40} color={colors.textSecondary} value={p.offerRemaining !== null && initialRemaining.current.remaining && initialRemaining.current.remaining > 0 ? p.offerRemaining / initialRemaining.current.remaining : null}><Text style={[v10.caption, { color: colors.text, fontVariant: ['tabular-nums'] }]}>{p.offerRemaining ?? '—'}</Text></Ring></View>
      <Text style={{ marginTop: 12 }}><Text style={{ fontFamily: font.semibold, fontSize: 40, lineHeight: 44, letterSpacing: -1.4 }}>{known(p.offerDuration) ? Math.ceil(p.offerDuration!) : '—'} min</Text><Text style={v10.secondary}> til henting{known(p.offerDistance) ? ` · ${p.offerDistance!.toLocaleString('nb-NO', { maximumFractionDigits: 1 })} km` : ''}</Text></Text>
      <View style={{ marginVertical: 18, gap: 4 }}><Text style={{ fontFamily: font.semibold, fontSize: 22, lineHeight: 28, letterSpacing: -.44 }}>{p.offer.pickup_address}</Text><View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><V10Icon name="arrowR" size={18} color={colors.textMuted} /><Text style={v10.caption}>{[known(p.offer.distance_km) ? `${p.offer.distance_km.toLocaleString('nb-NO')} km` : null, known(p.offer.duration_min) ? `${p.offer.duration_min} min` : null].filter(Boolean).join(' · ')}</Text></View><Text style={{ fontFamily: font.semibold, fontSize: 22, lineHeight: 28, letterSpacing: -.44 }}>{p.offer.dropoff_address}</Text></View>
      {p.offer.payment_provider === 'cash' ? <Text testID="driver-offer-cash" style={v10.body}>Kontantbetaling til sjåføren</Text> : null}
      {p.extras ? <Text style={v10.caption}>{p.extras}</Text> : null}{p.offer.passenger_note ? <Text style={v10.secondary}>{p.offer.passenger_note}</Text> : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.line }}><Text style={v10.secondary}>Estimert pris</Text><Text style={{ fontFamily: font.semibold, fontSize: 28, lineHeight: 36, letterSpacing: -.176, fontVariant: ['tabular-nums'] }}>{kr(p.offer.price)}</Text></View>
      <View style={{ flexDirection: 'row', gap: 8 }}><View style={{ width: 96 }}><V10Action height={64} kind="soft" label="Avslå" onPress={p.onDecline} disabled={p.busy} testID={`driver-decline-${p.offer.trip_id}`} /></View><View style={{ flex: 1 }}><V10Action height={64} labelSize={18} label={p.offerExpired ? 'Utløpt' : 'Aksepter'} onPress={p.onAccept} busy={p.busy} disabled={p.offerExpired} testID={`driver-accept-${p.offer.trip_id}`} /></View></View>
</Sheet></>;
}
