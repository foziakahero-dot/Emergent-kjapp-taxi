import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, makeStyles } from '@/src/theme';
import { AppleSignInButton } from '@/src/components/AppleSignInButton';
import { KjappMark } from '@/src/components/KjappMark';
import { apiError } from '@/src/lib/format';
import { LinearGradient } from 'expo-linear-gradient';

const isCustomerRole = (role?: string) => !role || role === 'user' || role === 'customer';

export default function Login() {
  const { login, logout, signInWithGoogle, signInWithApple } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [error, setError] = useState('');

  const finishLogin = async (u: any) => {
    if (!isCustomerRole(u?.role)) {
      await logout();
      setError(
        u?.role === 'driver'
          ? 'Dette er en sjåførkonto. Bruk KJAPP Driver.'
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

  const appleSignIn = async () => {
    setError('');
    setAppleLoading(true);
    try {
      const u = await signInWithApple();
      if (u) await finishLogin(u);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient colors={['#FFFFFF', '#F2F5FA']} style={s.bgGradient} pointerEvents="none" />
      <ScrollView
        contentContainerStyle={[
          s.wrap,
          { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} style={s.backLink} testID="login-back" accessibilityRole="button" accessibilityLabel="Tilbake">
          <Text style={s.backLinkText}>‹  Tilbake</Text>
        </Pressable>

        <View style={s.brandBlock}>
          <KjappMark size={64} />
          <Text style={s.title}>Velkommen til KJAPP</Text>
          <Text style={s.sub}>Bestill. Følg. Betal.</Text>
        </View>

        <View style={s.socialButtons}>
          <AppleSignInButton loading={appleLoading} onPress={appleSignIn} />
          <Pressable
            style={s.googleBtn}
            onPress={googleSignIn}
            disabled={gLoading}
            testID="login-google"
            accessibilityRole="button"
            accessibilityLabel="Fortsett med Google"
          >
            {gLoading ? <ActivityIndicator color={colors.text} /> : (
              <>
                <Text style={s.googleG}>G</Text>
                <Text style={s.googleText}>Fortsett med Google</Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={s.dividerRow}>
          <View style={s.divLine} />
          <Text style={s.divText}>ELLER</Text>
          <View style={s.divLine} />
        </View>

        <View style={s.form}>
          <View>
            <Text style={s.fieldLabel}>E-POST</Text>
            <View style={s.field}>
              <TextInput
                testID="login-email"
                placeholder="deg@epost.no"
                placeholderTextColor={colors.textMuted}
                style={s.input}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                autoComplete="email"
              />
            </View>
          </View>

          <View>
            <Text style={s.fieldLabel}>PASSORD</Text>
            <View style={s.field}>
              <TextInput
                testID="login-password"
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                style={s.input}
                secureTextEntry={!show}
                value={password}
                onChangeText={setPassword}
                autoComplete="current-password"
              />
              <Pressable onPress={() => setShow((v) => !v)} testID="login-toggle-password" style={s.fieldAction} accessibilityRole="button" accessibilityLabel={show ? 'Skjul passord' : 'Vis passord'}>
                <Text style={s.fieldActionText}>{show ? 'SKJUL' : 'VIS'}</Text>
              </Pressable>
            </View>
          </View>

          <Pressable onPress={() => router.push('/forgot-password')} style={s.forgot} testID="login-forgot-password">
            <Text style={s.forgotText}>Glemt passord?</Text>
          </Pressable>

          {error ? <Text style={s.error} testID="login-error">{error}</Text> : null}

          <Pressable onPress={submit} disabled={loading} testID="login-submit">
            <LinearGradient colors={loading ? [colors.lineStrong, colors.lineStrong] : ['#FF3B3B', '#FF0000']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primaryButton}>
              {loading ? <ActivityIndicator color={colors.accentOn} /> : <Text style={s.primaryButtonText}>Logg inn</Text>}
            </LinearGradient>
          </Pressable>
        </View>

        <Pressable
          onPress={() => router.push('/register')}
          style={s.footer}
          testID="login-to-register"
        >
          <Text style={s.footerText}>
            Ny hos KJAPP? <Text style={s.footerLink}>Opprett konto</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  bgGradient: { ...StyleSheet.absoluteFill },
  wrap: { paddingHorizontal: 28, flexGrow: 1, backgroundColor: 'transparent' },
  backLink: { minHeight: 40, alignSelf: 'flex-start', justifyContent: 'center', marginBottom: 18 },
  backLinkText: { color: c.textSecondary, fontFamily: font.medium, fontSize: 14 },
  brandBlock: { alignItems: 'center', marginBottom: 34 },
  title: { fontFamily: font.semibold, fontSize: 28, color: c.text, marginTop: 24, textAlign: 'center', letterSpacing: -0.7 },
  sub: { color: c.textSecondary, fontFamily: font.body, fontSize: 14, lineHeight: 20, marginTop: 6, textAlign: 'center' },
  socialButtons: { gap: 12 },
  form: { gap: 16 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.lineStrong,
    borderRadius: 16,
    paddingLeft: 16,
    paddingRight: 6,
    height: 52,
  },
  fieldLabel: { color: c.textMuted, fontFamily: font.mono, fontSize: 10, letterSpacing: 1.9, marginBottom: 8 },
  input: { flex: 1, color: c.text, fontFamily: font.body, fontSize: 15, height: '100%' },
  fieldAction: { minWidth: 48, height: 44, alignItems: 'center', justifyContent: 'center' },
  fieldActionText: { color: c.textMuted, fontFamily: font.bold, fontSize: 10, letterSpacing: 0.7 },
  forgot: { minHeight: 32, alignSelf: 'flex-end', justifyContent: 'center', paddingHorizontal: 2 },
  forgotText: { color: c.accent, fontFamily: font.semibold, fontSize: 13 },
  error: { color: c.danger, fontSize: 13, lineHeight: 18 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 18 },
  divLine: { flex: 1, height: 1, backgroundColor: c.line },
  divText: { color: c.textMuted, fontSize: 12 },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: 54,
    borderRadius: 28,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.lineStrong,
  },
  googleG: { color: '#4285F4', fontFamily: font.bold, fontSize: 20 },
  googleText: { color: c.text, fontFamily: font.semibold, fontSize: 15 },
  trustRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 12,
  },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trustMark: { color: c.accent, fontFamily: font.bold, fontSize: 13 },
  trustText: { color: c.textMuted, fontSize: 11 },
  trustDivider: { width: 1, height: 16, backgroundColor: c.line },
  primaryButton: { minHeight: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', shadowColor: c.accent, shadowOpacity: 0.30, shadowRadius: 15, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  primaryButtonText: { color: c.accentOn, fontFamily: font.semibold, fontSize: 14 },
  footer: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  footerText: { color: c.textSecondary, fontSize: 14 },
  footerLink: { color: c.accent, fontFamily: font.semibold },
}));

