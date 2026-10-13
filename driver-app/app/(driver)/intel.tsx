import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/src/components/Typography';
import { V10Screen, V10State, v10 } from '@/src/components/V10UI';

export default function DriverIntelligence() {
  const router = useRouter();
  return <V10Screen dock testID="driver-intelligence">
    <Text style={[v10.overline, { marginTop: 8 }]}>SNAR Drive Intelligence</Text>
    <View style={{ marginTop: 24 }}>
      <V10State icon="ai" title="Ingen innsikt tilgjengelig ennå"
        body="Når det finnes oppdaterte anbefalinger for området ditt, vises de her. Du kan fortsette å motta turer fra cockpit."
        action="Til cockpit" onAction={() => router.navigate('/(driver)/home')} />
    </View>
  </V10Screen>;
}
