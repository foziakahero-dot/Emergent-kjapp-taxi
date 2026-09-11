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
  const { login, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await login(email.trim(), password);
      if (res?.twofa_required) {
        setError('Kontoen krever tofaktor — logg inn via web-portalen.');
        return;
      }
      if (res?.role !== 'driver') {
        await logout();
        setError('Denne kontoen er ikke godkjent som KJAPP-sjåfør.');
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
        contentContainerStyle={[s.wrap, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} style={s.back} testID="driver-login-back">
          <Icon name="arrow-left" size={20} color={colors.text} />
        </Pressable>

        <View style={s.badge}>
          <Icon name="car" size={16} color={colors.online} />
          <Text style={s.badgeText}>KJAPP DRIVER</Text>
        </View>
        <Text style={s.title}>Klar for skift</Text>
        <Text style={s.sub}>Logg inn med din godkjente sjåførkonto for å motta turer.</Text>

        <View style={s.field}>
          <Icon name="mail" size={18} color={colors.textMuted} />
          <TextInput
            testID="driver-login-email"
            placeholder="E-post"
            placeholderTextColor={colors.textMuted}
            style={s.input}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        </View>
        <View style={s.field}>
          <Icon name="lock" size={18} color={colors.textMuted} />
          <TextInput
            testID="driver-login-password"
            placeholder="Passord"
            placeholderTextColor={colors.textMuted}
            style={s.input}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        {error ? <Text style={s.error} testID="driver-login-error">{error}</Text> : null}

        <Button label="Logg inn som sjåfør" onPress={submit} loading={loading} testID="driver-login-submit" style={{ marginTop: 8 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { paddingHorizontal: 24, flexGrow: 1, backgroundColor: c.driverBg },
  back: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: c.line, marginBottom: 24,
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
    backgroundColor: c.onlineSoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7,
  },
  badgeText: { color: c.online, fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  title: { fontFamily: font.display, fontSize: 28, color: c.text, marginTop: 20 },
  sub: { color: c.textMuted, fontSize: 14, marginTop: 6, marginBottom: 24, lineHeight: 20 },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.driverCard,
    borderWidth: 1, borderColor: c.line, borderRadius: 14, paddingHorizontal: 16, height: 56, marginBottom: 14,
  },
  input: { flex: 1, color: c.text, fontSize: 16, height: '100%' },
  error: { color: c.danger, fontSize: 13, marginBottom: 8 },
}));
