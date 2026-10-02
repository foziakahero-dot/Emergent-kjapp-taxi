import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon } from '@/src/components/Icon';
import { KjappMark } from '@/src/components/KjappMark';
import { LinearGradient } from 'expo-linear-gradient';
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
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!fullName.trim() || !email.trim() || password.length < 8) {
      setError('Fyll inn navn, e-post og passord (minst 8 tegn).');
      return;
    }
    if (!acceptedTerms) {
      setError('Du må godta vilkår og personvern før kontoen opprettes.');
      return;
    }
    setLoading(true);
    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        accepted_terms: true,
        legal_version: '2026-09',
      });
      router.replace('/profile-setup');
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={['#FFFFFF', '#F2F5FA']} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
      <ScrollView contentContainerStyle={[s.wrap, { paddingTop: insets.top + 26, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={s.backLink} testID="register-back" accessibilityRole="button" accessibilityLabel="Tilbake">
          <Text style={s.backLinkText}>‹  Tilbake</Text>
        </Pressable>

        <KjappMark size={44} />
        <Text style={s.title}>Opprett konto</Text>
        <Text style={s.sub}>Kom i gang på under ett minutt.</Text>

        <View style={s.form}>
          <Field label="FULLT NAVN" placeholder="Ola Nordmann" value={fullName} onChangeText={setFullName} testID="register-name" s={s} autoComplete="name" />
          <Field label="E-POST" placeholder="deg@epost.no" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" testID="register-email" s={s} autoComplete="email" />
          <Field label="TELEFON" placeholder="+47 000 00 000" value={phone} onChangeText={setPhone} keyboardType="phone-pad" testID="register-phone" s={s} autoComplete="tel" />
          <View>
            <Text style={s.fieldLabel}>PASSORD</Text>
            <View style={s.field}>
              <TextInput
                placeholder="Minst 8 tegn"
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
        </View>

        <Pressable style={s.consentRow} onPress={() => setAcceptedTerms((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: acceptedTerms }} testID="register-legal-consent">
          <View style={[s.checkbox, acceptedTerms && s.checkboxOn]}><Text style={s.checkmark}>{acceptedTerms ? '✓' : ''}</Text></View>
          <Text style={s.consentText}>
            Jeg godtar KJAPPs <Text style={s.consentLink} onPress={() => Linking.openURL('https://kjappapp.no/vilkar')}>vilkår</Text> og <Text style={s.consentLink} onPress={() => Linking.openURL('https://kjappapp.no/personvern')}>personvernerklæring</Text>.
          </Text>
        </Pressable>

        {error ? <Text style={s.error} testID="register-error">{error}</Text> : null}

        <Pressable onPress={submit} disabled={!acceptedTerms || loading} testID="register-submit" style={{ marginTop: 18 }}>
          <LinearGradient colors={!acceptedTerms || loading ? [colors.lineStrong, colors.lineStrong] : ['#FF3B3B', '#FF0000']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primaryButton}>
            <Text style={s.primaryButtonText}>{loading ? 'Oppretter…' : 'Opprett konto'}</Text>
          </LinearGradient>
        </Pressable>

        <Pressable onPress={() => router.replace('/login')} style={s.footer} testID="register-to-login">
          <Text style={s.footerText}>Har du allerede konto? <Text style={s.footerLink}>Logg inn</Text></Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, s, ...props }: any) {
  return (
    <View>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.field}>
        <TextInput placeholderTextColor={colors.textMuted} style={s.input} {...props} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { paddingHorizontal: 28, flexGrow: 1, backgroundColor: 'transparent' },
  backLink: { minHeight: 40, alignSelf: 'flex-start', justifyContent: 'center', marginBottom: 18 },
  backLinkText: { color: c.textSecondary, fontFamily: font.medium, fontSize: 14 },
  title: { fontFamily: font.semibold, fontSize: 24, color: c.text, marginTop: 20, letterSpacing: -0.5 },
  sub: { color: c.textSecondary, fontFamily: font.body, fontSize: 14, lineHeight: 20, marginTop: 5, marginBottom: 26 },
  form: { gap: 16 },
  fieldLabel: { color: c.textMuted, fontFamily: font.mono, fontSize: 10, letterSpacing: 1.9, marginBottom: 8 },
  field: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.lineStrong, borderRadius: 16, paddingLeft: 16, paddingRight: 6, height: 52 },
  input: { flex: 1, color: c.text, fontFamily: font.body, fontSize: 15, height: '100%' },
  fieldAction: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 18, minHeight: 44 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 1, borderColor: c.lineStrong, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxOn: { backgroundColor: c.online, borderColor: c.online },
  checkmark: { color: c.accentOn, fontSize: 14, fontWeight: '800' },
  consentText: { color: c.textSecondary, fontSize: 12, lineHeight: 18, flex: 1 },
  consentLink: { color: c.text, fontFamily: font.semibold },
  error: { color: c.danger, fontSize: 13, lineHeight: 18, marginTop: 9 },
  primaryButton: { minHeight: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: c.accent, shadowOpacity: 0.3, shadowRadius: 15, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  primaryButtonText: { color: c.accentOn, fontFamily: font.semibold, fontSize: 14 },
  footer: { minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  footerText: { color: c.textSecondary, fontSize: 14 },
  footerLink: { color: c.accent, fontFamily: font.semibold },
}));

