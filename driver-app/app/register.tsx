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

export default function Register() {
  const { register } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!fullName.trim() || !email.trim() || password.length < 6) {
      setError('Fyll inn navn, e-post og passord (minst 6 tegn).');
      return;
    }
    setLoading(true);
    try {
      await register({ fullName: fullName.trim(), email: email.trim(), phone: phone.trim(), password });
      router.replace('/(app)/home');
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
        <Pressable onPress={() => router.back()} style={s.back} testID="register-back">
          <Icon name="arrow-left" size={20} color={colors.text} />
        </Pressable>

        <Text style={s.title}>Opprett konto</Text>
        <Text style={s.sub}>Bli med og reis kjappere gjennom byen.</Text>

        <Field icon="user" placeholder="Fullt navn" value={fullName} onChangeText={setFullName} testID="register-name" s={s} />
        <Field icon="mail" placeholder="E-post" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" testID="register-email" s={s} />
        <Field icon="phone" placeholder="Telefon (valgfritt)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" testID="register-phone" s={s} />
        <Field icon="lock" placeholder="Passord" value={password} onChangeText={setPassword} secureTextEntry testID="register-password" s={s} />

        {error ? <Text style={s.error} testID="register-error">{error}</Text> : null}

        <Button label="Opprett konto" onPress={submit} loading={loading} testID="register-submit" style={{ marginTop: 8 }} />

        <Pressable onPress={() => router.replace('/login')} style={s.footer} testID="register-to-login">
          <Text style={s.footerText}>Har du konto? <Text style={{ color: colors.accent }}>Logg inn</Text></Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ icon, s, ...props }: any) {
  return (
    <View style={s.field}>
      <Icon name={icon} size={18} color={colors.textMuted} />
      <TextInput placeholderTextColor={colors.textMuted} style={s.input} {...props} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { paddingHorizontal: 24, flexGrow: 1, backgroundColor: c.bg },
  back: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line, marginBottom: 24,
  },
  title: { fontFamily: font.display, fontSize: 28, color: c.text },
  sub: { color: c.textMuted, fontSize: 14, marginTop: 6, marginBottom: 24 },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.cardSubtle,
    borderWidth: 1, borderColor: c.line, borderRadius: 14, paddingHorizontal: 16, height: 56, marginBottom: 14,
  },
  input: { flex: 1, color: c.text, fontSize: 16, height: '100%' },
  error: { color: c.danger, fontSize: 13, marginBottom: 8 },
  footer: { alignItems: 'center', marginTop: 24 },
  footerText: { color: c.textSecondary, fontSize: 14 },
}));
