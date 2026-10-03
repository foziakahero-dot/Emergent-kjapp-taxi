import React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './Typography';
import { colors, font } from '@/src/theme';

export const LIVE_TRIP_STATUSES = ['searching', 'booking', 'driver_on_way', 'at_pickup', 'in_trip'];
export function ActiveTripCard({ trip, onOpen, offline = false }: { trip: any; onOpen: () => void; offline?: boolean }) {
  const labels: Record<string, string> = { searching: 'Søker sjåfør', booking: 'Bestiller', driver_on_way: 'Sjåfør på vei', at_pickup: 'Sjåføren er fremme', in_trip: 'Turen pågår', arrived: 'Se kvittering og betaling' };
  const eta = Number(trip?.eta_min);
  return <Pressable testID="active-trip-reopen" accessibilityRole="button" accessibilityLabel="Åpne aktiv tur" onPress={onOpen}
    style={{ padding: 16, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, boxShadow: '0 8px 24px rgba(0,31,63,0.12)' }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ fontFamily: font.semibold, color: colors.text }}>{labels[trip.status] || 'Aktiv tur'}</Text>
      {!offline && Number.isFinite(eta) && eta > 0 && trip.status === 'driver_on_way' ? <Text>{Math.ceil(eta)} min</Text> : null}
    </View>
    {trip.driver?.name ? <Text numberOfLines={1} style={{ color: colors.textSecondary, marginTop: 4 }}>{[trip.driver.name, trip.driver.car, trip.driver.plate].filter(Boolean).join(' · ')}</Text> : null}
    {offline ? <Text accessibilityRole="alert" style={{ color: colors.textSecondary, marginTop: 4 }}>Venter på oppdatert turstatus</Text> : null}
  </Pressable>;
}
