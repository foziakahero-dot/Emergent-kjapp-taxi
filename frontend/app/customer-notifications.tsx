import React, { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/src/context/AuthContext';
import { settingsApi, tripsApi } from '@/src/lib/api';
import { registerNativePush } from '@/src/lib/nativeRuntime';
import { Collapse } from '@/src/components/Motion';
import { V10Entrance } from '@/src/components/V10Entrance';
import { V10Icon } from '@/src/components/V10Icon';
import { V10Action } from '@/src/components/V10UI';
import { kr } from '@/src/lib/format';
import { Text } from '@/src/components/Typography';
import { DesignToggle } from '@/src/components/DesignToggle';
import { Loader } from '@/src/components/ui';
import { V10Group, V10Header, V10Row, V10Screen, V10State, v10 } from '@/src/components/V10UI';
import { colors, useColorTheme } from '@/src/theme';

export default function CustomerNotifications() {
  useColorTheme();
  const { user } = useAuth();
  const router = useRouter(), qc = useQueryClient();
  const key = ['customer-notification-settings', user?.id];
  const settings = useQuery({ queryKey: key, queryFn: settingsApi.get, enabled: !!user?.id });
  const trip = useQuery({ queryKey: ['customer-notification-trip', user?.id], queryFn: tripsApi.active, enabled: !!user?.id, refetchInterval: 5000 });
  const history = useQuery({ queryKey: ['customer-notification-history', user?.id], queryFn: tripsApi.list, enabled: !!user?.id });
  const receipts = (Array.isArray(history.data?.trips) ? history.data.trips : []).filter((item: any) => item.trip_id && ['arrived', 'completed', 'rated'].includes(item.status) && item.payment_status === 'paid').slice(0, 3);
  const live = trip.data?.trip_id && ['payment_authorizing', 'searching', 'booking', 'driver_on_way', 'at_pickup', 'in_trip'].includes(trip.data.status) ? trip.data : null;
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
  return <V10Screen testID="customer-notifications-screen"><V10Header title="Varsler" onBack={() => router.back()} /><V10Entrance>
    {trip.isError ? <V10State warning icon="wifiOff" title="Kunne ikke hente turstatus" body="Oppdater før du åpner aktiv tur." action="Prøv igjen" onAction={() => void trip.refetch()} /> : live ? <V10Group style={{ padding: 16, backgroundColor: colors.surfaceInverse }}><Text style={[v10.overline, { color: colors.onInverse, opacity: .6 }]}>{live.status === 'payment_authorizing' ? 'Krever handling' : 'Aktiv tur'}</Text><Text style={[v10.body, { color: colors.onInverse, marginTop: 6 }]}>{live.status === 'payment_authorizing' ? 'Godkjenn turbeløpet' : live.dropoff_address || 'Turen din'}</Text><Text style={[v10.secondary, { color: colors.onInverse, opacity: .7 }]}>Åpne turen for bekreftet status og meldinger.</Text><View style={{ marginTop: 12 }}><V10Action small label={live.status === 'payment_authorizing' ? 'Åpne betaling' : 'Åpne turen'} onPress={() => router.push(`/booking/${live.trip_id}`)} testID="notifications-active-trip" /></View></V10Group> : <V10State icon="bell" title="Ingen aktive turvarsler" body="Turoppdateringer kommer når du har en aktiv bestilling." />}
    <NotificationGroup title="Varselvalg" testID="notification-settings-group">{settings.isPending ? <Loader /> : settings.isError ? <V10State warning icon="wifiOff" title="Kunne ikke hente varselvalg" body="Sjekk forbindelsen og prøv igjen." action="Prøv igjen" onAction={() => void settings.refetch()} /> : <V10Group>{([['notifications', 'Varsler', 'Varsler knyttet til SNAR-turen din'], ['trip_updates', 'Turoppdateringer', 'Status når sjåføren er på vei og turen endrer fase']] as const).map(([field, title, subtitle], index) => <V10Row key={field} border={index > 0} icon="bell" title={title} subtitle={subtitle} right={<DesignToggle value={data?.[field] === true} onChange={value => void save(field, value)} label={title} disabled={busy || typeof data?.[field] !== 'boolean'} testID={`setting-${field}`} />} />)}</V10Group>}</NotificationGroup>
    {error ? <Text accessibilityRole="alert" testID="notifications-save-error" style={[v10.secondary, { color: colors.danger, marginTop: 12 }]}>{error}</Text> : null}
    <NotificationGroup title={`Turer${receipts.length ? ` · ${receipts.length}` : ''}`} testID="notification-trips-group"><V10Group>{!history.isError ? receipts.map((item: any, index: number) => <V10Row key={item.trip_id} border={index > 0} icon="receipt" title={`Kvittering · ${item.dropoff_address || 'SNAR-tur'}`} subtitle={kr(item.price)} onPress={() => router.push(`/receipt/${item.trip_id}?view=receipt`)} testID={`notification-receipt-${item.trip_id}`} />) : null}<V10Row border={receipts.length > 0} icon="activity" title="Tidligere turer og kvitteringer" onPress={() => router.push('/(app)/history')} /></V10Group></NotificationGroup><Text style={[v10.caption, { marginTop: 12 }]}>En egen varselhistorikk og flyvarsler er ikke tilgjengelig ennå.</Text>
  </V10Entrance></V10Screen>;
}

function NotificationGroup({ title, testID, children }: { title: string; testID: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return <View style={{ marginTop: 24 }}><Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={title} testID={testID} onPress={() => setOpen(value => !value)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40, paddingHorizontal: 4 }}><Text style={v10.overline}>{title}</Text><V10Icon name={open ? 'chevU' : 'chevD'} size={18} color={colors.textMuted} /></Pressable><Collapse open={open} duration={210}>{children}</Collapse></View>;
}
