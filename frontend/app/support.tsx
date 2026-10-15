import React from 'react';
import { V10Entrance } from '@/src/components/V10Entrance';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/src/context/AuthContext';
import { tripsApi } from '@/src/lib/api';
import { Text } from '@/src/components/Typography';
import { V10Action, V10Group, V10Header, V10Row, V10Screen, V10Section, v10 } from '@/src/components/V10UI';
import { colors, useColorTheme } from '@/src/theme';

export default function CustomerSupportOverview() {
  useColorTheme();
  const router = useRouter();
  const { user } = useAuth();
  const active = useQuery({ queryKey: ['customer-active-trip', user?.id], queryFn: tripsApi.active, enabled: !!user?.id });
  const history = useQuery({ queryKey: ['trips', user?.id], queryFn: tripsApi.list, enabled: !!user?.id });
  const recent = Array.isArray(history.data) ? history.data : history.data?.trips;
  const activeTrip = !active.isError && active.data?.trip_id && ['payment_authorizing', 'searching', 'booking', 'driver_on_way', 'at_pickup', 'in_trip'].includes(active.data.status) ? active.data : null;
  const trip = activeTrip || (!history.isError && Array.isArray(recent) ? recent[0] : null);
  const openChat = (topic?: string) => router.push({ pathname: '/support-chat', params: { ...(topic ? { topic } : {}), ...(trip?.trip_id ? { tripId: trip.trip_id } : {}) } });
  return <V10Screen dock testID="customer-support-screen"><V10Header title="Support" onBack={() => router.back()} /><V10Entrance>
    <V10Group style={{ padding: 16 }}>
      <Text style={v10.overline}>{active.isError ? 'Reisestatus utilgjengelig' : activeTrip ? 'Gjelder det turen din nå?' : 'Siste tur'}</Text>
      <Text style={[v10.body, { marginTop: 6 }]}>{trip ? `${trip.dropoff_address || 'SNAR-tur'}${trip.driver?.name ? ` · ${trip.driver.name}` : ''}` : active.isPending || history.isPending ? 'Henter tur…' : 'Hvordan kan vi hjelpe deg?'}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>{(activeTrip ? ['Sjåføren finner meg ikke', 'Endre destinasjon', 'Glemt gjenstand', 'Ruten virker feil'] : ['Feil pris', 'Glemt gjenstand', 'Gi tilbakemelding']).map(label => <Pressable key={label} accessibilityRole="button" onPress={() => openChat(label)} style={{ minHeight: 36, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.cardSubtle, justifyContent: 'center' }}><Text style={{ fontSize: 14 }}>{label}</Text></Pressable>)}</View>
    </V10Group>
    <V10Section title="Vanlige spørsmål"><V10Group>{['Hvordan fungerer fast pris?', 'Refusjon og avbestilling', 'Bedriftskonto'].map((label, index) => <V10Row key={label} border={index > 0} title={label} onPress={() => openChat(label)} />)}</V10Group></V10Section>
    <View style={{ marginTop: 20 }}><V10Action kind="ink" label="Chat med SNAR" icon="message" onPress={() => openChat()} testID="customer-support-chat-open" /></View>
    {active.isError || history.isError ? <Text style={[v10.caption, { color: colors.textSecondary, marginTop: 12 }]}>Turinformasjonen kunne ikke oppdateres. Du kan fortsatt kontakte support.</Text> : null}
  </V10Entrance></V10Screen>;
}
