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
import { Icon } from '@/src/components/Icon';
import { apiError } from '@/src/lib/format';

export default function Register() {
  const { register } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!fullName.trim() || !email.trim() || password.length < 6) {
      setError('Fyll inn navn, e-post og passord på minst 6 tegn.');
      return;
    }
    setLoading(true);
    try {
      const normalizedPhone = phone.trim() ? `+47${phone.trim().replace(/\s+/g, '')}` : '';
      await register({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: normalizedPhone,
        password,
      });
      router.replace('/(app)/home');
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[s.wrap, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 26 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => router.back()} style={s.back} testID="register-back">
          <Icon name="chevron-left" size={22} color={colors.textMuted} />
        </Pressable>

        <View style={s.content}>
          <Text style={s.title}>Opprett konto</Text>
          <Text style={s.sub}>Bli med KJAPP på under 30 sekunder</Text>

          <View style={s.form}>
            <TextInput
              testID="register-name"
              placeholder="Fullt navn"
              placeholderTextColor={colors.textMuted}
              value={fullName}
              onChangeText={setFullName}
              autoComplete="name"
              style={s.input}
            />
            <TextInput
              testID="register-email"
              placeholder="E-post"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              style={s.input}
            />

            <View style={s.phoneRow}>
              <View style={s.countryBox}>
                <Text style={s.flag}>🇳🇴</Text>
                <Text style={s.countryText}>+47</Text>
              </View>
              <TextInput
                testID="register-phone"
                placeholder="Telefonnummer"
                placeholderTextColor={colors.textMuted}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoComplete="tel"
                style={s.phoneInput}
              />
            </View>

            <View style={s.passwordField}>
              <TextInput
                testID="register-password"
                placeholder="Passord (min. 6 tegn)"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!show}
                autoComplete="new-password"
                style={s.passwordInput}
              />
              <Pressable onPress={() => setShow((v) => !v)} hitSlop={10} testID="register-toggle-password">
                <Icon name={show ? 'eye-off' : 'eye'} size={18} color={colors.textMuted} />
              </Pressable>
            </View>

            {error ? (
              <View style={s.errorBox} testID="register-error">
                <Text style={s.error}>{error}</Text>
              </View>
            ) : null}

            <View style={s.submitWrap}>
              <Pressable
                onPress={submit}
                disabled={loading}
                testID="register-submit"
                style={({ pressed }) => [s.submit, pressed && { transform: [{ scale: 0.96 }] }, loading && { opacity: 0.6 }]}
              >
                {loading ? <ActivityIndicator color={colors.accentOn} /> : <Text style={s.arrow}>→</Text>}
              </Pressable>
            </View>
          </View>

          <Text style={s.legal}>
            Ved å opprette konto godtar du KJAPPs vilkår og personvernregler.
          </Text>
        </View>

        <Pressable onPress={() => router.replace('/login')} style={s.footer} testID="register-to-login">
          <Text style={s.footerText}>Allerede konto? <Text style={s.footerLink}>Logg inn</Text></Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  wrap: { paddingHorizontal: 24, flexGrow: 1, backgroundColor: c.bg },
  back: { width: 40, height: 40, marginLeft: -6, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 8, paddingTop: 18, flex: 1 },
  title: { fontFamily: font.display, fontSize: 28, color: c.text, letterSpacing: -0.5 },
  sub: { color: c.textMuted, fontSize: 14, marginTop: 8 },
  form: { marginTop: 38, gap: 14 },
  input: { height: 56, borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.cardSubtle, color: c.text, fontSize: 16, paddingHorizontal: 16 },
  phoneRow: { flexDirection: 'row', gap: 12 },
  countryBox: { width: 98, height: 56, borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.cardSubtle, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  flag: { fontSize: 17 },
  countryText: { color: c.text, fontSize: 15 },
  phoneInput: { flex: 1, height: 56, borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.cardSubtle, color: c.text, fontSize: 16, paddingHorizontal: 16 },
  passwordField: { height: 56, borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.cardSubtle, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1, height: '100%', color: c.text, fontSize: 16, paddingRight: 12 },
  errorBox: { backgroundColor: c.dangerSoft, borderWidth: 1, borderColor: 'rgba(239,68,68,0.22)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  error: { color: c.danger, fontSize: 13 },
  submitWrap: { alignItems: 'center', paddingTop: 4 },
  submit: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', shadowColor: c.accent, shadowOpacity: 0.38, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 7 },
  arrow: { color: c.accentOn, fontSize: 25, lineHeight: 28, fontWeight: '700', marginTop: -2 },
  legal: { color: c.textMuted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 22, paddingHorizontal: 8 },
  footer: { alignItems: 'center', marginTop: 34 },
  footerText: { color: c.textMuted, fontSize: 14 },
  footerLink: { color: c.accent, fontWeight: '600' },
}));
