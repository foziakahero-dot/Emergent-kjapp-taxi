import React, { useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/src/context/AuthContext';
import { settingsApi } from '@/src/lib/api';
import { storage } from '@/src/utils/storage';
import { isNavigationApp, navigationStorageKey, type NavigationApp } from '@/src/lib/navigationPreference';
import { Text } from '@/src/components/Typography';
import { V10Icon } from '@/src/components/V10Icon';
import { V10Group, V10Header, V10Screen, V10Section, V10State, v10 } from '@/src/components/V10UI';
import { colors, useColorTheme } from '@/src/theme';
import { Loader } from '@/src/components/ui';

export default function DriverNavigation() {
  useColorTheme();
  const router = useRouter();
  const { user } = useAuth();
  const qc = useQueryClient();
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const queryKey = ['driver-navigation-settings', user?.id];
  const settings = useQuery({ queryKey, queryFn: settingsApi.get, enabled: !!user?.id });
  const data = settings.data?.settings || settings.data;
  const selected = isNavigationApp(data?.navigation_app) ? data.navigation_app : 'google';
  const choices: [NavigationApp, string][] = [['google', 'Google Maps'], ['waze', 'Waze'], ...(Platform.OS === 'ios' ? [['apple', 'Apple Kart'] as [NavigationApp, string]] : [])];
  const select = async (choice: NavigationApp) => {
    if (!user?.id || busy.current || choice === selected) return;
    busy.current = true; setSaving(true); setError('');
    try {
      const response = await settingsApi.update({ navigation_app: choice });
      if ((response?.settings || response)?.navigation_app !== choice) throw new Error('Not confirmed');
      qc.setQueryData(queryKey, response);
      await storage.setItem(navigationStorageKey(user.id), choice).catch(() => {});
    } catch { setError('Kunne ikke lagre navigasjonsvalget. Prøv igjen.'); }
    finally { busy.current = false; setSaving(false); }
  };
  return <V10Screen testID="driver-navigation-screen">
    <V10Header title="Navigasjon" onBack={() => router.back()} />
    {settings.isPending ? <Loader /> : settings.isError ? <V10State icon="wifiOff" warning title="Kunne ikke hente navigasjonsvalget" body="Sjekk forbindelsen og prøv igjen." action="Prøv igjen" onAction={() => void settings.refetch()} /> :
      <V10Section title="Standard navigasjon"><V10Group>
        {choices.map(([key, label], index) => <Pressable key={key} accessibilityRole="radio" aria-checked={key === selected} accessibilityState={{ checked: key === selected, selected: key === selected, disabled: saving }} disabled={saving} onPress={() => void select(key)} testID={`driver-navigation-choice-${key}`}
          style={[v10.row, index > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
          <View style={v10.icon}><V10Icon name="navigation" size={20} /></View><Text style={[v10.body, { flex: 1 }]}>{label}</Text>
          <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: key === selected ? 7 : 1.5, borderColor: key === selected ? colors.text : colors.lineStrong }} />
        </Pressable>)}
      </V10Group></V10Section>}
    {error ? <Text accessibilityRole="alert" style={[v10.secondary, { marginTop: 12, color: colors.danger }]}>{error}</Text> : null}
  </V10Screen>;
}
