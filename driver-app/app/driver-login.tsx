import { V10Action, v10 } from '@/src/components/V10UI';
import { AppleSignInButton } from '@/src/components/AppleSignInButton';
import { Text, TextInput } from '@/src/components/Typography';
import React, { useEffect, useRef, useState } from 'react';
import { authApi } from '@/src/lib/api';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, useColorTheme, themedStyles } from '@/src/theme';
import { Icon } from '@/src/components/Icon';
import { apiError } from '@/src/lib/format';

export default function DriverLogin() {
  useColorTheme();
  const { login, loginWithOtp, logout, signInWithGoogle, signInWithApple } = useAuth();
  const [mode, setMode] = useState<'sms' | 'password'>('sms');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  const sendCode = async () => {
    if (busy.current || cooldown > 0) return;
    if (phone.replace(/\D/g, '').length < 8) { setError('Skriv inn mobilnummeret ditt.'); return; }
    busy.current = true; setError(''); setLoading(true);
    try {
      const res = await authApi.otpStart(phone.trim());
      setSentTo(res.sent_to); setCode(''); setCooldown(30);
    } catch (e: any) {
      if (e?.response?.status === 503) { setMode('password'); setIdentifier(phone.trim()); }
      setError(apiError(e));
    } finally { busy.current = false; setLoading(false); }
  };
  const verifyCode = async (value = code) => {
    if (busy.current) return;
    if (value.length < 6) { setError('Skriv inn den 6-sifrede koden.'); return; }
    busy.current = true; setError(''); setLoading(true);
    try { await finishLogin(await loginWithOtp(phone.trim(), value)); }
    catch (e) { setError(apiError(e)); setCode(''); }
    finally { busy.current = false; setLoading(false); }
  };
  const switchMode = (next: 'sms' | 'password') => { setMode(next); setError(''); setSentTo(''); setCode(''); };
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
    } catch (e) { setError(apiError(e)); }
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
      <Text style={s.subtitle}>{mode === 'sms'
        ? (sentTo ? `Vi har sendt en kode på SMS til ${sentTo}.` : 'Bruk mobilnummeret registrert hos løyvehaveren din. Du får en engangskode på SMS.')
        : 'Bruk e-post eller telefonnummeret registrert hos løyvehaveren din.'}</Text>
      {mode === 'sms' ? <>
        <View style={s.fields}>
          {sentTo ? (
            <View style={s.field}><TextInput accessibilityLabel="SMS-kode" testID="driver-login-otp-code" placeholder="6-sifret kode" keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="sms-otp" maxLength={6} autoFocus value={code}
              onChangeText={(v) => { const digits = v.replace(/\D/g, ''); setCode(digits); if (digits.length === 6) void verifyCode(digits); }}
              editable={!loading} placeholderTextColor={colors.textMuted} style={[s.input, s.codeInput]} /></View>
          ) : (
            <View style={s.field}><Text style={s.prefix}>+47</Text><TextInput accessibilityLabel="Mobilnummer" testID="driver-login-otp-phone" placeholder="Mobilnummer" keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel" value={phone} onChangeText={setPhone}
              editable={!loading} placeholderTextColor={colors.textMuted} style={s.input} onSubmitEditing={() => void sendCode()} returnKeyType="send" /></View>
          )}
        </View>
        {error ? <Text accessibilityRole="alert" style={s.error} testID="driver-login-error">{error}</Text> : null}
        <View style={{ marginTop: 12 }}>
          {sentTo
            ? <V10Action label="Logg inn" height={58} busy={loading} onPress={() => void verifyCode()} testID="driver-login-otp-verify" />
            : <V10Action label="Send kode" height={58} busy={loading} onPress={() => void sendCode()} testID="driver-login-otp-send" />}
        </View>
        {sentTo ? (
          <View style={s.linkRow}>
            <Pressable accessibilityRole="button" disabled={loading} onPress={() => { setSentTo(''); setCode(''); setError(''); }} style={s.forgot}><Text style={s.forgotText}>Endre nummer</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={loading || cooldown > 0} onPress={() => void sendCode()} style={s.forgot} testID="driver-login-otp-resend"><Text style={s.forgotText}>{cooldown > 0 ? `Send ny kode (${cooldown})` : 'Send ny kode'}</Text></Pressable>
          </View>
        ) : null}
        <Pressable accessibilityRole="button" disabled={loading} onPress={() => switchMode('password')} style={s.forgot} testID="driver-login-use-password"><Text style={s.forgotText}>Logg inn med passord i stedet</Text></Pressable>
      </> : <>
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
      <Pressable accessibilityRole="button" disabled={loading} onPress={() => switchMode('sms')} style={s.forgot} testID="driver-login-use-sms"><Text style={s.forgotText}>Logg inn med SMS-kode</Text></Pressable>
      </>}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 24 }}><View style={{ flex: 1, height: 1, backgroundColor: colors.line }} /><Text style={v10.caption}>eller</Text><View style={{ flex: 1, height: 1, backgroundColor: colors.line }} /></View>
      <View style={{ gap: 8 }}>
        <AppleSignInButton loading={provider === 'apple'} disabled={loading && provider !== 'apple'} onPress={() => socialSignIn('apple')} />
        <V10Action kind="soft" icon="google" label="Fortsett med Google" busy={provider === 'google'} disabled={loading && provider !== 'google'} onPress={() => void socialSignIn('google')} testID="driver-login-google" />
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
  prefix: { fontFamily: font.medium, fontSize: 18, lineHeight: 26, color: colors.textSecondary, marginRight: 10 },
  codeInput: { letterSpacing: 8, fontFamily: font.semibold },
  linkRow: { flexDirection: 'row', justifyContent: 'space-between' },
  forgot: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  forgotText: { fontFamily: font.medium, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20, marginTop: 12 },
  footer: { marginTop: 'auto', paddingTop: 32 }, note: { fontSize: 12, lineHeight: 16, color: colors.textMuted, textAlign: 'center' },
}));
