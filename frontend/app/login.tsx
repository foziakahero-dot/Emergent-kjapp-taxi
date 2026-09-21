import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, makeStyles } from '@/src/theme';
import { Button } from '@/src/components/ui';
import { Icon } from '@/src/components/Icon';
import { apiError } from '@/src/lib/format';

const isCustomerRole = (role?: string) => !role || role === 'user' || role === 'customer';

export default function Login() {
  const { login, logout, signInWithGoogle } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [error, setError] = useState('');

  const finishLogin = async (u: any) => {
    if (!isCustomerRole(u?.role)) {
      await logout();
      setError(u?.role === 'driver'
        ? 'Dette er en sjåførkonto. Bruk KJAPP Driver.'
        : 'Denne kontotypen kan ikke brukes i kundeappen.');
      return;
    }
    router.replace('/(app)/home');
  };

  const submit = async () => {
    setError('');
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
      setLoading(false);
    }
  };

  const googleSignIn = async () => {
    setError('');
    setGLoading(true);
    try {
      const u = await signInWithGoogle();
      if (u) await finishLogin(u);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setGLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[s.wrap, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} style={s.back} testID="login-back" accessibilityRole="button" accessibilityLabel="Tilbake">
          <Icon name="arrow-left" size={20} color={colors.text} />
        </Pressable>

        <View style={s.brandBlock}>
          <Text style={s.eyebrow}>KJAPP · PASSASJER</Text>
          <Text style={s.brand}>KJAPP</Text>
          <View style={s.brandLine} />
        </View>
        <Text style={s.title}>Velkommen tilbake</Text>
        <Text style={s.sub}>Logg inn for å bestille, følge og betale turen din.</Text>

        <View style={s.form}>
          <View style={s.field}>
            <Icon name="mail" size={18} color={colors.textMuted} />
            <TextInput
              testID="login-email"
              placeholder="E-post"
              placeholderTextColor={colors.textMuted}
              style={s.input}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              autoComplete="email"
            />
          </View>

          <View style={s.field}>
            <Icon name="lock" size={18} color={colors.textMuted} />
            <TextInput
              testID="login-password"
              placeholder="Passord"
              placeholderTextColor={colors.textMuted}
              style={s.input}
              secureTextEntry={!show}
              value={password}
              onChangeText={setPassword}
              autoComplete="current-password"
            />
            <Pressable onPress={() => setShow((v) => !v)} testID="login-toggle-password" style={s.fieldAction} accessibilityRole="button" accessibilityLabel={show ? 'Skjul passord' : 'Vis passord'}>
              <Icon name={show ? 'eye-off' : 'eye'} size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          {error ? <Text style={s.error} testID="login-error">{error}</Text> : null}

          <Button label="Logg inn" onPress={submit} loading={loading} testID="login-submit" style={{ marginTop: 2 }} />
        </View>

        <View style={s.dividerRow}>
          <View style={s.divLine} />
          <Text style={s.divText}>eller</Text>
          <View style={s.divLine} />
        </View>

        <Pressable style={s.googleBtn} onPress={googleSignIn} disabled={gLoading} testID="login-google" accessibilityRole="button" accessibilityLabel="Fortsett med Google">
          {gLoading ? <ActivityIndicator color="#1F1F1F" /> : <><GoogleG size={20} /><Text style={s.googleText}>Fortsett med Google</Text></>}
        </Pressable>

        <View style={s.trustRow}>
          <View style={s.trustItem}><Icon name="shield" size={14} color={colors.accent} /><Text style={s.trustText}>Trygg konto</Text></View>
          <View style={s.trustDivider} />
          <View style={s.trustItem}><Icon name="card" size={14} color={colors.accent} /><Text style={s.trustText}>Sikker betaling</Text></View>
        </View>

        <Pressable onPress={() => router.push('/register')} style={s.footer} testID="login-to-register">
          <Text style={s.footerText}>Ny hos KJAPP? <Text style={s.footerLink}>Opprett konto</Text></Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function GoogleG({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <Path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <Path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <Path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </Svg>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { paddingHorizontal: 24, flexGrow: 1, backgroundColor: c.bg },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line, marginBottom: 28 },
  brandBlock: { alignSelf: 'flex-start' },
  eyebrow: { color: c.accent, fontFamily: font.bold, fontSize: 10, letterSpacing: 1.8 },
  brand: { fontFamily: font.bold, fontSize: 34, color: c.text, letterSpacing: 0.5, marginTop: 5 },
  brandLine: { width: 42, height: 3, borderRadius: 2, backgroundColor: c.accent, marginTop: 8 },
  title: { fontFamily: font.display, fontSize: 28, color: c.text, marginTop: 30 },
  sub: { color: c.textMuted, fontFamily: font.body, fontSize: 14, lineHeight: 20, marginTop: 7, marginBottom: 24 },
  form: { gap: 12 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 14, paddingLeft: 16, paddingRight: 6, height: 56 },
  input: { flex: 1, color: c.text, fontFamily: font.body, fontSize: 16, height: '100%' },
  fieldAction: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  error: { color: c.danger, fontSize: 13, lineHeight: 18 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 18 },
  divLine: { flex: 1, height: 1, backgroundColor: c.line },
  divText: { color: c.textMuted, fontSize: 12 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, height: 54, borderRadius: 14, backgroundColor: '#FFFFFF' },
  googleText: { color: '#1F1F1F', fontFamily: font.semibold, fontSize: 15 },
  trustRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, gap: 12 },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trustText: { color: c.textMuted, fontSize: 11 },
  trustDivider: { width: 1, height: 16, backgroundColor: c.line },
  footer: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  footerText: { color: c.textSecondary, fontSize: 14 },
  footerLink: { color: c.accent, fontFamily: font.semibold },
}));