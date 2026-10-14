import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/src/components/Typography';
import { V10Action, V10Group, V10Screen, v10 } from '@/src/components/V10UI';
import { V10Icon } from '@/src/components/V10Icon';
import { V10Entrance } from '@/src/components/V10Entrance';
import { colors, useColorTheme } from '@/src/theme';

const unavailable = [
  { icon: 'clock', title: 'Etterspørsel', body: 'Ingen oppdatert prognose for området ditt.', caption: 'Prognose ikke tilgjengelig' },
  { icon: 'earnings', title: 'Inntektsestimat', body: 'Vi har ikke grunnlag for et inntektsestimat ennå.', caption: 'Estimat ikke tilgjengelig' },
  { icon: 'battery', title: 'Lading', body: 'Ladestatus og ledige ladesteder er ikke tilgjengelige her.', caption: '' },
];

export default function DriverIntelligence() {
  useColorTheme();
  const router = useRouter();
  return <V10Screen dock testID="driver-intelligence"><V10Entrance fade>
    <Text style={[v10.overline, { marginTop: 8 }]}>SNAR Drive Intelligence</Text>
    <Text style={[v10.title, { marginTop: 4 }]}>Ingen oppdatert prognose ennå.</Text>
    <View style={{ height: 160, borderRadius: 24, overflow: 'hidden', marginTop: 20, boxShadow: colors.elevation1, backgroundColor: colors.cardSubtle, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 }}>
      <V10Icon name="navigation" size={32} color={colors.textMuted} />
      <Text style={[v10.caption, { textAlign: 'center' }]}>Prognosekart er ikke tilgjengelig</Text>
    </View>
    <View style={{ gap: 8, marginTop: 12 }}>{unavailable.map((item, index) => <V10Entrance key={item.icon} delay={index * 60}>
      <V10Group style={{ padding: 16, flexDirection: 'row', gap: 14 }}>
        <View style={v10.icon}><V10Icon name={item.icon} size={20} /></View>
        <View style={{ flex: 1 }}><Text style={v10.body}>{item.title}</Text><Text style={v10.secondary}>{item.body}</Text>{item.caption ? <Text style={[v10.caption, { marginTop: 6 }]}>{item.caption}</Text> : null}</View>
      </V10Group>
    </V10Entrance>)}</View>
    <View style={{ marginTop: 20 }}><V10Action label="Kjør mot anbefalt område" icon="navigation" iconSize={20} disabled onPress={() => {}} testID="driver-intelligence-navigate" /></View>
    <V10Action label="Bli der jeg er" kind="ghost" onPress={() => router.navigate('/(driver)/home')} testID="driver-intelligence-stay" />
    <Text style={[v10.caption, { textAlign: 'center' }]}>Forslag er alltid valgfrie og påvirker ikke turtildeling.</Text>
  </V10Entrance></V10Screen>;
}
