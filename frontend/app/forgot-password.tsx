import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authApi } from '@/src/lib/api';
import { apiError } from '@/src/lib/format';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon } from '@/src/components/Icon';
import { KjappMark } from '@/src/components/KjappMark';
import { LinearGradient } from 'expo-linear-gradient';

export default function ForgotPassword() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const value = email.trim();
    if (!value) return setError('Skriv inn e-postadressen din.');
    setBusy(true); setError('');
    try {
      await authApi.forgotPassword(value);
      setSent(true);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={['#FFFFFF', '#F2F5FA']} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={[s.wrap, { paddingTop: insets.top + 26, paddingBottom: insets.bottom + 24 }]}>
        <Pressable onPress={() => router.back()} style={s.backLink} accessibilityRole="button" accessibilityLabel="Tilbake">
          <Text style={s.backLinkText}>‹  Tilbake</Text>
        </Pressable>

        <View style={s.content}>
          {sent ? (
            <View style={s.sentState}>
              <View style={s.mailCircle}><Icon name="mail" size={24} color={colors.accent} /></View>
              <Text style={s.title}>Sjekk e-posten din</Text>
              <Text style={s.sub}>Hvis kontoen finnes, har vi sendt en sikker lenke for å velge nytt passord.</Text>
              <Pressable onPress={() => router.replace('/login')} style={s.secondaryButton}>
                <Text style={s.secondaryText}>Tilbake til innlogging</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <KjappMark size={44} />
              <Text style={s.title}>Glemt passord?</Text>
              <Text style={s.sub}>Skriv inn e-posten din, så sender vi en sikker tilbakestillingslenke.</Text>
              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>E-POST</Text>
                <View style={s.field}>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="deg@epost.no"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    style={s.input}
                    testID="forgot-email"
                  />
                </View>
              </View>
              {error ? <Text style={s.error}>{error}</Text> : null}
              <Pressable onPress={submit} disabled={busy} testID="forgot-submit">
                <LinearGradient colors={busy ? [colors.lineStrong, colors.lineStrong] : ['#FF3B3B', '#FF0000']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.primaryButton}>
                  {busy ? <ActivityIndicator color={colors.accentOn} /> : <Text style={s.primaryText}>Send lenke</Text>}
                </LinearGradient>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  wrap: { flex: 1, paddingHorizontal: 28 },
  backLink: { minHeight: 40, alignSelf: 'flex-start', justifyContent: 'center' },
  backLinkText: { color: c.textSecondary, fontFamily: font.medium, fontSize: 14 },
  content: { flex: 1, justifyContent: 'center', paddingBottom: 80 },
  title: { color: c.text, fontFamily: font.semibold, fontSize: 26, letterSpacing: -0.6, marginTop: 22 },
  sub: { color: c.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 26 },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { color: c.textMuted, fontFamily: font.mono, fontSize: 10, letterSpacing: 1.9, marginBottom: 8 },
  field: { height: 52, borderRadius: 16, borderWidth: 1, borderColor: c.lineStrong, backgroundColor: c.surface, paddingHorizontal: 16, justifyContent: 'center' },
  input: { color: c.text, fontFamily: font.body, fontSize: 15, height: '100%' },
  error: { color: c.danger, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  primaryButton: { minHeight: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: c.accent, shadowOpacity: 0.3, shadowRadius: 15, shadowOffset: {width:0,height:8}, elevation: 6 },
  primaryText: { color: c.accentOn, fontFamily: font.semibold, fontSize: 14 },
  sentState: { alignItems: 'center' },
  mailCircle: { width: 58, height: 58, borderRadius: 29, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' },
  secondaryButton: { minHeight: 50, marginTop: 8, paddingHorizontal: 22, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.lineStrong },
  secondaryText: { color: c.text, fontFamily: font.semibold, fontSize: 13 },
}));

