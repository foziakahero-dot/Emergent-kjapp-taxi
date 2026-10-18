import { V10Action, v10 } from '@/src/components/V10UI';
import { AppleSignInButton } from '@/src/components/AppleSignInButton';
import { Text, TextInput } from '@/src/components/Typography';
import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, useColorTheme, themedStyles } from '@/src/theme';
import { Icon } from '@/src/components/Icon';
import { apiError } from '@/src/lib/format';

export default function DriverLogin() {
  useColorTheme();
  const { login, logout, signInWithApple, signInWithGoogle } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const busy = useRef(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [provider, setProvider] = useState<'google' | 'apple' | null>(null);
  const submit = async () => {
    if (busy.current) return;
    if (!identifier.trim() || !password) { setError('Skriv inn e-post eller telefonnummer og passord.'); return; }
    busy.current = true; setError(''); setLoading(true);
    try {
      const res = await login(identifier.trim(), password);
      await finishLogin(res);
    } catch (e: any) {
      setError(e?.response?.status === 401
        ? 'E-post, telefonnummer eller passord stemmer ikke med en aktiv sjåførkonto. Bruk sjåførkontoen for dette miljøet.'
        : apiError(e));
    }
    finally { busy.current = false; setLoading(false); }
  };
  const finishLogin = async (res: any) => {
      if (!res) return;
      if (res?.twofa_required) { setError('Kontoen krever tofaktor — logg inn via web-portalen.'); return; }
      if (res?.role !== 'driver') { await logout(); setError('Denne kontoen er ikke en SNAR-sjåførkonto.'); return; }
      if (res?.approved !== true) {
        await logout(); setError('Sjåførkontoen din venter fortsatt på godkjenning. Du får tilgang når dokumentene og kontoen er godkjent.'); return;
      }
      if (res?.legal_accepted !== true) { router.replace('/driver-legal-consent'); return; }
      const identityStatus = res?.identity_verification_status || 'not_submitted';
      const identityGate = Boolean(res?.identity_recheck_required) || identityStatus !== 'verified';
      router.replace(identityGate ? '/driver-approval' : '/(driver)/home');
  };
  const socialSignIn = async (selected: 'google' | 'apple') => {
    if (busy.current) return;
    busy.current = true; setLoading(true); setProvider(selected); setError('');
    try { await finishLogin(await (selected === 'google' ? signInWithGoogle() : signInWithApple())); }
    catch (e) { setError(apiError(e)); }
    finally { busy.current = false; setLoading(false); setProvider(null); }
  };
  return <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content, { paddingTop: Math.max(110, insets.top + 62), paddingBottom: Math.max(40, insets.bottom + 6) }]}>
      <Text style={s.overline}>SNAR Driver</Text>
      <Text style={s.title}>Logg inn for å kjøre</Text>
      <Text style={s.subtitle}>Bruk e-post eller telefonnummeret registrert hos løyvehaveren din.</Text>
      <View style={s.fields}>
        <View style={s.field}><TextInput accessibilityLabel="E-post eller telefon" testID="driver-login-identifier" placeholder="E-post eller telefon" autoCapitalize="none" autoCorrect={false} returnKeyType="next" value={identifier} onChangeText={setIdentifier} autoComplete="username" editable={!loading} placeholderTextColor={colors.textMuted} style={s.input} /></View>
        <View style={s.field}><TextInput accessibilityLabel="Passord" testID="driver-login-password" placeholder="Passord" secureTextEntry={!show} value={password} onChangeText={setPassword} autoComplete="current-password" editable={!loading} placeholderTextColor={colors.textMuted} style={s.input} onSubmitEditing={() => void submit()} returnKeyType="go" />
          <Pressable accessibilityRole="button" accessibilityLabel={show ? 'Skjul passord' : 'Vis passord'} disabled={loading} onPress={() => setShow(v => !v)} style={s.reveal} testID="driver-login-toggle-password"><Icon name={show ? 'eye-off' : 'eye'} size={20} color={colors.textSecondary} /></Pressable>
        </View>
      </View>
      {error ? <Text accessibilityRole="alert" style={s.error} testID="driver-login-error">{error}</Text> : null}
      <View style={{ marginTop: 12 }}>
        <V10Action label="Logg inn" height={58} busy={loading} onPress={() => void submit()} testID="driver-login-submit" />
      </View>
      <Pressable accessibilityRole="button" disabled={loading} onPress={() => router.push('/forgot-password')} style={s.forgot} testID="driver-login-forgot-password"><Text style={s.forgotText}>Glemt passord?</Text></Pressable>
      {Platform.OS === 'ios' ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 24 }}><View style={{ flex: 1, height: 1, backgroundColor: colors.line }} /><Text style={v10.caption}>eller</Text><View style={{ flex: 1, height: 1, backgroundColor: colors.line }} /></View> : null}
      <View style={{ gap: 8 }}>
        <V10Action label="Fortsett med Google" onPress={() => void socialSignIn('google')} busy={provider === 'google'} disabled={loading} testID="driver-login-google" />
        <AppleSignInButton loading={provider === 'apple'} disabled={loading && provider !== 'apple'} onPress={() => socialSignIn('apple')} />
      </View>
      <View style={s.footer}>
        <Text style={s.note}>Ny sjåfør? Registrer deg via invitasjonen fra løyvehaveren.</Text>
        <Text style={[s.note, { marginTop: 4 }]}>Første innlogging og nye telefoner kan kreve selfie-kontroll.</Text>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}
const s = themedStyles(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg }, content: { flexGrow: 1, paddingHorizontal: 24 },
  overline: { fontFamily: font.semibold, fontSize: 11, lineHeight: 14, letterSpacing: .66, textTransform: 'uppercase', color: colors.textMuted },
  title: { fontFamily: font.semibold, fontSize: 32, lineHeight: 38, letterSpacing: -.96, marginTop: 6, color: colors.text },
  subtitle: { fontSize: 14, lineHeight: 20, letterSpacing: -.154, color: colors.textSecondary, marginTop: 8 },
  fields: { marginTop: 28, gap: 8 },
  field: { flexDirection: 'row', alignItems: 'center', minHeight: 60, borderRadius: 16, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.cardSubtle, paddingHorizontal: 16 },
  input: { flex: 1, fontSize: 18, lineHeight: 26, paddingVertical: 16, color: colors.text },
  reveal: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginRight: -12 },
  forgot: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  forgotText: { fontFamily: font.medium, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20, marginTop: 12 },
  footer: { marginTop: 'auto', paddingTop: 32 }, note: { fontSize: 12, lineHeight: 16, color: colors.textMuted, textAlign: 'center' },
}));
