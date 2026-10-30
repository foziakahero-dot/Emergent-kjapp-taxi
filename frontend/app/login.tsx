import { V10Action, V10Header, v10 } from '@/src/components/V10UI';
import { Icon } from '@/src/components/Icon';
import { Text, TextInput } from '@/src/components/Typography';
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, useColorTheme } from '@/src/theme';
import { AppleSignInButton } from '@/src/components/AppleSignInButton';
import { apiError } from '@/src/lib/format';
import { authApi } from '@/src/lib/api';
import { SnarWordmark } from '@/src/components/SnarWordmark';
import { V10Entrance } from '@/src/components/V10Entrance';
import { PhoneSignupFields } from '@/src/components/PhoneSignupFields';
import { accountLinkInstructions, requiresAccountLink, socialProvider, type SocialProvider } from '@/src/lib/socialAccountRecovery';

const isCustomerRole = (role?: string) => !role || role === 'user' || role === 'customer';

export default function Login() {
  const theme = useColorTheme();
  const { login, loginWithOtp, logout, signInWithGoogle, signInWithApple } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ linkProvider?: string }>();
  const [linkProvider, setLinkProvider] = useState<SocialProvider | null>(() => socialProvider(params.linkProvider));
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'phone' | 'password'>(() => socialProvider(params.linkProvider) ? 'password' : 'phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const [otpEnabled, setOtpEnabled] = useState<boolean | null>(null);
  const [otpSignupEnabled, setOtpSignupEnabled] = useState(false);
  const [phoneSignup, setPhoneSignup] = useState(false);
  const [fullName, setFullName] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [legalVersion, setLegalVersion] = useState('');
  const [nativeConfig, setNativeConfig] = useState<any>(null);
  useEffect(() => {
    let active = true;
    authApi.otpConfig().then(config => { if (active) {
      setOtpEnabled(config.enabled === true); setOtpSignupEnabled(config.signup_enabled === true);
      setLegalVersion(config.legal_version || '');
    } })
      .catch(() => { if (active) setOtpEnabled(false); });
    authApi.nativeConfig().then(config => { if (active) setNativeConfig(config); }).catch(() => {});
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!challenge) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [challenge]);
  const operation = useRef(false);
  const busy = loading || gLoading || appleLoading;

  const finishLogin = async (u: any) => {
    if (!u?.id && !u?.email) throw new Error('Innloggingen ble ikke bekreftet.');
    if (!isCustomerRole(u?.role)) {
      await logout();
      setError(
        u?.role === 'driver'
          ? 'Dette er en sjåførkonto. Bruk SNAR Driver.'
          : 'Denne kontotypen kan ikke brukes i kundeappen.',
      );
      return;
    }
    if (u?.legal_accepted !== true) {
      router.replace('/legal-consent');
      return;
    }
    router.replace(linkProvider ? '/customer-account' : '/(app)/home');
  };

  const submit = async () => {
    if (operation.current) return;
    if (!email.trim() || !password) { setError('Fyll inn e-post og passord.'); return; }
    operation.current = true; setError('');
    setLoading(true);
    try {
      const res = await login(email.trim(), password);
      if (res?.twofa_required) {
        setError('Kontoen krever tofaktor — logg inn via web-portalen.');
        return;
      }
      await finishLogin(res);
    } catch (e) {
      setError(apiError(e));
    } finally {
      operation.current = false; setLoading(false);
    }
  };

  const openLegal = (url: string) => {
    void Linking.openURL(url).catch(() => setError('Kunne ikke åpne dokumentet. Prøv igjen.'));
  };

  const submitPhone = async (resend = false) => {
    if (operation.current || (resend && Date.now() < resendAt)) return;
    if (phoneSignup && (!otpSignupEnabled || !fullName.trim() || !email.trim() || !acceptedTerms || !legalVersion)) {
      setError('Fyll inn navn og e-post, og godta vilkår og personvern.'); return;
    }
    operation.current = true; setError(''); setLoading(true);
    try {
      if (!challenge || resend) {
        const result = await authApi.otpStart(phone.trim(), phoneSignup ? {
          fullName: fullName.trim(), email: email.trim(), accepted_terms: acceptedTerms, legal_version: legalVersion,
        } : undefined);
        if (!result?.challenge_id) throw new Error('SMS-forespørselen ble ikke bekreftet.');
        setChallenge(result.challenge_id); setCode(''); setResendAt(Date.now() + 60000); setClock(Date.now());
      } else {
        const result = await loginWithOtp(phone.trim(), code, challenge);
        if (result?.twofa_required) { setError('Kontoen krever tofaktor. Logg inn via web-portalen.'); return; }
        await finishLogin(result);
      }
    } catch (e) { setError(apiError(e)); }
    finally { operation.current = false; setLoading(false); }
  };
  const googleReady = nativeConfig?.google_enabled === true && (Platform.OS !== 'ios' || !!nativeConfig?.google_ios_client_id);

  const googleSignIn = async () => {
    if (operation.current) return;
    operation.current = true; setError('');
    setGLoading(true);
    try {
      const u = await signInWithGoogle();
      if (u) await finishLogin(u);
    } catch (e) {
      if (requiresAccountLink(e)) { setLinkProvider('google'); setMode('password'); setError(''); }
      else setError(apiError(e));
    } finally {
      operation.current = false; setGLoading(false);
    }
  };

  const appleSignIn = async () => {
    if (operation.current) return;
    operation.current = true; setError('');
    setAppleLoading(true);
    try {
      const u = await signInWithApple();
      if (u) await finishLogin(u);
    } catch (e) {
      if (requiresAccountLink(e)) { setLinkProvider('apple'); setMode('password'); setError(''); }
      else setError(apiError(e));
    } finally {
      operation.current = false; setAppleLoading(false);
    }
  };

  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.effective === 'dark' ? colors.bg : '#FFFFFF' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: Math.max(70, insets.top + 22), paddingBottom: Math.max(40, insets.bottom + 6) }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={{ alignItems: 'center' }}><SnarWordmark /></View>
      <V10Entrance style={{ marginTop: 28, alignItems: 'center' }}><Text style={[v10.title, { textAlign: 'center', fontFamily: font.bold, fontSize: 34, lineHeight: 39 }]}>{challenge && mode === 'phone' ? 'Skriv inn koden' : 'Hvor skal\ndu i dag?'}</Text><Text style={[v10.secondary, { marginTop: 10, textAlign: 'center', maxWidth: 290 }]}>{mode === 'password' ? 'Logg inn med e-post og passord.' : challenge ? phoneSignup ? 'Bekreft mobilnummeret med koden fra SMS. Kontoen opprettes etter bekreftelsen.' : 'Hvis nummeret er knyttet til en kundekonto, får du en engangskode på SMS.' : phoneSignup ? 'Opprett kundekonto med en bekreftet SMS-kode.' : 'Logg inn og bestill en trygg tur på få sekunder.'}</Text></V10Entrance>
      {linkProvider ? <Text testID="login-link-instructions" accessibilityRole="alert" style={[v10.secondary, { marginTop: 16 }]}>{accountLinkInstructions(linkProvider)}</Text> : null}
      {mode === 'phone' ? <View style={{ marginTop: 28, gap: 12 }}>
        {!challenge ? <View style={{ minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.cardSubtle }}><Text style={v10.body}>+47</Text><TextInput testID="login-phone" accessibilityLabel="Norsk mobilnummer" value={phone} onChangeText={setPhone} editable={!busy} placeholder="Mobilnummer" keyboardType="phone-pad" autoComplete="tel-national" textContentType="telephoneNumber" returnKeyType="go" onSubmitEditing={() => void submitPhone()} placeholderTextColor={colors.textMuted} style={{ flex: 1, minHeight: 60, color: colors.text, fontFamily: font.body, fontSize: 18 }} /></View>
        : <TextInput testID="login-otp" accessibilityLabel="Engangskode fra SMS" value={code} onChangeText={value => setCode(value.replace(/\D/g, '').slice(0, 10))} editable={!busy} placeholder="Engangskode" keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" autoFocus maxLength={10} returnKeyType="go" onSubmitEditing={() => void submitPhone()} style={{ minHeight: 60, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.lineStrong, color: colors.text, fontFamily: font.medium, fontSize: 24, letterSpacing: 6 }} />}
        {phoneSignup && !challenge ? <PhoneSignupFields name={fullName} email={email} accepted={acceptedTerms} disabled={busy} onName={setFullName} onEmail={setEmail} onAccepted={setAcceptedTerms} /> : null}
        {otpSignupEnabled && !challenge ? <V10Action kind="ghost" small testID="login-phone-signup-toggle" label={phoneSignup ? 'Har du konto? Logg inn med mobilnummer' : 'Opprett konto med mobilnummer'} disabled={busy} onPress={() => { setPhoneSignup(value => !value); setAcceptedTerms(false); setError(''); }} /> : null}
        {otpEnabled === false ? <Text accessibilityRole="alert" style={v10.secondary}>SMS-innlogging er ikke tilgjengelig akkurat nå. Bruk e-post{googleReady ? ' eller Google' : ''} nedenfor.</Text> : null}
        <V10Action testID="login-phone-submit" label={challenge ? 'Bekreft kode' : 'Fortsett'} height={58} busy={loading} disabled={busy || otpEnabled !== true || (phoneSignup && (!acceptedTerms || fullName.trim().length < 2 || !email.includes('@') || !legalVersion)) || (challenge ? code.length < 4 : phone.replace(/\D/g, '').length < 8)} onPress={() => void submitPhone()} />
        {challenge ? <><V10Action kind="ghost" label="Endre mobilnummer" disabled={busy} onPress={() => { setChallenge(''); setCode(''); setError(''); }} /><V10Action kind="ghost" label={clock < resendAt ? `Send ny kode om ${Math.ceil((resendAt - clock) / 1000)} s` : 'Send ny kode'} disabled={busy || clock < resendAt} onPress={() => void submitPhone(true)} /></> : null}
      </View> : <><View style={{ marginTop: 28, gap: 8 }}><View style={{ minHeight: 56, borderRadius: 16, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.cardSubtle, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 }}><TextInput testID="login-email" accessibilityLabel="E-post" placeholder="deg@epost.no" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail} editable={!busy} placeholderTextColor={colors.textMuted} style={{ flex: 1, minHeight: 56, paddingVertical: 0, color: colors.text, fontSize: 16, fontFamily: font.body }} /></View>
        <View style={{ minHeight: 56, borderRadius: 16, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.cardSubtle, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, gap: 12 }}><TextInput testID="login-password" accessibilityLabel="Passord" placeholder="Passord" secureTextEntry={!show} value={password} onChangeText={setPassword} onSubmitEditing={() => void submit()} returnKeyType="go" autoComplete="current-password" editable={!busy} placeholderTextColor={colors.textMuted} style={{ flex: 1, minHeight: 56, paddingVertical: 0, color: colors.text, fontSize: 16, fontFamily: font.body }} /><Pressable onPress={() => setShow(value => !value)} disabled={busy} testID="login-toggle-password" accessibilityRole="button" accessibilityLabel={show ? 'Skjul passord' : 'Vis passord'} style={{ width: 48, height: 56, alignItems: 'center', justifyContent: 'center' }}><Icon name={show ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} /></Pressable></View>
      </View>
      <View style={{ marginTop: 12 }}><V10Action label="Logg inn" onPress={() => void submit()} busy={loading} disabled={busy && !loading} testID="login-submit" /></View><V10Action kind="ghost" label="Glemt passord?" onPress={() => router.push('/forgot-password')} disabled={busy} testID="login-forgot-password" />
      </>}
      {error ? <Text testID="login-error" accessibilityRole="alert" style={[v10.secondary, { color: colors.danger, marginTop: 12 }]}>{error}</Text> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 24 }}><View style={{ flex: 1, height: 1, backgroundColor: colors.line }} /><Text style={v10.caption}>eller</Text><View style={{ flex: 1, height: 1, backgroundColor: colors.line }} /></View>
      <View style={{ gap: 8 }}>{Platform.OS === 'ios' && nativeConfig?.apple_enabled ? <AppleSignInButton loading={appleLoading} disabled={busy && !appleLoading} onPress={appleSignIn} /> : null}{googleReady ? <V10Action kind="soft" icon="google" label="Fortsett med Google" busy={gLoading} disabled={busy && !gLoading} onPress={() => void googleSignIn()} testID="login-google" /> : null}<V10Action kind="soft" label={mode === 'phone' ? 'Logg inn med e-post' : 'Logg inn med mobilnummer'} disabled={busy} onPress={() => { setMode(mode === 'phone' ? 'password' : 'phone'); setError(''); }} testID="login-switch-method" /></View>
      <View style={{ marginTop: 8 }}><V10Action kind="ghost" small label="Ny hos SNAR? Opprett konto" onPress={() => router.push('/register')} disabled={busy} testID="login-to-register" /></View>
      <Text style={[v10.caption, { marginTop: 'auto', paddingTop: 24, textAlign: 'center', lineHeight: 18 }]}>Ved å fortsette godtar du SNARs <Text style={{ textDecorationLine: 'underline', color: colors.text }} onPress={() => openLegal('https://kjappapp.no/vilkar')}>vilkår</Text> og <Text style={{ textDecorationLine: 'underline', color: colors.text }} onPress={() => openLegal('https://kjappapp.no/personvern')}>personvernerklæring</Text>.</Text>
    </ScrollView>
  </KeyboardAvoidingView>;
}
