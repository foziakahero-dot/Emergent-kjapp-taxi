import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/src/context/AuthContext';
import { authApi, authenticatedFileSource, driverApi } from '@/src/lib/api';
import { Text } from '@/src/components/Typography';
import { V10Badge, V10Group, V10Row, V10Screen, v10 } from '@/src/components/V10UI';
import { colors, font } from '@/src/theme';

export default function DriverProfile() {
  const router = useRouter();
  const { user } = useAuth();
  const me = useQuery({ queryKey: ['me', user?.id], queryFn: authApi.me, enabled: !!user?.id });
  const ratings = useQuery({ queryKey: ['driver-ratings', user?.id], queryFn: driverApi.ratings, enabled: !!user?.id });
  const data = { ...(user || {}), ...(me.data || {}) } as any;
  const profilePhoto = useQuery({ queryKey: ['driver-profile-photo-source', user?.id, data.profile_photo_path], queryFn: () => authenticatedFileSource(data.profile_photo_path), enabled: !!user?.id && !!data.profile_photo_path });
  const name = data.fullName || 'Sjåfør';
  const initials = name.split(' ').map((part: string) => part[0]).join('').slice(0, 2);
  const verified = data.identity_verification_status === 'verified' && !data.identity_recheck_required;
  const missing = [data.drivers_license_path, data.taxi_license_path].filter(value => !value).length;
  const rating = typeof ratings.data?.average === 'number' && ratings.data?.count > 0 ? ratings.data.average.toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null;
  return <V10Screen dock testID="driver-profile-screen">
    <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center', marginVertical: 16 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Endre profilbilde" onPress={() => router.push('/driver-profile-photo')} testID="driver-profile-photo-open" style={{ width: 72, height: 72, borderRadius: 24.48, overflow: 'hidden', backgroundColor: colors.cardSubtle, alignItems: 'center', justifyContent: 'center' }}>
        {profilePhoto.data ? <Image source={profilePhoto.data} style={{ width: 72, height: 72 }} /> : <Text style={{ fontFamily: font.semibold, fontSize: 25.92, color: colors.text }}>{initials}</Text>}
      </Pressable>
      <View style={{ flex: 1 }}><Text style={v10.title}>{name}</Text>
        <Text style={v10.secondary}>{ratings.isError ? 'Vurderinger utilgjengelige' : ratings.isPending ? 'Henter vurderinger…' : rating ? `★ ${rating}${typeof data.trip_count === 'number' ? ` · ${data.trip_count.toLocaleString('nb-NO')} turer` : ` · ${ratings.data.count} vurderinger`}` : 'Ingen vurderinger ennå'}</Text>
        {verified ? <View style={{ marginTop: 6 }}><V10Badge tone="positive">Verifisert</V10Badge></View> : null}
      </View>
    </View>
    {me.isError ? <Text accessibilityRole="alert" style={[v10.secondary, { marginBottom: 12, color: colors.danger }]}>Kunne ikke oppdatere profilen. Viser sist kjente kontodata.</Text> : null}
    <V10Group>
      <V10Row icon="doc" title="Dokumenter" subtitle={me.isPending ? 'Henter dokumentstatus…' : me.isError ? 'Åpne for å hente status' : missing ? `${missing} dokumenter mangler` : 'Førerkort og kjøreseddel mottatt'} right={!me.isPending && !me.isError && missing ? <V10Badge tone="warning">{missing}</V10Badge> : undefined} onPress={() => router.push('/driver-documents')} testID="driver-profile-documents" />
      <V10Row border icon="vehicle" title="Kjøretøy" subtitle={[data.car, data.plate].filter(Boolean).join(' · ') || 'Ingen aktiv bil valgt'} onPress={() => router.push('/driver-vehicles')} testID="driver-profile-vehicles" />
      <V10Row border icon="fleet" title="Fleet" subtitle={data.fleet_name || 'Ingen fleet tilknyttet'} onPress={() => router.push('/driver-fleet')} testID="driver-profile-fleet" />
      <V10Row border icon="activity" title="Aktivitet" onPress={() => router.push('/driver-trips')} testID="driver-profile-activity" />
    </V10Group>
    <V10Group style={{ marginTop: 12 }}>
      <V10Row icon="navigation" title="Navigasjon" onPress={() => router.push('/driver-navigation')} testID="driver-profile-navigation" />
      <V10Row border icon="settings" title="Innstillinger" onPress={() => router.push('/driver-settings')} testID="driver-profile-settings" />
    </V10Group>
  </V10Screen>;
}
