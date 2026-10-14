import { V10Action, V10Header, v10 } from '@/src/components/V10UI';
import { Icon } from '@/src/components/Icon';
import { Text, TextInput } from '@/src/components/Typography';
import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, useColorTheme } from '@/src/theme';
import { AppleSignInButton } from '@/src/components/AppleSignInButton';
import { apiError } from '@/src/lib/format';

const isCustomerRole = (role?: string) => !role || role === 'user' || role === 'customer';

export default function Login() {
  useColorTheme();
  const { login, logout, signInWithGoogle, signInWithApple } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [error, setError] = useState('');
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
    router.replace('/(app)/home');
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

  const googleSignIn = async () => {
    if (operation.current) return;
    operation.current = true; setError('');
    setGLoading(true);
    try {
      const u = await signInWithGoogle();
      if (u) await finishLogin(u);
    } catch (e) {
      setError(apiError(e));
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
      setError(apiError(e));
    } finally {
      operation.current = false; setAppleLoading(false);
    }
  };

  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: Math.max(70, insets.top + 22), paddingBottom: Math.max(40, insets.bottom + 6) }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <V10Header onBack={() => router.back()} /><Text style={v10.title}>Logg inn</Text><Text style={[v10.secondary, { marginTop: 6 }]}>Bruk e-post og passord, eller fortsett med Apple eller Google.</Text>
      <View style={{ marginTop: 28, gap: 8 }}><View style={{ minHeight: 56, borderRadius: 16, backgroundColor: colors.cardSubtle, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 }}><TextInput testID="login-email" accessibilityLabel="E-post" placeholder="deg@epost.no" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail} editable={!busy} placeholderTextColor={colors.textMuted} style={{ flex: 1, minHeight: 56, paddingVertical: 0, color: colors.text, fontSize: 16, fontFamily: font.body }} /></View>
        <View style={{ minHeight: 56, borderRadius: 16, backgroundColor: colors.cardSubtle, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, gap: 12 }}><TextInput testID="login-password" accessibilityLabel="Passord" placeholder="Passord" secureTextEntry={!show} value={password} onChangeText={setPassword} onSubmitEditing={() => void submit()} returnKeyType="go" autoComplete="current-password" editable={!busy} placeholderTextColor={colors.textMuted} style={{ flex: 1, minHeight: 56, paddingVertical: 0, color: colors.text, fontSize: 16, fontFamily: font.body }} /><Pressable onPress={() => setShow(value => !value)} disabled={busy} testID="login-toggle-password" accessibilityRole="button" accessibilityLabel={show ? 'Skjul passord' : 'Vis passord'} style={{ width: 48, height: 56, alignItems: 'center', justifyContent: 'center' }}><Icon name={show ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} /></Pressable></View>
      </View>{error ? <Text testID="login-error" accessibilityRole="alert" style={[v10.secondary, { color: colors.danger, marginTop: 12 }]}>{error}</Text> : null}
      <View style={{ marginTop: 12 }}><V10Action label="Logg inn" onPress={() => void submit()} busy={loading} disabled={busy && !loading} testID="login-submit" /></View><V10Action kind="ghost" label="Glemt passord?" onPress={() => router.push('/forgot-password')} disabled={busy} testID="login-forgot-password" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 24 }}><View style={{ flex: 1, height: 1, backgroundColor: colors.line }} /><Text style={v10.caption}>eller</Text><View style={{ flex: 1, height: 1, backgroundColor: colors.line }} /></View>
      <View style={{ gap: 8 }}><AppleSignInButton loading={appleLoading} disabled={busy && !appleLoading} onPress={appleSignIn} /><V10Action kind="soft" icon="google" label="Fortsett med Google" busy={gLoading} disabled={busy && !gLoading} onPress={() => void googleSignIn()} testID="login-google" /></View>
      <View style={{ marginTop: 8 }}><V10Action kind="ghost" small label="Ny hos SNAR? Opprett konto" onPress={() => router.push('/register')} disabled={busy} testID="login-to-register" /></View>
      <Text style={[v10.caption, { marginTop: 'auto', paddingTop: 24, textAlign: 'center', lineHeight: 18 }]}>Ved å fortsette godtar du SNARs <Text style={{ textDecorationLine: 'underline', color: colors.text }} onPress={() => openLegal('https://kjappapp.no/vilkar')}>vilkår</Text> og <Text style={{ textDecorationLine: 'underline', color: colors.text }} onPress={() => openLegal('https://kjappapp.no/personvern')}>personvernerklæring</Text>.</Text>
    </ScrollView>
  </KeyboardAvoidingView>;
}
