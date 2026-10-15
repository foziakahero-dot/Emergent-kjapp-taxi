import React from 'react';
import { driverPresence } from '@/src/lib/tripPresence';
import { Pressable, View } from 'react-native';
import { Text } from './Typography';
import { V10Icon } from '@/src/components/V10Icon';
import { colors, font, useColorTheme } from '@/src/theme';

export const LIVE_TRIP_STATUSES = ['payment_authorizing', 'searching', 'booking', 'driver_on_way', 'at_pickup', 'in_trip'];
export function ActiveTripCard({ trip, onOpen, offline = false }: { trip: any; onOpen: () => void; offline?: boolean }) {
  useColorTheme();
  const labels: Record<string, string> = { payment_authorizing: 'Godkjenn kortreservasjonen', searching: 'Søker sjåfør', booking: 'Bestiller', driver_on_way: 'Sjåfør på vei', at_pickup: 'Sjåføren er fremme', in_trip: 'Turen pågår', arrived: 'Se kvittering og betaling' };
  const eta = typeof trip?.eta_min === 'number' ? trip.eta_min : NaN;
  const staleLocation = ['driver_on_way', 'at_pickup', 'in_trip'].includes(trip.status) && !driverPresence(trip).fresh;
  const subtitle = offline ? 'Venter på oppdatert turstatus' : staleLocation ? 'Venter på oppdatert sjåførposisjon'
    : trip.status === 'in_trip' ? `Til ${trip.dropoff_address || 'reisemålet'}` : [trip.driver?.name, trip.driver?.car, trip.driver?.plate].filter(Boolean).join(' · ') || trip.pickup_address || 'Åpne turen din';
  return <Pressable testID="active-trip-reopen" accessibilityRole="button" accessibilityLabel="Åpne aktiv tur" onPress={onOpen}
    style={({pressed}) => ({ minHeight: 60, paddingLeft: 12, paddingRight: 10, borderRadius: 20, backgroundColor: colors.surfaceInverse, flexDirection: 'row', alignItems: 'center', gap: 12, transform: [{ scale: pressed ? .98 : 1 }] })}>
    <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(127,127,127,.18)', alignItems: 'center', justifyContent: 'center' }}><V10Icon name={trip.status === 'in_trip' ? 'trip' : trip.driver_id ? 'driver' : 'ai'} size={20} color={colors.onInverse} /></View>
    <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ fontFamily: font.semibold, fontSize: 14.5, color: colors.onInverse }}>{labels[trip.status] || 'Aktiv tur'}</Text><Text numberOfLines={1} accessibilityRole={offline || staleLocation ? 'alert' : undefined} style={{ color: colors.onInverse, opacity: .65, fontSize: 12.5, marginTop: 2 }}>{subtitle}</Text></View>
    {!offline && !staleLocation && Number.isFinite(eta) && eta > 0 && trip.status === 'driver_on_way' ? <Text style={{color:colors.onInverse,fontFamily:font.semibold,fontSize:22,fontVariant:['tabular-nums']}}>{Math.ceil(eta)}<Text style={{fontSize:12,opacity:.6}}> min</Text></Text> : null}
    <View style={{opacity:.5}}><V10Icon name="chevU" size={18} color={colors.onInverse} /></View>
  </Pressable>;
}
