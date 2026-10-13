import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Text } from '@/src/components/Typography';
import { Map } from '@/src/components/Map';
import { V10Icon } from '@/src/components/V10Icon';
import { V10Action, v10 } from '@/src/components/V10UI';
import { useAuth } from '@/src/context/AuthContext';
import { colors, useColorTheme, themedStyles } from '@/src/theme';

export default function Permissions() {
  useColorTheme();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const requesting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const continueFlow = () => {
    router.replace(!user ? '/login' : user.legal_accepted === true ? '/(app)/home' : '/legal-consent');
  };

  const shareLocation = async () => {
    if (requesting.current) return;
    requesting.current = true;
    setBusy(true);
    setError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status === 'granted') {
        continueFlow();
      } else {
        setError(permission.canAskAgain
          ? 'Posisjon ble ikke delt. Prøv igjen, eller skriv inn hentestedet selv.'
          : 'Posisjon er slått av for SNAR. Du kan endre dette i telefonens innstillinger, eller skrive inn hentestedet selv.');
      }
    } catch {
      setError('Kunne ikke be om posisjon. Prøv igjen, eller skriv inn hentestedet selv.');
    } finally {
      requesting.current = false;
      setBusy(false);
    }
  };

  return (
    <View style={s.screen} testID="permissions">
      <Map interactive={false} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={[s.scroll, { paddingTop: insets.top + 12 }]} keyboardShouldPersistTaps="handled">
        <View style={[s.sheet, { paddingBottom: Math.max(34, insets.bottom) }]}>
          <View style={s.handle} />
          <View style={s.icon}><V10Icon name="locate" color={colors.accent} /></View>
          <Text style={[v10.title, { marginTop: 18 }]}>Hvor står du nå?</Text>
          <Text style={[v10.secondary, { marginTop: 8 }]}>SNAR bruker posisjonen din for å finne nærmeste bil og sende sjåføren til riktig inngang. Du kan også skrive inn hentestedet selv.</Text>
          {error ? <Text accessibilityRole="alert" style={s.error} testID="permissions-error">{error}</Text> : null}
          <View style={s.actions}>
            <V10Action label="Del posisjon" onPress={shareLocation} busy={busy} testID="permissions-continue" />
            <V10Action label="Skriv inn adresse selv" kind="ghost" onPress={continueFlow} disabled={busy} testID="permissions-manual" />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = themedStyles(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 10, paddingHorizontal: 20, boxShadow: '0 -8px 32px rgba(11,26,44,.12)' },
  handle: { width: 36, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong, alignSelf: 'center', marginBottom: 14 },
  icon: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  actions: { marginTop: 24, gap: 4 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20, marginTop: 12 },
}));
