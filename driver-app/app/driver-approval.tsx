import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/src/context/AuthContext';
import { authApi, driverApi } from '@/src/lib/api';
import { Text } from '@/src/components/Typography';
import { Loader } from '@/src/components/ui';
import { V10Action, V10Badge, V10Group, V10Row, V10Screen, V10State, v10 } from '@/src/components/V10UI';
import { colors, useColorTheme } from '@/src/theme';

export default function DriverApproval() {
  useColorTheme();
  const { user, refresh, logout } = useAuth();
  const router = useRouter();
  const account = useQuery({ queryKey: ['driver-approval-account', user?.id], queryFn: authApi.me, enabled: user?.role === 'driver' });
  const identity = useQuery({ queryKey: ['driver-approval-identity', user?.id], queryFn: driverApi.identityVerification, enabled: user?.role === 'driver' });
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false);
  const profile = account.data || user;
  const verified = identity.data?.status === 'verified' && !profile?.identity_recheck_required;
  const pending = identity.data?.status === 'pending_review';
  const ready = !account.isError && !identity.isError && profile?.approved === true && profile?.legal_accepted === true && verified;
  const enter = async () => {
    if (lock.current || !ready) return;
    lock.current = true; setBusy(true); setError('');
    try { await refresh(); router.replace('/'); } catch { setError('Kunne ikke oppdatere kontostatus. Prøv igjen.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const documents = [{ key: 'drivers_license_path', icon: 'id', title: 'Førerkort' }, { key: 'taxi_license_path', icon: 'doc', title: 'Kjøreseddel' }]
    .sort((a, b) => Number(Boolean((profile as any)?.[a.key])) - Number(Boolean((profile as any)?.[b.key])));
  return <V10Screen testID="driver-approval-screen">
    <Text style={[v10.overline, { marginTop: 16 }]}>Kontostatus</Text><Text style={[v10.title, { marginTop: 4 }]}>{ready ? 'Klar' : 'Nesten klar'}{profile?.fullName ? `, ${profile.fullName.split(' ')[0]}` : ''}</Text><Text style={[v10.secondary, { marginTop: 6 }]}>Konto, vilkår og identitet må være godkjent før du kan gå online.</Text>
    {user?.role !== 'driver' ? <View style={{ marginTop: 20 }}><V10State icon="lock" title="Logg inn som sjåfør" body="Godkjenning gjelder din registrerte sjåførkonto." action="Logg inn" onAction={() => router.replace('/driver-login')} /></View> : account.isPending || identity.isPending ? <View style={{ marginTop: 20 }}><Loader /></View> : <>
      {account.isError || identity.isError ? <View style={{ marginTop: 20 }}><V10State warning icon="wifiOff" title="Kunne ikke hente kontostatus" body="Oppdater før du fortsetter. Sist lagrede data er ikke en ny godkjenning." action="Prøv igjen" onAction={() => { void account.refetch(); void identity.refetch(); }} /></View> : null}
      <V10Group style={{ marginTop: 20, borderWidth: verified ? 0 : 1.5, borderColor: colors.warning }}><V10Row icon="camera" title="Selfie-verifisering" subtitle={pending ? 'Venter på manuell kontroll' : verified ? 'Identiteten er bekreftet' : 'Bekreft at det er deg'} onPress={() => router.push('/driver-identity')} testID="driver-approval-identity" right={<V10Badge tone={verified ? 'positive' : 'warning'}>{verified ? 'Godkjent' : pending ? 'Vurderes' : 'Kreves'}</V10Badge>} /></V10Group>
      <V10Group style={{ marginTop: 12 }}>{documents.map((document, index) => <V10Row key={document.key} border={index > 0} icon={document.icon} title={document.title} subtitle={(profile as any)?.[document.key] ? 'Dokument er registrert' : 'Dokument mangler'} onPress={() => router.push('/driver-account')} right={<V10Badge tone={(profile as any)?.[document.key] ? 'neutral' : 'warning'}>{(profile as any)?.[document.key] ? 'Registrert' : 'Mangler'}</V10Badge>} testID={`driver-approval-${document.key}`} />)}
        <V10Row border icon="fleet" title={profile?.fleet_name || 'Løyvehaver'} subtitle={profile?.approved === true ? 'Sjåførkontoen er godkjent' : 'Sjåførkontoen venter på godkjenning'} right={<V10Badge tone={profile?.approved === true ? 'positive' : 'neutral'}>{profile?.approved === true ? 'Godkjent' : 'Vurderes'}</V10Badge>} />
        <V10Row border icon="lock" title="Vilkår og personvern" subtitle={profile?.legal_accepted === true ? 'Godtatt' : 'Må godtas før kjøring'} onPress={() => router.push('/driver-legal-consent')} />
      </V10Group>
      <View style={{ marginTop: 24 }}>{ready ? <V10Action label="Fortsett" onPress={() => void enter()} busy={busy} testID="driver-approval-continue" /> : <V10Action label={pending ? 'Se kontrollstatus' : 'Verifiser nå'} onPress={() => router.push('/driver-identity')} testID="driver-approval-verify" />}</View>
      {error ? <Text accessibilityRole="alert" style={[v10.secondary, { color: colors.danger, marginTop: 8 }]}>{error}</Text> : null}
      <V10Action kind="ghost" label="Oppdater kontostatus" onPress={() => { void account.refetch(); void identity.refetch(); }} />
      <V10Action kind="ghost" label="Logg ut" onPress={() => { if (!lock.current) { lock.current = true; void logout().then(() => router.replace('/driver-login')).catch(() => setError('Kunne ikke logge ut. Prøv igjen.')).finally(() => { lock.current = false; }); } }} testID="driver-role-logout" />
    </>}
  </V10Screen>;
}
