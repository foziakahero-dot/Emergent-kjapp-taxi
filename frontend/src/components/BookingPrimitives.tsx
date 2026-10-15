import React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/src/components/Typography';
import { v10 } from '@/src/components/V10UI';
import { colors, useColorTheme } from '@/src/theme';

export function confirmedPaymentMethod(methods: any[]) {
  // Mirror the reservation service: verified Stripe instruments, default first, newest next.
  return (Array.isArray(methods) ? methods : []).filter(m => m && m.verified === true && m.setup_status === 'succeeded' && typeof m.stripe_payment_method_id === 'string' && m.stripe_payment_method_id.length > 0)
    .sort((a, b) => Number(Boolean(b.is_default)) - Number(Boolean(a.is_default)) || String(b.created_at || '').localeCompare(String(a.created_at || '')))[0];
}
export function paymentLabel(method: any) {
  const wallet = method?.wallet === 'google_pay' ? 'Google Pay · ' : method?.wallet === 'apple_pay' ? 'Apple Pay · ' : '';
  return method ? `${wallet}${method.label || method.type || 'Kort'}${method.last4 ? ` ·· ${method.last4}` : ''}` : 'Legg til betalingskort';
}
export function CustomerJourney({ pickup, destination, destinationDetail, stops = [], onPickup, onDestination }: { pickup: string; destination?: string; destinationDetail?: string; stops?: any[]; onPickup?: () => void; onDestination?: () => void }) {
  useColorTheme();
  const rows: { name: string; detail?: string; action?: () => void }[] = [{ name: pickup, detail: onPickup ? 'Juster hentepunkt' : undefined, action: onPickup }, ...stops.map(stop => ({ name: stop.name || stop.address })), { name: destination || 'Velg reisemål', detail: destinationDetail, action: onDestination }];
  return <View style={{ gap: 14 }}>{rows.map((row, i) => <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
    <View style={{ width: 20, alignItems: 'center' }}><View style={{ width: 10, height: 10, borderRadius: i === 0 ? 5 : 3, backgroundColor: i === 0 ? colors.accent : colors.text }} /></View>
    {row.action ? <Pressable testID={i === 0 ? 'booking-edit-pickup' : 'booking-change-dest'} accessibilityRole="button" onPress={row.action} style={{ flex: 1, minHeight: 36, justifyContent: 'center' }}><Text style={v10.body} numberOfLines={2}>{row.name}</Text>{row.detail ? <Text style={v10.caption}>{row.detail}</Text> : null}</Pressable> : <View style={{ flex: 1 }}><Text style={v10.body} numberOfLines={2}>{row.name}</Text>{row.detail ? <Text style={v10.caption}>{row.detail}</Text> : null}</View>}
  </View>)}</View>;
}

export function finiteMetric(value: any, unit: string) { return value != null && Number.isFinite(Number(value)) && Number(value) >= 0 ? `${Number(value).toLocaleString('nb-NO', { maximumFractionDigits: 1 })} ${unit}` : '—'; }
