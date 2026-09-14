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
  const [socialNote, setSocialNote] = useState('');

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
    if (!email.trim() || !password) return;
    setError('');
    setSocialNote('');
    setLoading(true);
    try {
      const res = await login(email.trim(), password);
      if (res?.twofa_required) {
        setError('Kontoen krever tofaktor. Fullfør innlogging via web-portalen.');
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
    setSocialNote('');
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
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[s.wrap, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 26 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => router.back()} style={s.back} testID="login-back">
          <Icon name="chevron-left" size={22} color={colors.textMuted} />
        </Pressable>

        <View style={s.content}>
          <Text style={s.title}>Velkommen tilbake</Text>
          <Text style={s.sub}>Logg inn for å fortsette reisen</Text>

          <View style={s.form}>
            <TextInput
              testID="login-email"
              placeholder="E-post eller telefon"
              placeholderTextColor={colors.textMuted}
              style={s.input}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
            />

            <View style={s.passwordField}>
              <TextInput
                testID="login-password"
                placeholder="Passord"
                placeholderTextColor={colors.textMuted}
                style={s.passwordInput}
                secureTextEntry={!show}
                autoComplete="current-password"
                value={password}
                onChangeText={setPassword}
              />
              <Pressable onPress={() => setShow((v) => !v)} hitSlop={10} testID="login-toggle-password">
                <Icon name={show ? 'eye-off' : 'eye'} size={18} color={colors.textMuted} />
              </Pressable>
            </View>

            <Pressable onPress={() => router.push('/forgot-password')} style={s.forgot} testID="login-forgot-password">
              <Text style={s.forgotText}>Glemt passord?</Text>
            </Pressable>

            {error ? (
              <View style={s.errorBox} testID="login-error">
                <Text style={s.error}>{error}</Text>
              </View>
            ) : null}

            <View style={s.submitWrap}>
              <Pressable
                onPress={submit}
                disabled={loading || !email.trim() || !password}
                testID="login-submit"
                style={({ pressed }) => [
                  s.submit,
                  pressed && { transform: [{ scale: 0.96 }] },
                  (loading || !email.trim() || !password) && { opacity: 0.55 },
                ]}
              >
                {loading ? <ActivityIndicator color={colors.accentOn} /> : <Text style={s.arrow}>→</Text>}
              </Pressable>
            </View>
          </View>

          <View style={s.dividerRow}>
            <View style={s.divLine} />
            <Text style={s.divText}>ELLER FORTSETT MED</Text>
            <View style={s.divLine} />
          </View>

          <View style={s.socialRow}>
            <SocialButton testID="social-apple" onPress={() => setSocialNote('Sign in with Apple er ikke aktivert i mobilappen ennå.')}>
              <Text style={s.socialLetter}>A</Text>
            </SocialButton>
            <SocialButton testID="login-google" onPress={googleSignIn} disabled={gLoading}>
              {gLoading ? <ActivityIndicator color={colors.text} size="small" /> : <GoogleG size={20} />}
            </SocialButton>
            <SocialButton testID="social-phone" onPress={() => setSocialNote('SMS-innlogging er ikke aktivert ennå.')}>
              <Icon name="phone" size={19} color={colors.text} />
            </SocialButton>
          </View>

          {socialNote ? <Text style={s.socialNote}>{socialNote}</Text> : null}
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>Ingen konto? </Text>
          <Pressable onPress={() => router.push('/register')} testID="login-to-register">
            <Text style={s.footerLink}>Opprett en</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => setSocialNote('Sjåfører logger inn i den separate KJAPP Driver-appen.')} style={s.driverHint} testID="login-driver-hint">
          <Text style={s.driverHintText}>Er du sjåfør? <Text style={{ color: colors.accent }}>Bruk KJAPP Driver</Text></Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SocialButton({ children, onPress, disabled, testID }: { children: React.ReactNode; onPress: () => void; disabled?: boolean; testID: string }) {
  const s = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      style={({ pressed }) => [s.socialBtn, pressed && { transform: [{ scale: 0.96 }] }, disabled && { opacity: 0.6 }]}
    >
      {children}
    </Pressable>
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
  screen: { flex: 1, backgroundColor: c.bg },
  wrap: { paddingHorizontal: 24, flexGrow: 1, backgroundColor: c.bg },
  back: { width: 40, height: 40, marginLeft: -6, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 8, paddingTop: 18, flex: 1 },
  title: { fontFamily: font.display, fontSize: 28, color: c.text, letterSpacing: -0.5 },
  sub: { color: c.textMuted, fontSize: 14, marginTop: 8 },
  form: { marginTop: 38 },
  input: { height: 56, borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.cardSubtle, color: c.text, fontSize: 16, paddingHorizontal: 16, marginBottom: 14 },
  passwordField: { height: 56, borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.cardSubtle, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1, height: '100%', color: c.text, fontSize: 16, paddingRight: 12 },
  forgot: { alignSelf: 'flex-end', paddingVertical: 12 },
  forgotText: { color: c.textMuted, fontSize: 13 },
  errorBox: { backgroundColor: c.dangerSoft, borderWidth: 1, borderColor: 'rgba(239,68,68,0.22)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 10 },
  error: { color: c.danger, fontSize: 13 },
  submitWrap: { alignItems: 'center', paddingTop: 4 },
  submit: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', shadowColor: c.accent, shadowOpacity: 0.38, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 7 },
  arrow: { color: c.accentOn, fontSize: 25, lineHeight: 28, fontWeight: '700', marginTop: -2 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 38 },
  divLine: { flex: 1, height: 1, backgroundColor: c.line },
  divText: { color: c.textMuted, fontSize: 9, letterSpacing: 1.5 },
  socialRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 28 },
  socialBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  socialLetter: { color: c.text, fontFamily: font.display, fontSize: 18 },
  socialNote: { color: c.textMuted, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 14, paddingHorizontal: 8 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 38 },
  footerText: { color: c.textMuted, fontSize: 14 },
  footerLink: { color: c.accent, fontSize: 14, fontWeight: '600' },
  driverHint: { alignItems: 'center', paddingTop: 14, paddingBottom: 4 },
  driverHintText: { color: c.textMuted, fontSize: 12 },
}));
