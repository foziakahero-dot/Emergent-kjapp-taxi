import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon } from '@/src/components/Icon';
import { authApi } from '@/src/lib/api';

export default function ForgotPassword() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await authApi.forgotPassword(email.trim());
    } catch {
      // Deliberately show the same result to avoid account enumeration.
    } finally {
      setSent(true);
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.wrap, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 24 }]}>
        <Pressable onPress={() => router.replace('/login')} style={s.back} testID="forgot-back">
          <Icon name="chevron-left" size={22} color={colors.textMuted} />
        </Pressable>

        {sent ? (
          <View style={s.success} testID="forgot-success">
            <View style={s.successIcon}>
              <Icon name="mail" size={26} color={colors.accent} />
            </View>
            <Text style={s.successTitle}>Sjekk innboksen din</Text>
            <Text style={s.successBody}>
              Hvis kontoen finnes har vi sendt en lenke til <Text style={{ color: colors.text }}>{email.trim()}</Text>. Lenken er gyldig i 1 time.
            </Text>
            <Pressable style={s.returnBtn} onPress={() => router.replace('/login')} testID="forgot-to-login">
              <Text style={s.returnText}>Tilbake til innlogging</Text>
            </Pressable>
          </View>
        ) : (
          <View style={s.content}>
            <Text style={s.title}>Glemt passord?</Text>
            <Text style={s.sub}>Skriv inn e-posten din, så sender vi deg en lenke for å velge nytt passord.</Text>

            <TextInput
              testID="forgot-email"
              placeholder="E-post"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              style={s.input}
            />

            <Pressable
              onPress={submit}
              disabled={loading || !email.trim()}
              testID="forgot-submit"
              style={[s.submit, (loading || !email.trim()) && { opacity: 0.5 }]}
            >
              {loading ? <ActivityIndicator color={colors.accentOn} /> : <Text style={s.submitText}>Send tilbakestillingslenke</Text>}
            </Pressable>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  wrap: { flex: 1, paddingHorizontal: 24 },
  back: { width: 40, height: 40, marginLeft: -6, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 8, paddingTop: 18 },
  title: { color: c.text, fontFamily: font.display, fontSize: 28, letterSpacing: -0.4 },
  sub: { color: c.textMuted, fontSize: 14, lineHeight: 21, marginTop: 8 },
  input: { marginTop: 38, height: 56, borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.cardSubtle, color: c.text, fontSize: 16, paddingHorizontal: 16 },
  submit: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent, marginTop: 16 },
  submitText: { color: c.accentOn, fontSize: 15, fontWeight: '700' },
  success: { flex: 1, paddingHorizontal: 8, paddingTop: 58, alignItems: 'center' },
  successIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  successTitle: { color: c.text, fontFamily: font.display, fontSize: 26, textAlign: 'center' },
  successBody: { color: c.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 12 },
  returnBtn: { marginTop: 30, borderRadius: 999, paddingHorizontal: 22, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent },
  returnText: { color: c.accentOn, fontSize: 14, fontWeight: '700' },
}));
