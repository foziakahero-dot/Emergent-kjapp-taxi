import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/src/context/AuthContext';
import { authApi, driverApi } from '@/src/lib/api';
import { V10Action, V10Badge, V10Group, V10Header, V10Row, V10Screen, V10State } from '@/src/components/V10UI';
import { Loader } from '@/src/components/ui';
import { V10Entrance } from '@/src/components/V10Entrance';

export default function DriverDocuments() {
  const router = useRouter();
  const { user } = useAuth();
  const me = useQuery({ queryKey: ['me', user?.id], queryFn: authApi.me, enabled: !!user?.id });
  const identity = useQuery({ queryKey: ['driver-identity', user?.id], queryFn: driverApi.identityVerification, enabled: !!user?.id });
  const data = me.data;
  const identityStatus = identity.data?.status;
  const verified = identityStatus === 'verified' && !data?.identity_recheck_required;
  const pending = identityStatus === 'pending_review';
  return <V10Screen testID="driver-documents-screen"><V10Entrance fade>
    <V10Header title="Dokumenter" onBack={() => router.back()} />
    {me.isPending ? <Loader /> : me.isError ? <V10State icon="wifiOff" warning title="Kunne ikke hente dokumentene"
      body="Dokumentstatusen er ikke tilgjengelig akkurat nå." action="Prøv igjen" onAction={() => void me.refetch()} /> : <>
      <V10Group>
        <V10Row icon="id" title="Førerkort" subtitle={data?.drivers_license_path ? 'Registrert hos SNAR' : 'Kontakt løyvehaver for opplasting'} right={<V10Badge tone={data?.drivers_license_path ? 'neutral' : 'warning'}>{data?.drivers_license_path ? 'Mottatt' : 'Mangler'}</V10Badge>} />
        <V10Row border icon="doc" title="Kjøreseddel" subtitle={data?.taxi_license_path ? 'Registrert hos SNAR' : 'Kontakt løyvehaver for opplasting'} right={<V10Badge tone={data?.taxi_license_path ? 'neutral' : 'warning'}>{data?.taxi_license_path ? 'Mottatt' : 'Mangler'}</V10Badge>} />
        <V10Row border icon="user" title="Profilbilde" subtitle={data?.profile_photo_path ? 'Trykk for å endre bildet' : 'Legg til et profilbilde'} onPress={() => router.push('/driver-profile-photo')} />
        <V10Row border icon="camera" title="Selfie-verifisering" subtitle={identity.isError ? 'Kunne ikke hente status' : pending ? 'Venter på kontroll' : verified ? 'Identiteten din er verifisert' : 'Bekreft at det er deg'} onPress={() => router.push('/driver-identity')}
          right={identity.isPending ? <Loader /> : identity.isError ? undefined : <V10Badge tone={verified ? 'positive' : pending ? 'neutral' : 'critical'}>{verified ? 'Godkjent' : pending ? 'Vurderes' : 'Kreves'}</V10Badge>} />
      </V10Group>
      <View style={{ marginTop: 16 }}><V10Action label="Åpne identitetskontroll" icon="camera" kind="soft" onPress={() => router.push('/driver-identity')} /></View>
    </>}
  </V10Entrance></V10Screen>;
}
