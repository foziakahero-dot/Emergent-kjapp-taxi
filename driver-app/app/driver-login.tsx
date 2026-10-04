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
import { Icon } from '@/src/components/Icon';
import { apiError } from '@/src/lib/format';

export default function DriverLogin() {
  const { login } = useAuth();
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
          <View style={s.statusDot} />
          <Text style={s.eyebrow}>KJAPP DRIVER</Text>
        </View>
        <Text style={s.brand}>KJAPP</Text>
        <View style={s.brandLine} />
        <Text style={s.title}>Klar for skift</Text>
        <Text style={s.sub}>Kun inviterte og godkjente sjåfører får tilgang. Logg inn med e-post eller telefonnummer og passord.</Text>

        <View style={s.form}>
          <View style={s.field}>
            <Icon name="mail" size={18} color={colors.textMuted} />
            <TextInput
              testID="driver-login-identifier"
              placeholder="E-post eller telefonnummer"
              placeholderTextColor={colors.textMuted}
              style={s.input}
              autoCapitalize="none"
              keyboardType="default"
              value={identifier}
              onChangeText={setIdentifier}
              autoComplete="username"
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

        {error ? <Text style={s.error} testID="driver-login-error">{error}</Text> : null}

        <Button label="Logg inn som sjåfør" onPress={submit} loading={loading} testID="driver-login-submit" style={{ marginTop: 12 }} />

        <View style={s.note}>
          <Icon name="shield" size={17} color={colors.online} />
          <Text style={s.noteText}>KJAPP Driver er invite-only. Kontoen opprettes via sjåførinvitasjon og må godkjennes før innlogging.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { paddingHorizontal: 24, flexGrow: 1, backgroundColor: c.driverBg },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line, marginBottom: 28 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.online },
  eyebrow: { color: c.online, fontFamily: font.bold, fontSize: 10, letterSpacing: 1.8 },
  brand: { color: c.text, fontFamily: font.bold, fontSize: 34, letterSpacing: 0.5, marginTop: 8 },
  brandLine: { width: 42, height: 3, borderRadius: 2, backgroundColor: c.online, marginTop: 8 },
  title: { fontFamily: font.display, fontSize: 28, color: c.text, marginTop: 30 },
  sub: { color: c.textMuted, fontFamily: font.body, fontSize: 14, marginTop: 7, marginBottom: 24, lineHeight: 20 },
  form: { gap: 12 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.driverCard, borderWidth: 1, borderColor: c.line, borderRadius: 14, paddingLeft: 16, paddingRight: 6, height: 56 },
  input: { flex: 1, color: c.text, fontFamily: font.body, fontSize: 16, height: '100%' },
  fieldAction: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  error: { color: c.danger, fontSize: 13, lineHeight: 18, marginTop: 10 },
  note: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.onlineSoft, borderWidth: 1, borderColor: c.line, borderRadius: 14, paddingHorizontal: 14, marginTop: 18 },
  noteText: { color: c.textMuted, fontSize: 11, lineHeight: 16, flex: 1 },
}));