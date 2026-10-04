import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authApi } from '@/src/lib/api';
import { apiError } from '@/src/lib/format';
import { colors, font, makeStyles } from '@/src/theme';
import { Button } from '@/src/components/ui';
import { Icon } from '@/src/components/Icon';

export default function DriverForgotPassword() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const value = email.trim();
    if (!value) return setError('Skriv inn e-postadressen din.');
    setBusy(true); setError('');
    try {
      await authApi.forgotPassword(value);
      setSent(true);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[s.screen, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 24 }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable onPress={() => router.back()} style={s.back} accessibilityRole="button" accessibilityLabel="Tilbake">
        <Icon name="arrow-left" size={20} color={colors.text} />
      </Pressable>
      <View style={s.content}>
        <Text style={s.eyebrow}>KJAPP DRIVER · KONTO</Text>
        <Text style={s.title}>Glemt passord?</Text>
        <Text style={s.sub}>Skriv inn e-posten knyttet til sjåførkontoen. Hvis kontoen finnes, sender vi en sikker lenke.</Text>
        {sent ? (
          <View style={s.card}>
            <Icon name="mail" size={24} color={colors.online} />
            <Text style={s.cardTitle}>Sjekk e-posten din</Text>
            <Text style={s.cardText}>Av sikkerhetshensyn viser vi samme svar uansett om adressen finnes.</Text>
            <Button label="Tilbake til sjåførinnlogging" onPress={() => router.replace('/driver-login')} style={{ marginTop: 16 }} />
          </View>
        ) : (
          <>
            <View style={s.field}>
              <Icon name="mail" size={18} color={colors.textMuted} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="E-post"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                style={s.input}
                testID="driver-forgot-email"
              />
            </View>
            {error ? <Text style={s.error}>{error}</Text> : null}
            <Button label="Send tilbakestillingslenke" onPress={submit} loading={busy} style={{ marginTop: 14 }} testID="driver-forgot-submit" />
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.driverBg, paddingHorizontal: 24 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line },
  content: { flex: 1, justifyContent: 'center', paddingBottom: 80 },
  eyebrow: { color: c.online, fontFamily: font.bold, fontSize: 10, letterSpacing: 1.8 },
  title: { color: c.text, fontFamily: font.display, fontSize: 30, marginTop: 10 },
  sub: { color: c.textMuted, fontSize: 14, lineHeight: 21, marginTop: 10, marginBottom: 24 },
  field: { height: 56, borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.driverCard, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  input: { flex: 1, height: '100%', color: c.text, fontSize: 16 },
  error: { color: c.danger, fontSize: 13, marginTop: 10 },
  card: { backgroundColor: c.driverCard, borderWidth: 1, borderColor: c.line, borderRadius: 20, padding: 22 },
  cardTitle: { color: c.text, fontFamily: font.semibold, fontSize: 18, marginTop: 12 },
  cardText: { color: c.textMuted, fontSize: 13, lineHeight: 20, marginTop: 8 },
}));
