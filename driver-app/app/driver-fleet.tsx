import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/src/context/AuthContext';
import { authApi } from '@/src/lib/api';
import { Text } from '@/src/components/Typography';
import { V10Icon } from '@/src/components/V10Icon';
import { V10Badge, V10Group, V10Header, V10Row, V10Screen, V10State, v10 } from '@/src/components/V10UI';
import { colors } from '@/src/theme';
import { Loader } from '@/src/components/ui';

export default function DriverFleet() {
  const router = useRouter();
  const { user } = useAuth();
  const me = useQuery({ queryKey: ['me', user?.id], queryFn: authApi.me, enabled: !!user?.id });
  const fleet = me.data || user;
  return <V10Screen testID="driver-fleet-screen">
    <V10Header title="Fleet" onBack={() => router.back()} />
    {me.isPending ? <Loader /> : me.isError ? <V10State icon="wifiOff" warning title="Kunne ikke hente fleet"
      body="Sjekk forbindelsen og prøv igjen." action="Prøv igjen" onAction={() => void me.refetch()} /> : !fleet?.fleet_id ?
      <V10State icon="fleet" title="Ingen fleet tilknyttet" body="Kontakt løyvehaveren din for å få tilknytningen på plass." action="Til profil" onAction={() => router.replace('/(driver)/profile')} /> : <>
      <V10Group style={{ padding: 20 }}>
        <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.surfaceInverse, alignItems: 'center', justifyContent: 'center' }}><V10Icon name="fleet" size={26} color={colors.onInverse} /></View>
        <Text style={[v10.title, { marginTop: 14 }]}>{fleet.fleet_name || 'Din fleet'}</Text>
        <Text style={v10.secondary}>Løyvehaver{fleet.fleet_org_number ? ` · org. ${fleet.fleet_org_number}` : ''}</Text>
        <View style={{ marginTop: 12 }}><V10Badge tone="positive">Tilknyttet</V10Badge></View>
      </V10Group>
      <V10Group style={{ marginTop: 12 }}>
        <V10Row icon="vehicle" title="Tildelt bil" subtitle={[fleet.car, fleet.plate].filter(Boolean).join(' · ') || 'Ingen aktiv bil valgt'} onPress={() => router.push('/driver-vehicles')} />
        <V10Row border icon="payment" title="Utbetaling" subtitle="Se bekreftede inntekter og utbetalinger" onPress={() => router.push('/(driver)/earnings')} />
      </V10Group>
    </>}
  </V10Screen>;
}
