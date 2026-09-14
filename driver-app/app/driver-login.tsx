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

export default function DriverLogin() {
  const { login, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!email.trim() || !password) return;
    setError('');
    setLoading(true);
    try {
      const res = await login(email.trim(), password);
      if (res?.twofa_required) {
        setError('Kontoen krever tofaktor. Fullfør innlogging via web-portalen.');
        return;
      }
      if (res?.role !== 'driver') {
        await logout();
        setError('Denne kontoen er ikke en sjåførkonto. Bruk KJAPP kundeappen.');
        return;
      }
      router.replace('/(driver)/home');
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
        <Pressable onPress={() => router.back()} style={s.back} testID="driver-login-back">
          <Icon name="chevron-left" size={22} color={colors.textMuted} />
        </Pressable>

        <View style={s.content}>
          <View style={s.portalHeader}>
            <View style={s.carCircle}>
              <Icon name="car" size={20} color={colors.online} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>SJÅFØR-PORTAL</Text>
              <Text style={s.title}>Kjør med KJAPP</Text>
            </View>
          </View>
          <Text style={s.sub}>Logg inn for å motta turer, navigere og se dagens inntekt.</Text>

          <View style={s.form}>
            <TextInput
              testID="driver-login-email"
              placeholder="Sjåfør-e-post"
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
                testID="driver-login-password"
                placeholder="Passord"
                placeholderTextColor={colors.textMuted}
                style={s.passwordInput}
                secureTextEntry={!show}
                autoComplete="current-password"
                value={password}
                onChangeText={setPassword}
              />
              <Pressable onPress={() => setShow((v) => !v)} hitSlop={10} testID="driver-login-toggle-password">
                <Icon name={show ? 'eye-off' : 'eye'} size={18} color={colors.textMuted} />
              </Pressable>
            </View>

            {error ? (
              <View style={s.errorBox} testID="driver-login-error">
                <Text style={s.error}>{error}</Text>
              </View>
            ) : null}

            <View style={s.submitWrap}>
              <Pressable
                onPress={submit}
                disabled={loading || !email.trim() || !password}
                testID="driver-login-submit"
                style={({ pressed }) => [
                  s.submit,
                  pressed && { transform: [{ scale: 0.96 }] },
                  (loading || !email.trim() || !password) && { opacity: 0.55 },
                ]}
              >
                {loading ? <ActivityIndicator color="#04120A" /> : <Text style={s.arrow}>→</Text>}
              </Pressable>
            </View>
          </View>

          <View style={s.inviteCard}>
            <Text style={s.inviteTitle}>VIL DU BLI SJÅFØR?</Text>
            <Text style={s.inviteBody}>
              Sjåførkontoer opprettes via invitasjon fra en løyvehaver med flåte. Kontakt din flåte-eier for registreringslenke.
            </Text>
          </View>
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>Er du kunde? </Text>
          <Text style={s.footerLink}>Bruk KJAPP kundeappen</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.driverBg },
  wrap: { paddingHorizontal: 24, flexGrow: 1, backgroundColor: c.driverBg },
  back: { width: 40, height: 40, marginLeft: -6, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 8, paddingTop: 18, flex: 1 },
  portalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  carCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.onlineSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(47,224,140,0.22)' },
  eyebrow: { color: c.online, fontSize: 10, letterSpacing: 1.7, fontWeight: '800' },
  title: { color: c.text, fontFamily: font.display, fontSize: 24, letterSpacing: -0.4, marginTop: 2 },
  sub: { color: c.textMuted, fontSize: 14, lineHeight: 21, marginTop: 12 },
  form: { marginTop: 32 },
  input: { height: 56, borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.driverCard, color: c.text, fontSize: 16, paddingHorizontal: 16, marginBottom: 14 },
  passwordField: { height: 56, borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.driverCard, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1, height: '100%', color: c.text, fontSize: 16, paddingRight: 12 },
  errorBox: { backgroundColor: c.dangerSoft, borderWidth: 1, borderColor: 'rgba(239,68,68,0.22)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, marginTop: 14 },
  error: { color: c.danger, fontSize: 13 },
  submitWrap: { alignItems: 'center', paddingTop: 18 },
  submit: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.online, alignItems: 'center', justifyContent: 'center', shadowColor: c.online, shadowOpacity: 0.38, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 7 },
  arrow: { color: '#04120A', fontSize: 25, lineHeight: 28, fontWeight: '700', marginTop: -2 },
  inviteCard: { marginTop: 38, backgroundColor: c.driverCard, borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 16 },
  inviteTitle: { color: c.online, fontSize: 10, letterSpacing: 1.7, fontWeight: '800' },
  inviteBody: { color: c.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 8 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 34, paddingBottom: 4 },
  footerText: { color: c.textMuted, fontSize: 14 },
  footerLink: { color: c.online, fontSize: 14, fontWeight: '600' },
}));
