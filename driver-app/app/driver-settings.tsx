import React, { useRef, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/src/context/AuthContext';
import { settingsApi } from '@/src/lib/api';
import { storage } from '@/src/utils/storage';
import { useAccessibilityPreferences, saveAccessibilityPreference, type AccessibilityPreferences } from '@/src/lib/accessibilityPreferences';
import { Text } from '@/src/components/Typography';
import { DesignToggle } from '@/src/components/DesignToggle';
import { Loader } from '@/src/components/ui';
import { V10Action, V10Group, V10Header, V10Row, V10Screen, V10Section, V10State, v10 } from '@/src/components/V10UI';
import { colors } from '@/src/theme';

export default function DriverSettings() {
  const { user, logout } = useAuth();
  const router = useRouter(), qc = useQueryClient();
  const key = ['driver-v10-settings', user?.id];
  const query = useQuery({ queryKey: key, queryFn: settingsApi.get, enabled: !!user?.id });
  const data = query.data?.settings || query.data;
  const preferences = useAccessibilityPreferences();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const save = async (field: 'req_sound' | 'req_vibrate', value: boolean) => {
    if (lock.current || !data || query.isError) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const response = await settingsApi.update({ [field]: value }), confirmed = response?.settings || response;
      if (confirmed?.[field] !== value) throw new Error('Valget ble ikke bekreftet.');
      qc.setQueryData(key, { ...data, ...confirmed });
      await storage.setItem(`driver_${field}`, String(value)).catch(() => setError('Valget er lagret på serveren, men kunne ikke oppdateres lokalt. Åpne konto og innstillinger igjen.'));
    } catch { setError('Kunne ikke lagre kjøreinnstillingen. Prøv igjen.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const local = async (field: keyof AccessibilityPreferences, value: boolean) => {
    if (lock.current || !preferences.ready) return;
    lock.current = true; setBusy(true); setError('');
    try { if (!await saveAccessibilityPreference(field, value)) throw new Error('Valget ble ikke lagret.'); }
    catch { setError('Kunne ikke lagre visningsvalget. Prøv igjen.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const signOut = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await logout(); router.replace('/driver-login'); }
    catch { setError('Kunne ikke logge ut. Prøv igjen.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <V10Screen testID="driver-settings-screen"><V10Header title="Innstillinger" onBack={() => router.back()} />
    <V10Section title="Turer"><V10Group><V10Row icon="vehicle" title="Kjøretøy" subtitle={[user?.car, user?.plate].filter(Boolean).join(' · ') || 'Velg tildelt bil'} onPress={() => router.push('/driver-vehicles')} />
      {query.isPending ? <Loader /> : query.isError ? <V10State warning icon="wifiOff" title="Kunne ikke hente innstillinger" body="Oppdater før du endrer kjørevalg." action="Prøv igjen" onAction={() => void query.refetch()} /> : <>{(['req_sound', ...(Platform.OS === 'android' ? ['req_vibrate'] : [])] as ('req_sound' | 'req_vibrate')[]).map(field => <V10Row key={field} border icon="bell" title={field === 'req_sound' ? 'Lyd for ny tur' : 'Vibrasjon for ny tur'} subtitle={field === 'req_sound' ? 'Standard varsellyd på enheten' : 'Vibrasjon ved nye turforespørsler'} right={<DesignToggle value={data?.[field] !== false} onChange={value => void save(field, value)} label={field === 'req_sound' ? 'Lyd for ny tur' : 'Vibrasjon for ny tur'} disabled={busy || !data} testID={`driver-setting-${field}`} />} />)}</>}
    </V10Group></V10Section>
    <V10Section title="Visning"><V10Group><V10Row icon="moon" title="Mørk cockpit" subtitle="Mørkt tema er ikke tilgjengelig ennå." right={<DesignToggle value={false} onChange={() => {}} label="Mørk cockpit, ikke tilgjengelig" disabled />} />
      <V10Row border icon="text" title="Stor tekst i cockpit" right={<DesignToggle value={preferences.largeText} onChange={value => void local('largeText', value)} label="Stor tekst i cockpit" disabled={busy || !preferences.ready} testID="driver-setting-large-text" />} />
      <V10Row border icon="sliders" title="Redusert bevegelse" subtitle="Telefonens bevegelsesvalg beholdes alltid." right={<DesignToggle value={preferences.reduceMotion} onChange={value => void local('reduceMotion', value)} label="Redusert bevegelse" disabled={busy || !preferences.ready} testID="driver-setting-reduced-motion" />} />
    </V10Group></V10Section>
    <V10Section title="Konto"><V10Group><V10Row icon="user" title="Konto og profil" onPress={() => router.push('/driver-account')} testID="ds-account" /><V10Row border icon="lock" title="Personvern og data" onPress={() => router.push('/driver-account-settings')} testID="ds-privacy" /><V10Row border icon="help" title="Sjåførsupport" onPress={() => void Linking.openURL('https://snarapp.no/help').catch(() => setError('Kunne ikke åpne support.'))} testID="ds-support" /></V10Group></V10Section>
    <View style={{ marginTop: 16 }}><V10Action kind="ghost" label="Logg ut" onPress={() => void signOut()} busy={busy} testID="ds-logout" /></View>{error ? <Text testID="driver-settings-error" accessibilityRole="alert" style={[v10.secondary, { color: colors.danger }]}>{error}</Text> : null}
  </V10Screen>;
}
