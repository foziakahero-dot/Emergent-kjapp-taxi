import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/src/context/AuthContext';
import { settingsApi, tripsApi } from '@/src/lib/api';
import { registerNativePush } from '@/src/lib/nativeRuntime';
import { Text } from '@/src/components/Typography';
import { DesignToggle } from '@/src/components/DesignToggle';
import { Loader } from '@/src/components/ui';
import { V10Group, V10Header, V10Row, V10Screen, V10Section, V10State, v10 } from '@/src/components/V10UI';
import { colors, useColorTheme } from '@/src/theme';

export default function CustomerNotifications() {
  useColorTheme();
  const { user } = useAuth();
  const router = useRouter(), qc = useQueryClient();
  const key = ['customer-notification-settings', user?.id];
  const settings = useQuery({ queryKey: key, queryFn: settingsApi.get, enabled: !!user?.id });
  const trip = useQuery({ queryKey: ['customer-notification-trip', user?.id], queryFn: tripsApi.active, enabled: !!user?.id, refetchInterval: 5000 });
  const data = settings.data?.settings || settings.data;
  const lock = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const save = async (field: 'notifications' | 'trip_updates', value: boolean) => {
    if (lock.current || !data || settings.isError) return;
    lock.current = true; setBusy(true); setError('');
    try {
      if (value && !await registerNativePush()) throw new Error('Varsler er ikke aktivert på denne enheten. Kontroller tillatelsen og prøv igjen.');
      const response = await settingsApi.update({ [field]: value });
      const confirmed = response?.settings || response;
      if (confirmed?.[field] !== value) throw new Error('Varselvalget ble ikke bekreftet.');
      qc.setQueryData(key, { ...data, ...confirmed });
    } catch (error) { setError(error instanceof Error ? error.message : 'Kunne ikke lagre varselvalget.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <V10Screen testID="customer-notifications-screen"><V10Header title="Varsler" onBack={() => router.back()} />
    {trip.isError ? <V10State warning icon="wifiOff" title="Kunne ikke hente turstatus" body="Oppdater før du åpner aktiv tur." action="Prøv igjen" onAction={() => void trip.refetch()} /> : trip.data?.trip_id ? <V10Group style={{ padding: 16 }}><Text style={v10.overline}>Aktiv tur</Text><V10Row icon="trip" title={trip.data.dropoff_address || 'Turen din'} subtitle="Åpne turen for bekreftet status og meldinger." onPress={() => router.push(`/booking/${trip.data.trip_id}`)} testID="notifications-active-trip" /></V10Group> : <V10State icon="bell" title="Ingen aktive turvarsler" body="Turoppdateringer kommer når du har en aktiv bestilling." />}
    <V10Section title="Varselvalg">{settings.isPending ? <Loader /> : settings.isError ? <V10State warning icon="wifiOff" title="Kunne ikke hente varselvalg" body="Sjekk forbindelsen og prøv igjen." action="Prøv igjen" onAction={() => void settings.refetch()} /> : <V10Group>{([['notifications', 'Varsler', 'Varsler knyttet til SNAR-turen din'], ['trip_updates', 'Turoppdateringer', 'Status når sjåføren er på vei og turen endrer fase']] as const).map(([field, title, subtitle], index) => <V10Row key={field} border={index > 0} icon="bell" title={title} subtitle={subtitle} right={<DesignToggle value={data?.[field] === true} onChange={value => void save(field, value)} label={title} disabled={busy || typeof data?.[field] !== 'boolean'} testID={`setting-${field}`} />} />)}</V10Group>}</V10Section>
    {error ? <Text accessibilityRole="alert" testID="notifications-save-error" style={[v10.secondary, { color: colors.danger, marginTop: 12 }]}>{error}</Text> : null}
    <V10Section title="Turer"><V10Group><V10Row icon="receipt" title="Tidligere turer og kvitteringer" onPress={() => router.push('/(app)/history')} /></V10Group></V10Section><Text style={[v10.caption, { marginTop: 12 }]}>En egen varselhistorikk og flyvarsler er ikke tilgjengelig ennå.</Text>
  </V10Screen>;
}
