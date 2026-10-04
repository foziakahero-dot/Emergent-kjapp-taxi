import { DesignField } from '@/src/components/DesignField';
import { Rise } from '@/src/components/Motion';
import { Button } from '@/src/components/ui';
import { Text, TextInput } from '@/src/components/Typography';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, makeStyles } from '@/src/theme';
import { BrandBadge } from '@/src/components/BrandBadge';
import { Icon } from '@/src/components/Icon';
import { apiError } from '@/src/lib/format';
import { FigmaGradient as LinearGradient } from '@/src/components/FigmaGradient';

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
        setError('Denne kontoen er ikke en SNAR-sjåførkonto.');
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
      <LinearGradient colors={['#FFFFFF', '#F2F5FA']} style={s.bgGradient} pointerEvents="none" />
      <ScrollView contentContainerStyle={[s.wrap, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">

        <Rise style={s.identity}>
          <BrandBadge size={48} />
          <View>
            <Text style={s.eyebrow}>SNAR SJÅFØR</Text>
            <Text style={s.title}>Logg inn</Text>
          </View>
        </Rise>

        <Rise delay={60} style={s.form}>
          <DesignField label="E-post eller telefon" testID="driver-login-identifier" placeholder="deg@epost.no" autoCapitalize="none" value={identifier} onChangeText={setIdentifier} autoComplete="off" />
          <DesignField label="Passord" testID="driver-login-password" placeholder="••••••••" secureTextEntry={!show} value={password} onChangeText={setPassword} autoComplete="current-password"
            action={<Pressable onPress={() => setShow(v => !v)} style={s.fieldAction} testID="driver-login-toggle-password" accessibilityRole="button" accessibilityLabel={show ? 'Skjul passord' : 'Vis passord'}><Icon name={show ? 'eye-off' : 'eye'} size={18} color={colors.textMuted} /></Pressable>} />
        </Rise>

        {error ? <Text style={s.error} testID="driver-login-error">{error}</Text> : null}

        <Pressable onPress={submit} disabled={loading} testID="driver-login-submit" style={({ pressed }) => ({ marginTop: 32, transform: [{ scale: pressed ? 0.95 : 1 }] })}>
          <LinearGradient colors={loading ? [colors.lineStrong, colors.lineStrong] : ['#012A54', '#001F3F']} style={s.primaryButton}>
            <Text style={s.primaryButtonText}>{loading ? 'Logger inn…' : 'Logg inn'}</Text>
          </LinearGradient>
        </Pressable>

        <Pressable onPress={() => router.push('/forgot-password')} style={s.forgot} testID="driver-login-forgot-password">
          <Text style={s.forgotText}>Glemt passord?</Text>
        </Pressable>

        <View style={s.note}>
          <Text style={s.noteText}>Har du ikke fått tilgang? Sjåførkonto opprettes via invitasjon fra flåteeier.</Text>
          <Text style={s.helpText}>Trenger du hjelp?</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
    bgGradient: { ...StyleSheet.absoluteFill },
    wrap: { paddingHorizontal: 28, flexGrow: 1, backgroundColor: 'transparent' },
    identity: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 36 },
    eyebrow: { color: c.text, fontFamily: font.mono, fontSize: 10, letterSpacing: 2.8 },
    title: { fontFamily: font.semibold, fontSize: 24, color: c.text, marginTop: 2, letterSpacing: -0.5 },
    form: { gap: 16 },
    fieldAction: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    primaryButton: { minHeight: 52, borderRadius: 27, alignItems: 'center', justifyContent: 'center', shadowColor: c.text, shadowOpacity: 0.25, shadowRadius: 15, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
    primaryButtonText: { color: c.accentOn, fontFamily: font.semibold, fontSize: 14 },
    forgot: { minHeight: 20, alignSelf: 'center', justifyContent: 'center', marginTop: 20 },
    forgotText: { color: c.text, fontFamily: font.medium, fontSize: 14, lineHeight: 20 },
    error: { color: c.danger, fontSize: 13, lineHeight: 18, marginTop: 12 },
    note: { marginTop: 40, borderRadius: 16, padding: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line },
    noteText: { color: c.textSecondary, fontSize: 12, lineHeight: 18, textAlign: 'center' },
    helpText: { color: c.text, fontFamily: font.semibold, fontSize: 12, textAlign: 'center', marginTop: 8 }
}));



