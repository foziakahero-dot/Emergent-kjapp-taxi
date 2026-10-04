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
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, makeStyles } from '@/src/theme';
import { Button } from '@/src/components/ui';
import { AppleSignInButton } from '@/src/components/AppleSignInButton';
import { BrandBadge } from '@/src/components/BrandBadge';
import { apiError } from '@/src/lib/format';

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
      <ScrollView
        contentContainerStyle={[
          s.wrap,
          { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => router.back()}
          style={s.back}
          testID="login-back"
          accessibilityRole="button"
          accessibilityLabel="Tilbake"
        >
          <Text style={s.backText}>←</Text>
        </Pressable>

        <View style={s.brandBlock}>
          <BrandBadge size={64} />
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
          <View style={s.field}>
            <Text style={s.fieldPrefix}>@</Text>
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
            <Text style={s.fieldPrefix}>•</Text>
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
            <Pressable
              onPress={() => setShow((v) => !v)}
              testID="login-toggle-password"
              style={s.fieldAction}
              accessibilityRole="button"
              accessibilityLabel={show ? 'Skjul passord' : 'Vis passord'}
            >
              <Text style={s.fieldActionText}>{show ? 'SKJUL' : 'VIS'}</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => router.push('/forgot-password')}
            style={s.forgot}
            testID="login-forgot-password"
          >
            <Text style={s.forgotText}>Glemt passord?</Text>
          </Pressable>

          {error ? (
            <Text style={s.error} testID="login-error">
              {error}
            </Text>
          ) : null}

          <Button
            label="Logg inn"
            onPress={submit}
            loading={loading}
            testID="login-submit"
            style={{ marginTop: 2 }}
          />
        </View>

        <View style={s.trustRow}>
          <View style={s.trustItem}>
            <Text style={s.trustMark}>✓</Text>
            <Text style={s.trustText}>Trygg konto</Text>
          </View>
          <View style={s.trustDivider} />
          <View style={s.trustItem}>
            <Text style={s.trustMark}>✓</Text>
            <Text style={s.trustText}>Sikker betaling</Text>
          </View>
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
  wrap: { paddingHorizontal: 24, flexGrow: 1, backgroundColor: c.bg },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.cardSubtle,
    borderWidth: 1,
    borderColor: c.line,
    marginBottom: 28,
  },
  backText: { color: c.text, fontSize: 26, lineHeight: 28, fontFamily: font.medium },
  brandBlock: { alignItems: 'center', marginBottom: 34 },
  title: { fontFamily: font.display, fontSize: 28, color: c.text, marginTop: 24, textAlign: 'center' },
  sub: { color: c.textSecondary, fontFamily: font.body, fontSize: 14, lineHeight: 20, marginTop: 6, textAlign: 'center' },
  socialButtons: { gap: 12 },
  form: { gap: 12 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.lineStrong,
    borderRadius: 18,
    paddingLeft: 16,
    paddingRight: 6,
    height: 56,
  },
  fieldPrefix: { width: 18, textAlign: 'center', color: c.textMuted, fontFamily: font.bold, fontSize: 16 },
  input: { flex: 1, color: c.text, fontFamily: font.body, fontSize: 16, height: '100%' },
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
  footer: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  footerText: { color: c.textSecondary, fontSize: 14 },
  footerLink: { color: c.accent, fontFamily: font.semibold },
}));
