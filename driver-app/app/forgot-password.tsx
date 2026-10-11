import { Text, TextInput } from '@/src/components/Typography';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authApi } from '@/src/lib/api';
import { apiError } from '@/src/lib/format';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon } from '@/src/components/Icon';
import { BrandBadge } from '@/src/components/BrandBadge';
import { LinearGradient } from 'expo-linear-gradient';

export default function DriverForgotPassword() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const value = email.trim();
    if (!value) return setError('Skriv inn e-postadressen din.');
    setBusy(true); setError('');
    try {
      await authApi.forgotPassword(value);
      setSent(true);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={['#F7F5F1','#F1EEE8']} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={[s.wrap,{paddingTop:insets.top+26,paddingBottom:insets.bottom+24}]}>
        <Pressable onPress={() => router.back()} style={s.backLink}><Text style={s.backLinkText}>‹  Tilbake</Text></Pressable>
        <View style={s.content}>
          {sent ? <>
            <View style={s.mailCircle}><Icon name="mail" size={24} color={colors.text} /></View>
            <Text style={s.title}>Sjekk e-posten din</Text>
            <Text style={s.sub}>Hvis sjåførkontoen finnes, har vi sendt en sikker lenke.</Text>
            <Pressable style={s.secondaryButton} onPress={() => router.replace('/driver-login')}><Text style={s.secondaryText}>Tilbake til innlogging</Text></Pressable>
          </> : <>
            <BrandBadge size={44} />
            <Text style={s.eyebrow}>SNAR SJÅFØR</Text>
            <Text style={s.title}>Glemt passord?</Text>
            <Text style={s.sub}>Skriv inn e-posten knyttet til sjåførkontoen.</Text>
            <Text style={s.fieldLabel}>E-POST</Text>
            <View style={s.field}><TextInput value={email} onChangeText={setEmail} placeholder="deg@epost.no" placeholderTextColor={colors.textMuted} autoCapitalize="none" autoComplete="email" keyboardType="email-address" style={s.input} testID="driver-forgot-email" /></View>
            {error ? <Text style={s.error}>{error}</Text> : null}
            <Pressable onPress={submit} disabled={busy} style={{marginTop:18}} testID="driver-forgot-submit">
              <LinearGradient colors={busy ? [colors.lineStrong,colors.lineStrong] : [colors.accent,colors.accentDim]} start={{x:0,y:0}} end={{x:1,y:0}} style={s.primaryButton}><Text style={s.primaryText}>{busy?'Sender…':'Send lenke'}</Text></LinearGradient>
            </Pressable>
          </>}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex:1, backgroundColor:c.driverBg },
  wrap: { flex:1, paddingHorizontal:28 },
  backLink: { minHeight:40, alignSelf:'flex-start', justifyContent:'center' },
  backLinkText: { color:c.textSecondary, fontFamily:font.medium, fontSize:14 },
  content: { flex:1, justifyContent:'center', paddingBottom:80 },
  eyebrow: { color:c.text, fontFamily:font.mono, fontSize:10, letterSpacing:2, marginTop:16 },
  title: { color:c.text, fontFamily:font.semibold, fontSize:26, letterSpacing:-0.6, marginTop:8 },
  sub: { color:c.textSecondary, fontSize:14, lineHeight:21, marginTop:8, marginBottom:24 },
  fieldLabel: { color:c.textMuted, fontFamily:font.mono, fontSize:10, letterSpacing:1.9, marginBottom:8 },
  field: { height:52, borderRadius:16, borderWidth:1, borderColor:c.lineStrong, backgroundColor:c.driverCard, paddingHorizontal:16, justifyContent:'center' },
  input: { color:c.text, fontFamily:font.body, fontSize:15, height:'100%' },
  error: { color:c.danger, fontSize:12, marginTop:10 },
  primaryButton: { minHeight:56, borderRadius:28, alignItems:'center', justifyContent:'center', shadowColor:c.text, shadowOpacity:0.22, shadowRadius:14, shadowOffset:{width:0,height:8}, elevation:6 },
  primaryText: { color:c.accentOn, fontFamily:font.semibold, fontSize:14 },
  mailCircle: { width:58, height:58, borderRadius:29, backgroundColor:c.cardSubtle, alignItems:'center', justifyContent:'center' },
  secondaryButton: { minHeight:50, paddingHorizontal:22, borderRadius:25, alignItems:'center', justifyContent:'center', backgroundColor:c.surface, borderWidth:1, borderColor:c.lineStrong },
  secondaryText: { color:c.text, fontFamily:font.semibold, fontSize:13 },
}));

