import React, { useEffect, useRef, useState } from 'react';
import { Share, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/src/context/AuthContext';
import { safetyApi, tripsApi } from '@/src/lib/api';
import { apiError } from '@/src/lib/format';
import { useTranslation } from '@/src/lib/customerLanguage';
import { Text } from '@/src/components/Typography';
import { DesignToggle } from '@/src/components/DesignToggle';
import { Loader } from '@/src/components/ui';
import { V10Action, V10Group, V10Header, V10Row, V10Screen, V10State, v10 } from '@/src/components/V10UI';
import { colors, useColorTheme } from '@/src/theme';

const SHARE_STATUSES = ['driver_on_way', 'at_pickup', 'in_trip'];
const PICKUP_STATUSES = ['driver_on_way', 'at_pickup'];

export default function CustomerTripSettings() {
  useColorTheme();
  const { t } = useTranslation();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const pickup = mode === 'pickup';
  const { user } = useAuth(), router = useRouter(), qc = useQueryClient();
  const key = ['customer-settings-trip', user?.id];
  const query = useQuery({ queryKey: key, queryFn: tripsApi.active, enabled: !!user?.id, refetchInterval: 5000, staleTime: 0 });
  const trip = query.data;
  const eligible = !!trip?.trip_id && (pickup ? PICKUP_STATUSES : SHARE_STATUSES).includes(trip.status);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const active = useRef(true), context = useRef({ userId: user?.id, mode });
  context.current = { userId: user?.id, mode };
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const perform = async (waitingInside?: boolean) => {
    if (lock.current || !eligible || query.isError) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    const isCurrent = () => active.current && context.current.userId === user?.id && context.current.mode === mode;
    try {
      // Validate again at the tap: polling data can be stale or the trip may
      // have ended while the customer was choosing an action.
      const fresh = await tripsApi.active();
      if (!isCurrent()) return;
      if (fresh?.trip_id !== trip.trip_id || !(pickup ? PICKUP_STATUSES : SHARE_STATUSES).includes(fresh.status)) {
        qc.setQueryData(key, fresh);
        throw new Error(t('Turen har endret status. Kontroller den oppdaterte turen.'));
      }
      if (pickup) {
        const result = await tripsApi.pickupPreference(fresh.trip_id, waitingInside === true);
        if (!isCurrent()) return;
        if (result?.ok !== true || result.waiting_inside !== waitingInside) throw new Error(t('Henteinstruksen ble ikke bekreftet.'));
        qc.setQueryData(key, { ...fresh, pickup_waiting_inside: result.waiting_inside });
        void qc.invalidateQueries({ queryKey: ['customer-trip', fresh.trip_id] });
        setNotice(t('Henteinstruksen er lagret for denne turen.'));
      } else {
        const result = await safetyApi.shareLink(fresh.trip_id);
        if (!isCurrent()) return;
        if (typeof result?.url !== 'string' || !/^https:\/\//.test(result.url)) throw new Error(t('Kunne ikke hente lenken til turen. Prøv igjen.'));
        const shared = await Share.share({ title: t('Følg SNAR-turen min'), message: `${t('Følg turen min live:')} ${result.url}`, url: result.url });
        if (shared.action === Share.sharedAction) void safetyApi.log(fresh.trip_id, { kind: 'share' }).catch(() => {});
      }
    } catch (e) { if (isCurrent()) setError(apiError(e)); }
    finally { lock.current = false; if (isCurrent()) setBusy(false); }
  };
  return <V10Screen dock testID="customer-trip-settings-screen"><V10Header title={t(pickup ? 'Henteinstruks' : 'Del tur')} onBack={() => router.back()} />
    {query.isPending ? <Loader /> : query.isError ? <V10State icon="wifiOff" warning title={t('Kunne ikke hente aktiv tur')} body={t('Sjekk forbindelsen og prøv igjen.')} action={t('Prøv igjen')} onAction={() => void query.refetch()} /> : !eligible ? <V10State icon={pickup ? 'inside' : 'share'} title={t(trip?.trip_id ? 'Dette valget er ikke tilgjengelig akkurat nå' : 'Ingen aktiv tur')} body={t(pickup ? 'Du kan gi beskjed om henting når sjåføren er på vei eller har kommet frem.' : 'Du kan dele turen når en sjåfør er på vei, ved henting og under turen.')} action={trip?.trip_id ? t('Åpne turen') : undefined} onAction={trip?.trip_id ? () => router.push(`/booking/${trip.trip_id}`) : undefined} /> : <>
      <V10Group style={{ padding: 16, gap: 8, marginBottom: 20 }}><Text style={v10.overline}>{t('Aktiv tur')}</Text><Text style={v10.body}>{trip.pickup_address}</Text><Text style={v10.secondary}>{trip.dropoff_address}</Text></V10Group>
      {pickup ? <><V10Group><V10Row icon="inside" title={t('Jeg venter inne')} subtitle={t('Gjelder bare denne turen. Du må møte sjåføren ved det avtalte hentestedet.')} right={<DesignToggle label={t('Jeg venter inne')} value={trip.pickup_waiting_inside === true} onChange={value => void perform(value)} disabled={busy || query.isError} testID="settings-waiting-inside" />} /></V10Group></> : <><Text style={[v10.secondary, { marginBottom: 16 }]}>{t('Del en lenke til den aktive turen med noen du stoler på. Lenken gir tilgang til turstatus og posisjon.')}</Text><V10Action label={t('Del turen live')} icon="share" busy={busy} onPress={() => void perform()} testID="settings-share-trip" /></>}
    </>}
    {error ? <Text testID="trip-settings-error" accessibilityRole="alert" style={[v10.secondary, { marginTop: 16, color: colors.danger }]}>{error}</Text> : null}
    {notice ? <Text testID="trip-settings-saved" accessibilityLiveRegion="polite" style={[v10.secondary, { marginTop: 16 }]}>{notice}</Text> : null}
    <View style={{ marginTop: 24 }}><V10Action kind="ghost" label={t('Tilbake til innstillinger')} onPress={() => router.back()} /></View>
  </V10Screen>;
}
