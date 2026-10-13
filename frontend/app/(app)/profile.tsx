import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/src/context/AuthContext';
import { mePlacesApi, paymentApi } from '@/src/lib/api';
import { CustomerPhoto } from '@/src/components/CustomerPhoto';
import { Text } from '@/src/components/Typography';
import { V10Group, V10Row, V10Screen, V10Section, v10 } from '@/src/components/V10UI';

export default function Profile() {
  const router = useRouter();
  const { user } = useAuth();
  const places = useQuery({ queryKey: ['me-places', user?.id], queryFn: mePlacesApi.list, enabled: !!user?.id });
  const methods = useQuery({ queryKey: ['payment-methods', user?.id], queryFn: paymentApi.list, enabled: !!user?.id });
  const records = Array.isArray(places.data?.places) ? places.data.places : [];
  const cards = methods.data?.payment_methods || methods.data?.methods || (Array.isArray(methods.data) ? methods.data : []);
  const primary = Array.isArray(cards) ? cards.find((card: any) => card.is_default) || cards[0] : null;
  const initials = (user?.fullName || user?.email || 'S').split(' ').map(part => part[0]).join('').slice(0, 2);
  return <V10Screen dock testID="customer-profile-screen">
    <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center', marginTop: 16, marginBottom: 0 }} testID="profile-card">
      <CustomerPhoto initials={initials} size={72} shape="v10" showLabel={false} />
      <View style={{ flex: 1 }}><Text style={v10.title}>{user?.fullName || 'SNAR-bruker'}</Text><Text style={v10.secondary}>{[user?.phone, user?.email].filter(Boolean).join(' · ')}</Text></View>
    </View>
    <V10Section title="Steder"><V10Group>{[['Hjem', 'home'], ['Jobb', 'work']].map(([label, icon], index) => {
      const place = records.find((item: any) => item.label === label);
      return <V10Row key={label} border={index > 0} icon={icon} title={label} subtitle={places.isPending ? 'Henter sted…' : places.isError ? 'Kunne ikke hente stedet' : place?.name || 'Legg til adresse'} onPress={() => router.push(`/saved-places?label=${encodeURIComponent(label)}` as any)} testID={`profile-place-${label === 'Hjem' ? 'home' : 'work'}`} />;
    })}</V10Group></V10Section>
    <V10Section title="Konto"><V10Group>
      <V10Row icon="payment" title="Betaling" subtitle={methods.isPending ? 'Henter betalingsmåter…' : methods.isError ? 'Åpne for å hente betalingsmåter' : primary ? `${primary.label || 'Kort'}${primary.last4 ? ` ·· ${primary.last4}` : ''}` : 'Legg til betalingsmåte'} onPress={() => router.push('/payment-methods')} testID="profile-payments" />
      <V10Row border icon="access" title="Tilgjengelighet" onPress={() => router.push('/customer-accessibility')} testID="profile-accessibility" />
      <V10Row border icon="settings" title="Innstillinger" onPress={() => router.push('/settings')} testID="profile-settings" />
      <V10Row border icon="help" title="Support" onPress={() => router.push('/support')} testID="profile-help" />
    </V10Group></V10Section>
  </V10Screen>;
}
