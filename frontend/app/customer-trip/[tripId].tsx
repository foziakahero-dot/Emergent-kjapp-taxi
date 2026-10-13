import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/src/context/AuthContext';
import { tripsApi } from '@/src/lib/api';
import { kr } from '@/src/lib/format';
import { Map } from '@/src/components/Map';
import { Text } from '@/src/components/Typography';
import { V10Group, V10Header, V10Row, V10Screen, V10State, v10 } from '@/src/components/V10UI';
import { Loader } from '@/src/components/ui';
import { colors, useColorTheme } from '@/src/theme';

function point(lat: unknown, lng: unknown) { return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null; }
function time(iso?: string) { const date = new Date(iso || ''); return Number.isFinite(date.getTime()) ? date.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }) : null; }
export default function CustomerTripDetail() {
  useColorTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const query = useQuery({ queryKey: ['customer-trip-detail', user?.id, tripId], queryFn: () => tripsApi.get(tripId), enabled: !!user?.id && !!tripId });
  const trip = query.data;
  const pickup = point(trip?.pickup_lat, trip?.pickup_lng), dropoff = point(trip?.dropoff_lat, trip?.dropoff_lng);
  const date = new Date(trip?.created_at || '');
  const live = ['payment_authorizing', 'searching', 'booking', 'driver_on_way', 'at_pickup', 'in_trip'].includes(trip?.status || '');
  return <V10Screen dock testID="customer-trip-detail-screen"><V10Header title={Number.isFinite(date.getTime()) ? `Tur · ${date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}` : 'Turdetaljer'} onBack={() => router.back()} />
    {query.isPending ? <Loader /> : query.isError ? <V10State icon="wifiOff" warning title="Kunne ikke hente turen" body="Sjekk forbindelsen og prøv igjen." action="Prøv igjen" onAction={() => void query.refetch()} /> : !trip?.trip_id ? <V10State icon="trip" title="Turen er ikke tilgjengelig" body="Oppdater aktivitet for å se turene dine." action="Til aktivitet" onAction={() => router.replace('/(app)/history')} /> : <>
      <View style={{ height: 180, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.cardSubtle }}>
        {pickup && dropoff ? <Map style={{ flex: 1 }} pickup={pickup} dropoff={dropoff} route={trip.geometry?.coordinates} interactive={false} contentInsets={{ top: 24, bottom: 24, left: 24, right: 24 }} /> : <View style={{ flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' }}><Text style={v10.caption}>Kartdata er ikke tilgjengelig for denne turen.</Text></View>}
      </View>
      <View style={{ marginTop: 20, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent }} /><View style={{ flex: 1 }}><Text style={v10.body}>{trip.pickup_address || 'Hentested'}</Text>{time(trip.created_at) ? <Text style={v10.caption}>{time(trip.created_at)}</Text> : null}</View></View>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}><View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colors.text }} /><View style={{ flex: 1 }}><Text style={v10.body}>{trip.dropoff_address || 'Destinasjon'}</Text><Text style={v10.caption}>{[time(trip.arrived_at), typeof trip.duration_min === 'number' ? `${trip.duration_min} min` : null, typeof trip.distance_km === 'number' ? `${trip.distance_km.toLocaleString('nb-NO')} km` : null].filter(Boolean).join(' · ') || 'Reisedata ikke tilgjengelig'}</Text></View></View>
      </View>
      <V10Group style={{ marginTop: 20 }}>
        {trip.driver?.name ? <V10Row icon="driver" title={trip.driver.name} subtitle={trip.fleet_name || trip.driver.fleet_name || 'Sjåføren din'} /> : null}
        {trip.driver?.car || trip.driver?.plate ? <V10Row border={!!trip.driver?.name} icon="vehicle" title={trip.driver.car || 'Kjøretøy'} subtitle={trip.driver.plate} /> : null}
        <V10Row border icon="payment" title={kr(trip.price)} subtitle={trip.payment_status === 'paid' ? 'Betalt' : live ? 'Avtalt pris' : 'Betaling ikke bekreftet'} />
        <V10Row border icon={live ? 'trip' : 'receipt'} title={live ? 'Åpne aktiv tur' : 'Kvittering'} onPress={() => router.push(live ? `/booking/${trip.trip_id}` : `/receipt/${trip.trip_id}`)} testID="customer-trip-receipt" />
        <V10Row border icon="help" title="Hjelp med denne turen" onPress={() => router.push('/support')} testID="customer-trip-support" />
      </V10Group>
    </>}
  </V10Screen>;
}
