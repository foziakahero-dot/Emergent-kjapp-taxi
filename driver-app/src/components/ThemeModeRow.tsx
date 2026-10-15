import React, { useRef, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Text } from '@/src/components/Typography';
import { V10Action, V10Row, v10 } from '@/src/components/V10UI';
import { colors, saveColorThemeMode, useColorTheme, type ColorThemeMode } from '@/src/theme';

const names = { light: 'Lyst', dark: 'Mørkt', system: 'Automatisk' };
export function ThemeModeRow() {
  const theme = useColorTheme();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false);
  const choose = async (mode: ColorThemeMode) => {
    if (lock.current || !theme.ready) return;
    lock.current = true; setBusy(true); setError('');
    try { if (!await saveColorThemeMode(mode)) throw new Error('Valget ble ikke lagret.'); setOpen(false); }
    catch { setError('Kunne ikke lagre utseendet. Prøv igjen.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <><V10Row icon="moon" title="Utseende" right={<Text style={v10.secondary}>{names[theme.mode]}</Text>} onPress={() => setOpen(true)} testID="theme-open" disabled={!theme.ready} />
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => { if (!busy) setOpen(false); }}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.45)', paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: '100%', maxWidth: 400, padding: 20, borderRadius: 24, backgroundColor: colors.surface }}><Text style={[v10.heading, { marginBottom: 12 }]}>Utseende</Text>
        {(['light', 'dark', 'system'] as const).map(mode => <Pressable key={mode} testID={`theme-choice-${mode}`} accessibilityRole="radio" accessibilityLabel={names[mode]} accessibilityState={{ checked: theme.mode === mode, disabled: busy }} disabled={busy} onPress={() => void choose(mode)} style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: theme.mode === mode ? 7 : 1.5, borderColor: theme.mode === mode ? colors.text : colors.lineStrong }} /><Text style={v10.body}>{names[mode]}</Text></Pressable>)}
        {error ? <Text testID="theme-error" accessibilityRole="alert" style={[v10.secondary, { color: colors.danger, marginVertical: 12 }]}>{error}</Text> : null}<V10Action kind="ghost" label="Avbryt" onPress={() => setOpen(false)} disabled={busy} />
      </View></View>
    </Modal>
  </>;
}
