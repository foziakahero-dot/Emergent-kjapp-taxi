import React, { useRef, useState } from 'react';
import { Linking, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/src/components/Typography';
import { DesignToggle } from '@/src/components/DesignToggle';
import { V10Action, V10Group, V10Header, V10Row, V10Screen, v10 } from '@/src/components/V10UI';
import { useReducedMotion } from '@/src/components/Motion';
import { saveAccessibilityPreference, useAccessibilityPreferences, type AccessibilityPreferences } from '@/src/lib/accessibilityPreferences';
import { colors, useColorTheme } from '@/src/theme';
export default function CustomerAccessibility() {
  useColorTheme();
  const router = useRouter();
  const preferences = useAccessibilityPreferences(), reduced = useReducedMotion();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const save = async (key: keyof AccessibilityPreferences, value: boolean) => {
    if (lock.current || !preferences.ready) return;
    lock.current = true; setBusy(true); setError('');
    try { if (!await saveAccessibilityPreference(key, value)) throw new Error('Valget ble ikke lagret.'); }
    catch { setError('Endringen ble ikke lagret. Prøv igjen.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <V10Screen testID="customer-accessibility-screen"><V10Header title="Tilgjengelighet" onBack={() => router.back()} />
    <V10Group style={{ padding: 16, marginBottom: 16 }}><Text style={[v10.body, { fontSize: 17 }]}>Sjåføren er på vei</Text><Text style={v10.caption}>Forhåndsvisning av tekst · eksempel</Text></V10Group>
    <V10Group><V10Row icon="text" title="Større tekst" subtitle="Øker appens tekst. Systemets tekstvalg beholdes." right={<DesignToggle value={preferences.largeText} onChange={value => void save('largeText', value)} label="Større tekst" disabled={busy || !preferences.ready} testID="accessibility-large-text" />} />
      <V10Row border icon="contrast" title="Økt kontrast" subtitle="Eget kontrastvalg er ikke tilgjengelig ennå." right={<DesignToggle value={false} onChange={() => {}} label="Økt kontrast, ikke tilgjengelig" disabled />} />
      <V10Row border icon="sliders" title="Redusert bevegelse" subtitle={reduced && !preferences.reduceMotion ? 'Aktivert i telefonens innstillinger.' : 'Begrenser animasjoner i hele appen.'} right={<DesignToggle value={reduced} onChange={value => void save('reduceMotion', value)} label="Redusert bevegelse" disabled={busy || !preferences.ready || (reduced && !preferences.reduceMotion)} testID="accessibility-reduced-motion" />} />
      <V10Row border icon="voice" title="Stemmestøtte" subtitle="Bruk telefonens VoiceOver eller TalkBack." right={<DesignToggle value={false} onChange={() => {}} label="Egen stemmestøtte, ikke tilgjengelig" disabled />} />
    </V10Group><Text style={[v10.caption, { marginTop: 12, paddingHorizontal: 4 }]}>Statuser bruker form og tekst i tillegg til farge. Valgene lagres på denne enheten.</Text>
    {error ? <Text accessibilityRole="alert" testID="accessibility-save-error" style={[v10.secondary, { color: colors.danger, marginTop: 12 }]}>{error}</Text> : null}
    <View style={{ marginTop: 16 }}><V10Action kind="soft" label="Åpne telefonens innstillinger" onPress={() => void Linking.openSettings().catch(() => setError('Kunne ikke åpne telefonens innstillinger.'))} /></View>
  </V10Screen>;
}
