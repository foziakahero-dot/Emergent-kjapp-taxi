import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authApi } from '@/src/lib/api';
import { apiError } from '@/src/lib/format';
import { colors, font, makeStyles } from '@/src/theme';
import { Button, Loader } from '@/src/components/ui';
import { Icon } from '@/src/components/Icon';

export default function DriverResetPassword() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const [state, setState] = useState<'checking'|'form'|'invalid'|'done'>('checking');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const value = String(token || '');
    if (!value) { setState('invalid'); return; }
    authApi.checkResetToken(value).then(() => setState('form')).catch(() => setState('invalid'));
  }, [token]);

  const submit = async () => {
    setError('');
    if (password.length < 6) return setError('Passord må ha minst 6 tegn.');
    if (password !== again) return setError('Passordene er ikke like.');
    setBusy(true);
    try {
      await authApi.resetPassword(String(token), password);
      setState('done');
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[s.screen, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 24 }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable onPress={() => router.replace('/driver-login')} style={s.back} accessibilityRole="button" accessibilityLabel="Til innlogging">
        <Icon name="arrow-left" size={20} color={colors.text} />
      </Pressable>
      <View style={s.content}>
        {state === 'checking' ? <Loader /> : null}
        {state === 'invalid' ? <>
          <Text style={s.title}>Lenken virker ikke</Text>
          <Text style={s.sub}>Lenken er ugyldig eller utløpt. Be om en ny fra sjåførinnloggingen.</Text>
          <Button label="Be om ny lenke" onPress={() => router.replace('/forgot-password')} />
        </> : null}
        {state === 'form' ? <>
          <Text style={s.eyebrow}>KJAPP DRIVER · KONTO</Text>
          <Text style={s.title}>Velg nytt passord</Text>
          <Text style={s.sub}>Det nye passordet gjelder straks. Andre aktive økter blir ugyldige.</Text>
          <View style={s.field}><Icon name="lock" size={18} color={colors.textMuted} /><TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Nytt passord" placeholderTextColor={colors.textMuted} autoComplete="new-password" style={s.input} /></View>
          <View style={s.field}><Icon name="lock" size={18} color={colors.textMuted} /><TextInput value={again} onChangeText={setAgain} secureTextEntry placeholder="Gjenta passord" placeholderTextColor={colors.textMuted} autoComplete="new-password" style={s.input} /></View>
          {error ? <Text style={s.error}>{error}</Text> : null}
          <Button label="Lagre nytt passord" onPress={submit} loading={busy} style={{ marginTop: 14 }} />
        </> : null}
        {state === 'done' ? <>
          <Text style={s.title}>Passordet er endret</Text>
          <Text style={s.sub}>Du kan nå logge inn i KJAPP Driver med det nye passordet.</Text>
          <Button label="Logg inn som sjåfør" onPress={() => router.replace('/driver-login')} />
        </> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.driverBg, paddingHorizontal: 24 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line },
  content: { flex: 1, justifyContent: 'center', gap: 12, paddingBottom: 80 },
  eyebrow: { color: c.online, fontFamily: font.bold, fontSize: 10, letterSpacing: 1.8 },
  title: { color: c.text, fontFamily: font.display, fontSize: 30 },
  sub: { color: c.textMuted, fontSize: 14, lineHeight: 21, marginBottom: 10 },
  field: { height: 56, borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.driverCard, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  input: { flex: 1, height: '100%', color: c.text, fontSize: 16 },
  error: { color: c.danger, fontSize: 13 },
}));
