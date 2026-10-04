import React, { useState } from 'react';
import {
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
import { BrandBadge } from '@/src/components/BrandBadge';
import { Icon } from '@/src/components/Icon';
import { apiError } from '@/src/lib/format';

export default function DriverLogin() {
  const { login, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await login(identifier.trim(), password);
      if (res?.twofa_required) {
        setError('Kontoen krever tofaktor — logg inn via web-portalen.');
        return;
      }
      if (res?.role !== 'driver') {
        await logout();
        setError('Denne kontoen er ikke en KJAPP-sjåførkonto.');
        return;
      }
      if (res?.approved !== true) {
        await logout();
        setError('Sjåførkontoen din venter fortsatt på godkjenning. Du får tilgang når dokumentene og kontoen er godkjent.');
        return;
      }
      if (res?.legal_accepted !== true) {
        router.replace('/driver-legal-consent');
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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.driverBg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[s.wrap, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} style={s.back} testID="driver-login-back" accessibilityRole="button" accessibilityLabel="Tilbake">
          <Icon name="arrow-left" size={20} color={colors.text} />
        </Pressable>

        <View style={s.identity}>
          <BrandBadge size={64} />
          <Text style={s.title}>Klar for skift</Text>
          <Text style={s.eyebrow}>KJAPP DRIVER</Text>
        </View>
        <Text style={s.sub}>Logg inn med e-post eller telefonnummeret på den inviterte og godkjente sjåførkontoen din. Online-status velger du først etter innlogging.</Text>

        <View style={s.form}>
          <View style={s.field}>
            <Icon name="user" size={18} color={colors.textMuted} />
            <TextInput
              testID="driver-login-identifier"
              placeholder="E-post eller telefonnummer"
              placeholderTextColor={colors.textMuted}
              style={s.input}
              autoCapitalize="none"
              keyboardType="default"
              value={identifier}
              onChangeText={setIdentifier}
              autoComplete="off"
            />
          </View>
          <View style={s.field}>
            <Icon name="lock" size={18} color={colors.textMuted} />
            <TextInput
              testID="driver-login-password"
              placeholder="Passord"
              placeholderTextColor={colors.textMuted}
              style={s.input}
              secureTextEntry={!show}
              value={password}
              onChangeText={setPassword}
              autoComplete="current-password"
            />
            <Pressable onPress={() => setShow((v) => !v)} style={s.fieldAction} testID="driver-login-toggle-password" accessibilityRole="button" accessibilityLabel={show ? 'Skjul passord' : 'Vis passord'}>
              <Icon name={show ? 'eye-off' : 'eye'} size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>

        <Pressable onPress={() => router.push('/forgot-password')} style={s.forgot} testID="driver-login-forgot-password">
          <Text style={s.forgotText}>Glemt passord?</Text>
        </Pressable>

        {error ? <Text style={s.error} testID="driver-login-error">{error}</Text> : null}

        <Button label="Logg inn som sjåfør" onPress={submit} loading={loading} testID="driver-login-submit" style={{ marginTop: 12 }} />

        <View style={s.note}>
          <Icon name="shield" size={17} color={colors.online} />
          <Text style={s.noteText}>Kun godkjente sjåførkontoer får tilgang til turer og posisjonsdeling.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { paddingHorizontal: 24, flexGrow: 1, backgroundColor: c.driverBg },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line, marginBottom: 28 },
  identity: { alignItems: 'center', marginBottom: 14 },
  eyebrow: { color: c.online, fontFamily: font.bold, fontSize: 10, letterSpacing: 2, marginTop: 8 },
  title: { fontFamily: font.display, fontSize: 28, color: c.text, marginTop: 24 },
  sub: { color: c.textSecondary, fontFamily: font.body, fontSize: 14, marginBottom: 30, lineHeight: 21, textAlign: 'center' },
  form: { gap: 12 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.driverCard, borderWidth: 1, borderColor: c.lineStrong, borderRadius: 18, paddingLeft: 16, paddingRight: 6, height: 56 },
  input: { flex: 1, color: c.text, fontFamily: font.body, fontSize: 16, height: '100%' },
  fieldAction: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  forgot: { minHeight: 32, alignSelf: 'flex-end', justifyContent: 'center', marginTop: 6 },
  forgotText: { color: c.online, fontFamily: font.semibold, fontSize: 13 },
  error: { color: c.danger, fontSize: 13, lineHeight: 18, marginTop: 10 },
  note: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.onlineSoft, borderWidth: 1, borderColor: c.line, borderRadius: 14, paddingHorizontal: 14, marginTop: 18 },
  noteText: { color: c.textMuted, fontSize: 11, lineHeight: 16, flex: 1 },
}));