import { GoogleIcon } from '@/src/components/SocialIcons';
import { DesignField } from '@/src/components/DesignField';
import { Rise } from '@/src/components/Motion';
import { Button } from '@/src/components/ui';
import { Text, TextInput } from '@/src/components/Typography';
import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, makeStyles } from '@/src/theme';
import { AppleSignInButton } from '@/src/components/AppleSignInButton';
import { KjappMark } from '@/src/components/KjappMark';
import { apiError } from '@/src/lib/format';
import { FigmaGradient as LinearGradient } from '@/src/components/FigmaGradient';

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
          { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
      >

        <Rise style={s.brandBlock}>
          <KjappMark size={64} float />
          <Text style={s.title}>Velkommen til KJAPP</Text>
          <Text style={s.sub}>Bestill. Følg. Betal.</Text>
        </Rise>

        <Rise delay={60} style={s.socialButtons}>
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
                <GoogleIcon />
                <Text style={s.googleText}>Fortsett med Google</Text>
              </>
            )}
          </Pressable>
        </Rise>

        <Rise delay={100} style={s.dividerRow}>
          <View style={s.divLine} />
          <Text style={s.divText}>ELLER</Text>
          <View style={s.divLine} />
        </Rise>

        <Rise delay={140} style={s.form}>
          <DesignField label="E-post" testID="login-email" placeholder="deg@epost.no" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} autoComplete="email" />
          <DesignField label="Passord" testID="login-password" placeholder="••••••••" secureTextEntry={!show} value={password} onChangeText={setPassword} autoComplete="current-password"
            action={<Pressable onPress={() => setShow(v => !v)} testID="login-toggle-password" style={s.fieldAction} accessibilityRole="button" accessibilityLabel={show ? 'Skjul passord' : 'Vis passord'}><Text style={s.fieldActionText}>{show ? 'SKJUL' : 'VIS'}</Text></Pressable>} />
        </Rise>
        <Rise delay={180} style={{ marginTop: 28, gap: 16 }}>
          {error ? <Text style={s.error} testID="login-error">{error}</Text> : null}
          <Button label="Logg inn" onPress={submit} loading={loading} testID="login-submit" />
          <Pressable onPress={() => router.push('/forgot-password')} style={s.forgot} testID="login-forgot-password"><Text style={s.forgotText}>Glemt passord?</Text></Pressable>
        </Rise>

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
    brandBlock: { alignItems: 'center', marginBottom: 36 },
    title: { fontFamily: font.semibold, fontSize: 30, lineHeight: 36, color: c.text, marginTop: 24, textAlign: 'center', letterSpacing: -0.7 },
    sub: { color: c.textSecondary, fontFamily: font.body, fontSize: 14, lineHeight: 20, marginTop: 4, textAlign: 'center' },
    socialButtons: { gap: 12 },
    form: { gap: 16 },
    fieldAction: { minWidth: 48, height: 44, alignItems: 'center', justifyContent: 'center' },
    fieldActionText: { color: c.textMuted, fontFamily: font.bold, fontSize: 10, letterSpacing: 0.7 },
    forgot: { minHeight: 20, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 2 },
    forgotText: { color: c.accent, fontFamily: font.medium, fontSize: 14, lineHeight: 20 },
    error: { color: c.danger, fontSize: 13, lineHeight: 18 },
    dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 24 },
    divLine: { flex: 1, height: 1, backgroundColor: c.line },
    divText: { color: c.textMuted, fontFamily: font.mono, fontSize: 10, lineHeight: 15, letterSpacing: 1 },
    googleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        height: 50,
        borderRadius: 28,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.lineStrong,
    },
    googleText: { color: c.text, fontFamily: font.semibold, fontSize: 14, lineHeight: 20 },
    footer: { minHeight: 20, alignItems: 'center', justifyContent: 'center', marginTop: 32 },
    footerText: { color: c.textSecondary, fontSize: 14 },
    footerLink: { color: c.accent, fontFamily: font.semibold }
}));


