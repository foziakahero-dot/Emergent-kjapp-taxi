import { Text } from '@/src/components/Typography';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { colors, makeStyles, useColorTheme } from '@/src/theme';
import { messagesApi } from '@/src/lib/api';

const SUPPORTED = new Set(['no', 'nb', 'nn', 'en', 'sv', 'da', 'de', 'es', 'fr', 'pl', 'ur', 'ar', 'so', 'ti', 'fa', 'tr', 'ru', 'uk', 'vi', 'th', 'zh', 'hi']);

export function deviceLanguage(): string {
  try {
    const code = Intl.DateTimeFormat().resolvedOptions().locale.split('-')[0].toLowerCase();
    return SUPPORTED.has(code) ? code : 'no';
  } catch {
    return 'no';
  }
}

export function TranslatableMessage({ text, textStyle }: { text: string; textStyle?: any }) {
  useColorTheme();
  const s = useStyles();
  const [translation, setTranslation] = useState<string | null>(null);
  const [showTranslated, setShowTranslated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const toggle = async () => {
    if (busy) return;
    if (translation) {
      setShowTranslated((v) => !v);
      return;
    }
    setBusy(true);
    setFailed(false);
    try {
      const r = await messagesApi.translate(text, deviceLanguage());
      setTranslation(r.translation);
      setShowTranslated(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const label = failed ? 'Kunne ikke oversette – prøv igjen' : showTranslated ? 'Vis original' : 'Oversett';

  return (
    <View>
      <Text style={textStyle}>{showTranslated && translation ? translation : text}</Text>
      <Pressable
        onPress={toggle}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={label}
        testID="chat-translate"
        style={s.action}
      >
        {busy ? <ActivityIndicator size="small" color={colors.textMuted} /> : <Text style={s.actionText}>{label}</Text>}
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  action: { marginTop: 6, alignSelf: 'flex-start', minHeight: 18, justifyContent: 'center' },
  actionText: { color: c.textMuted, fontSize: 12, textDecorationLine: 'underline' },
}));
