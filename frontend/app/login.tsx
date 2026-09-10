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

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
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
      if (res?.role === 'driver') router.replace('/(driver)/home');
      else router.replace('/(app)/home');
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[s.wrap, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} style={s.back} testID="login-back">
          <Icon name="arrow-left" size={20} color={colors.text} />
        </Pressable>

        <Text style={s.brand}>KJ<Text style={{ color: colors.accent }}>A</Text>PP</Text>
        <Text style={s.title}>Velkommen tilbake</Text>
        <Text style={s.sub}>Logg inn for å bestille din neste tur.</Text>

        <View style={s.field}>
          <Icon name="mail" size={18} color={colors.textMuted} />
          <TextInput
            testID="login-email"
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
            testID="login-password"
            placeholder="Passord"
            placeholderTextColor={colors.textMuted}
            style={s.input}
            secureTextEntry={!show}
            value={password}
            onChangeText={setPassword}
          />
          <Pressable onPress={() => setShow((v) => !v)} testID="login-toggle-password">
            <Icon name={show ? 'eye-off' : 'eye'} size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        {error ? (
          <Text style={s.error} testID="login-error">
            {error}
          </Text>
        ) : null}

        <Button label="Logg inn" onPress={submit} loading={loading} testID="login-submit" style={{ marginTop: 8 }} />

        <Pressable onPress={() => router.push('/register')} style={s.footer} testID="login-to-register">
          <Text style={s.footerText}>
            Ny hos KJAPP? <Text style={{ color: colors.accent }}>Opprett konto</Text>
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            setEmail('ola@kjapp.no');
            setPassword('test1234');
          }}
          style={s.demo}
          testID="login-demo-fill"
        >
          <Text style={s.demoText}>Fyll inn demo-konto</Text>
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
    marginBottom: 24,
  },
  brand: { fontFamily: font.display, fontSize: 34, color: c.text, letterSpacing: 1 },
  title: { fontFamily: font.display, fontSize: 26, color: c.text, marginTop: 24 },
  sub: { color: c.textMuted, fontSize: 14, marginTop: 6, marginBottom: 24 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: c.cardSubtle,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 14,
  },
  input: { flex: 1, color: c.text, fontSize: 16, height: '100%' },
  error: { color: c.danger, fontSize: 13, marginBottom: 8 },
  footer: { alignItems: 'center', marginTop: 24 },
  footerText: { color: c.textSecondary, fontSize: 14 },
  demo: { alignItems: 'center', marginTop: 28 },
  demoText: { color: c.textMuted, fontSize: 12, textDecorationLine: 'underline' },
}));
