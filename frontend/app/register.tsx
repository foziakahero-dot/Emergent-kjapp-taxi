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
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!fullName.trim() || !email.trim() || password.length < 10) {
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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[s.wrap, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} style={s.back} testID="register-back" accessibilityRole="button" accessibilityLabel="Tilbake">
          <Icon name="arrow-left" size={20} color={colors.text} />
        </Pressable>

        <View style={s.brandBlock}>
          <Text style={s.eyebrow}>KJAPP · PASSASJER</Text>
          <Text style={s.brand}>KJAPP</Text>
          <View style={s.brandLine} />
        </View>
        <Text style={s.title}>Opprett konto</Text>
        <Text style={s.sub}>Én konto for bestilling, live turstatus, betaling og kvitteringer.</Text>

        <View style={s.form}>
          <Field icon="user" placeholder="Fullt navn" value={fullName} onChangeText={setFullName} testID="register-name" s={s} autoComplete="name" />
          <Field icon="mail" placeholder="E-post" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" testID="register-email" s={s} autoComplete="email" />
          <Field icon="phone" placeholder="Telefon (valgfritt)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" testID="register-phone" s={s} autoComplete="tel" />
          <View style={s.field}>
            <Icon name="lock" size={18} color={colors.textMuted} />
            <TextInput
              placeholder="Passord"
              placeholderTextColor={colors.textMuted}
              style={s.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!show}
              autoComplete="new-password"
              testID="register-password"
            />
            <Pressable onPress={() => setShow((v) => !v)} style={s.fieldAction} testID="register-toggle-password" accessibilityRole="button" accessibilityLabel={show ? 'Skjul passord' : 'Vis passord'}>
              <Icon name={show ? 'eye-off' : 'eye'} size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>

        <Text style={s.passwordHint}>Minst 10 tegn. Du kan endre kontoinnstillinger senere.</Text>
        {error ? <Text style={s.error} testID="register-error">{error}</Text> : null}

        <Button label="Opprett konto" onPress={submit} loading={loading} testID="register-submit" style={{ marginTop: 12 }} />

        <View style={s.trustCard}>
          <Icon name="shield" size={18} color={colors.accent} />
          <Text style={s.trustText}>Kontoen brukes kun til KJAPP-tjenester og dine turdata.</Text>
        </View>

        <Pressable onPress={() => router.replace('/login')} style={s.footer} testID="register-to-login">
          <Text style={s.footerText}>Har du konto? <Text style={s.footerLink}>Logg inn</Text></Text>
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
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line, marginBottom: 28 },
  brandBlock: { alignSelf: 'flex-start' },
  eyebrow: { color: c.accent, fontFamily: font.bold, fontSize: 10, letterSpacing: 1.8 },
  brand: { fontFamily: font.bold, fontSize: 34, color: c.text, letterSpacing: 0.5, marginTop: 5 },
  brandLine: { width: 42, height: 3, borderRadius: 2, backgroundColor: c.accent, marginTop: 8 },
  title: { fontFamily: font.display, fontSize: 28, color: c.text, marginTop: 30 },
  sub: { color: c.textMuted, fontFamily: font.body, fontSize: 14, lineHeight: 20, marginTop: 7, marginBottom: 24 },
  form: { gap: 12 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 14, paddingLeft: 16, paddingRight: 6, height: 56 },
  input: { flex: 1, color: c.text, fontFamily: font.body, fontSize: 16, height: '100%' },
  fieldAction: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  passwordHint: { color: c.textMuted, fontSize: 11, lineHeight: 16, marginTop: 9 },
  error: { color: c.danger, fontSize: 13, lineHeight: 18, marginTop: 9 },
  trustCard: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line, borderRadius: 14, paddingHorizontal: 14, marginTop: 16 },
  trustText: { color: c.textMuted, fontSize: 11, lineHeight: 16, flex: 1 },
  footer: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  footerText: { color: c.textSecondary, fontSize: 14 },
  footerLink: { color: c.accent, fontFamily: font.semibold },
}));