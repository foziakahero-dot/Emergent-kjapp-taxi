import React, { useRef, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Text } from './Typography';
import { V10Action, V10Row, v10 } from './V10UI';
import { saveCustomerLanguage, useTranslation, type CustomerLanguage } from '@/src/lib/customerLanguage';
import { colors, useColorTheme } from '@/src/theme';

export function LanguageRow({ border = false }: { border?: boolean }) {
  useColorTheme();
  const { language, ready, t } = useTranslation();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const lock = useRef(false);
  const choose = async (value: CustomerLanguage) => {
    if (lock.current || !ready) return;
    lock.current = true; setBusy(true); setError(false);
    try { if (!await saveCustomerLanguage(value)) throw new Error(); setOpen(false); }
    catch { setError(true); }
    finally { lock.current = false; setBusy(false); }
  };
  return <><V10Row border={border} icon="globe" title={t('Språk')} subtitle={t('Velg språk for innstillinger, konto og kundestøtte.')} right={<Text style={v10.secondary}>{language === 'en' ? 'English' : 'Norsk'}</Text>} onPress={() => setOpen(true)} disabled={!ready} testID="settings-language" />
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => { if (!busy) setOpen(false); }}>
      <View style={{ flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,.45)' }}>
        <View accessibilityViewIsModal style={{ width: '100%', maxWidth: 400, padding: 20, borderRadius: 24, backgroundColor: colors.surface }}>
          <Text style={v10.heading}>{t('Velg språk')}</Text>
          {([['nb', 'Norsk (bokmål)'], ['en', 'English']] as const).map(([value, label]) => <Pressable key={value} testID={`language-choice-${value}`} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: language === value, disabled: busy }} disabled={busy} onPress={() => void choose(value)} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: language === value ? 7 : 1.5, borderColor: language === value ? colors.text : colors.lineStrong }} /><Text style={v10.body}>{label}</Text>
          </Pressable>)}
          <Text style={[v10.caption, { marginBottom: 12 }]}>{t('Valget lagres på denne enheten. Turskjermene er foreløpig på norsk.')}</Text>
          {error ? <Text testID="language-save-error" accessibilityRole="alert" style={{ color: colors.danger }}>{t('Språkvalget ble ikke lagret. Prøv igjen.')}</Text> : null}
          <V10Action kind="ghost" label={t('Avbryt')} disabled={busy} onPress={() => setOpen(false)} />
        </View>
      </View>
    </Modal>
  </>;
}
