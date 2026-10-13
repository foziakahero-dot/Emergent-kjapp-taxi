import React, { useState } from 'react';
import { Linking, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/src/context/AuthContext';
import { driverApi } from '@/src/lib/api';
import { confirmedTripIncome, historyDate, historyTrips, tripStatusLabel } from '@/src/lib/driverHistory';
import { kr } from '@/src/lib/format';
import { Text } from '@/src/components/Typography';
import { V10Icon } from '@/src/components/V10Icon';
import { V10Group, V10Header, V10Row, V10Screen, V10State, v10 } from '@/src/components/V10UI';
import { Loader } from '@/src/components/ui';
import { colors } from '@/src/theme';

export default function DriverTripDetail() {
  const router = useRouter();
  const { user } = useAuth();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [error, setError] = useState('');
  const history = useQuery({ queryKey: ['driver-history', user?.id], queryFn: driverApi.history, enabled: !!user?.id });
  const trip = historyTrips(history.data).find(item => item.trip_id === tripId);
  const income = trip ? confirmedTripIncome(trip) : null;
  const report = () => void Linking.openURL(`https://snarapp.no/help?trip_id=${encodeURIComponent(tripId || '')}`).catch(() => setError('Kunne ikke åpne support. Prøv igjen.'));
  return <V10Screen testID="driver-trip-detail-screen"><V10Header title={trip ? `Tur ${trip.trip_id}` : 'Turdetaljer'} onBack={() => router.back()} />
    {history.isPending ? <Loader /> : history.isError ? <V10State icon="wifiOff" warning title="Kunne ikke hente turen" body="Sjekk forbindelsen og prøv igjen." action="Prøv igjen" onAction={() => void history.refetch()} /> : !trip ?
      <V10State icon="trip" title="Turen er ikke tilgjengelig" body="Denne turen finnes ikke i den tilgjengelige historikken." action="Til aktivitet" onAction={() => router.replace('/driver-trips')} /> : <>
      <View style={{ height: 170, borderRadius: 24, backgroundColor: colors.cardSubtle, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 10 }}>
        <V10Icon name="trip" size={28} color={colors.textMuted} /><Text style={[v10.caption, { textAlign: 'center' }]}>Detaljert rute og kundeadresse er skjult etter turen.</Text>
      </View>
      <V10Group style={{ marginTop: 16 }}>
        <V10Row icon="pickup" title={trip.pickup_address || 'Hentested skjult'} subtitle={`${historyDate(trip.created_at)} · ${historyDate(trip.created_at, true)}`} />
        <V10Row border icon="destination" title={trip.dropoff_address || 'Destinasjon skjult'} subtitle={[trip.arrived_at ? historyDate(trip.arrived_at, true) : null, typeof trip.duration_min === 'number' ? `${trip.duration_min} min` : null, typeof trip.distance_km === 'number' ? `${trip.distance_km.toLocaleString('nb-NO')} km` : null].filter(Boolean).join(' · ') || 'Reisedata ikke tilgjengelig'} />
        <V10Row border icon="earnings" title={income !== null ? `${kr(income)} inntekt` : tripStatusLabel(trip)} subtitle={income !== null && typeof trip.price === 'number' ? `Kundepris ${kr(trip.price)} · plattform ${kr(Math.max(0, trip.price - income))}` : 'Inntekt vises når betaling er bekreftet'} />
        <V10Row border icon="receipt" title="Referanse" subtitle={trip.receipt_id || trip.trip_id} />
        <V10Row border icon="help" title="Rapporter problem med turen" onPress={report} testID="driver-trip-report" />
      </V10Group>
      {error ? <Text accessibilityRole="alert" style={[v10.secondary, { marginTop: 12, color: colors.danger }]}>{error}</Text> : null}
    </>}
  </V10Screen>;
}
