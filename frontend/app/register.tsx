import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TextInput } from '@/src/components/Typography';
import { V10Action, V10Header, v10 } from '@/src/components/V10UI';
import { Icon } from '@/src/components/Icon';
import { AppleSignInButton } from '@/src/components/AppleSignInButton';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, useColorTheme } from '@/src/theme';
import { apiError } from '@/src/lib/format';

/** Registration uses the source's sign-in primitives; it is not a prototype SMS flow. */
export default function Register() {
  useColorTheme();
  const { register, signInWithGoogle, signInWithApple } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [pending, setPending] = useState<'password' | 'google' | 'apple' | null>(null);
  const [error, setError] = useState('');
  const operation = useRef(false);
  const busy = pending !== null;
  const finish = (user: any) => {
    if (!user?.id || !['user', 'customer'].includes(user.role)) throw new Error('Kundekontoen kunne ikke bekreftes.');
    router.replace(user.legal_accepted === true ? '/profile-setup' : '/legal-consent');
  };
  const submit = async () => {
    if (operation.current) return;
    setError('');
    if (!fullName.trim() || !email.trim() || password.length < 8) { setError('Fyll inn navn, e-post og passord (minst 8 tegn).'); return; }
    if (!acceptedTerms) { setError('Du må godta vilkår og personvern før kontoen opprettes.'); return; }
    operation.current = true; setPending('password');
    try { finish(await register({ fullName: fullName.trim(), email: email.trim(), phone: phone.trim(), password, accepted_terms: true, legal_version: '2026-09' })); }
    catch (e) { setError(apiError(e)); }
    finally { operation.current = false; setPending(null); }
  };
  const social = async (provider: 'google' | 'apple') => {
    if (operation.current) return;
    operation.current = true; setPending(provider); setError('');
    try { const user = await (provider === 'google' ? signInWithGoogle() : signInWithApple()); if (user) finish(user); }
    catch (e) { setError(apiError(e)); }
    finally { operation.current = false; setPending(null); }
  };
  const openLegal = (url: string) => { void Linking.openURL(url).catch(() => setError('Kunne ikke åpne dokumentet. Prøv igjen.')); };
  const inputStyle = { flex: 1, minHeight: 56, paddingVertical: 0, fontSize: 16, fontFamily: font.body, color: colors.text };
  const fieldStyle = { minHeight: 56, borderRadius: 16, backgroundColor: colors.cardSubtle, paddingHorizontal: 16, flexDirection: 'row' as const, alignItems: 'center' as const };
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: Math.max(70, insets.top + 22), paddingBottom: Math.max(40, insets.bottom + 6) }}>
      <V10Header onBack={() => router.back()} /><Text style={v10.title}>Opprett konto</Text><Text style={[v10.secondary, { marginTop: 6 }]}>Reis enkelt med SNAR.</Text>
      <View style={{ marginTop: 28, gap: 8 }}>
        <View style={fieldStyle}><TextInput testID="register-name" accessibilityLabel="Fullt navn" placeholder="Fullt navn" autoComplete="name" value={fullName} onChangeText={setFullName} editable={!busy} placeholderTextColor={colors.textMuted} style={inputStyle} /></View>
        <View style={fieldStyle}><TextInput testID="register-email" accessibilityLabel="E-post" placeholder="deg@epost.no" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail} editable={!busy} placeholderTextColor={colors.textMuted} style={inputStyle} /></View>
        <View style={fieldStyle}><TextInput testID="register-phone" accessibilityLabel="Telefon" placeholder="Telefon (valgfritt)" keyboardType="phone-pad" autoComplete="tel" value={phone} onChangeText={setPhone} editable={!busy} placeholderTextColor={colors.textMuted} style={inputStyle} /></View>
        <View style={[fieldStyle, { paddingRight: 0 }]}><TextInput testID="register-password" accessibilityLabel="Passord" placeholder="Passord, minst 8 tegn" autoComplete="new-password" secureTextEntry={!show} value={password} onChangeText={setPassword} editable={!busy} placeholderTextColor={colors.textMuted} style={inputStyle} returnKeyType="go" onSubmitEditing={() => void submit()} /><Pressable testID="register-toggle-password" accessibilityRole="button" accessibilityLabel={show ? 'Skjul passord' : 'Vis passord'} disabled={busy} onPress={() => setShow(v => !v)} style={{ width: 48, height: 56, alignItems: 'center', justifyContent: 'center' }}><Icon name={show ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} /></Pressable></View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 18 }}>
        <Pressable testID="register-legal-consent" accessibilityRole="checkbox" accessibilityLabel="Godta vilkår og personvern" accessibilityState={{ checked: acceptedTerms, disabled: busy }} disabled={busy} onPress={() => setAcceptedTerms(v => !v)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -10, marginTop: -10 }}><View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 1, borderColor: acceptedTerms ? colors.accent : colors.lineStrong, backgroundColor: acceptedTerms ? colors.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.accentOn }}>{acceptedTerms ? '✓' : ''}</Text></View></Pressable>
        <Text style={[v10.caption, { flex: 1, lineHeight: 18 }]}>Jeg godtar SNARs <Text testID="register-terms-link" style={{ color: colors.text, textDecorationLine: 'underline' }} onPress={() => openLegal('https://kjappapp.no/vilkar')}>vilkår</Text> og <Text testID="register-privacy-link" style={{ color: colors.text, textDecorationLine: 'underline' }} onPress={() => openLegal('https://kjappapp.no/personvern')}>personvernerklæring</Text>.</Text>
      </View>
      {error ? <Text testID="register-error" accessibilityRole="alert" style={[v10.secondary, { color: colors.danger, marginTop: 12 }]}>{error}</Text> : null}
      <View style={{ marginTop: 12 }}><V10Action testID="register-submit" label="Opprett konto" busy={pending === 'password'} disabled={busy && pending !== 'password'} onPress={() => void submit()} /></View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 24 }}><View style={{ flex: 1, height: 1, backgroundColor: colors.line }} /><Text style={v10.caption}>eller</Text><View style={{ flex: 1, height: 1, backgroundColor: colors.line }} /></View>
      <View style={{ gap: 8 }}><AppleSignInButton loading={pending === 'apple'} disabled={busy && pending !== 'apple'} onPress={() => social('apple')} /><V10Action kind="soft" icon="google" label="Fortsett med Google" testID="register-google" busy={pending === 'google'} disabled={busy && pending !== 'google'} onPress={() => void social('google')} /></View>
      <View style={{ marginTop: 'auto', paddingTop: 24 }}><V10Action kind="ghost" label="Har du konto? Logg inn" testID="register-to-login" disabled={busy} onPress={() => router.replace('/login')} /></View>
    </ScrollView>
  </KeyboardAvoidingView>;
}
