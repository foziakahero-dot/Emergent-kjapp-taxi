import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authApi } from '@/src/lib/api';
import { apiError } from '@/src/lib/format';
import { colors, font, makeStyles } from '@/src/theme';
import { Loader } from '@/src/components/ui';
import { Icon } from '@/src/components/Icon';
import { BrandBadge } from '@/src/components/BrandBadge';
import { LinearGradient } from 'expo-linear-gradient';

export default function DriverResetPassword() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const [state, setState] = useState<'checking'|'form'|'invalid'|'done'>('checking');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const value = String(token || '');
    if (!value) { setState('invalid'); return; }
    authApi.checkResetToken(value).then(() => setState('form')).catch(() => setState('invalid'));
  }, [token]);

  const submit = async () => {
    setError('');
    if (password.length < 8) return setError('Passord må ha minst 8 tegn.');
    if (password !== again) return setError('Passordene er ikke like.');
    setBusy(true);
    try {
      await authApi.resetPassword(String(token), password);
      setState('done');
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={['#FFFFFF','#F2F5FA']} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={[s.wrap,{paddingTop:insets.top+26,paddingBottom:insets.bottom+24}]}>
        <Pressable onPress={() => router.replace('/driver-login')} style={s.backLink}><Text style={s.backLinkText}>‹  Til innlogging</Text></Pressable>
        <View style={s.content}>
          {state==='checking' ? <Loader /> : null}
          {state==='invalid' ? <>
            <BrandBadge size={44} /><Text style={s.title}>Lenken virker ikke</Text><Text style={s.sub}>Lenken er ugyldig eller utløpt.</Text>
            <Pressable style={s.secondaryButton} onPress={() => router.replace('/forgot-password')}><Text style={s.secondaryText}>Be om ny lenke</Text></Pressable>
          </> : null}
          {state==='form' ? <>
            <BrandBadge size={44} /><Text style={s.eyebrow}>KJAPP SJÅFØR</Text><Text style={s.title}>Velg nytt passord</Text><Text style={s.sub}>Det nye passordet gjelder straks.</Text>
            <Text style={s.fieldLabel}>NYTT PASSORD</Text><View style={s.field}><TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Minst 8 tegn" placeholderTextColor={colors.textMuted} autoComplete="new-password" style={s.input}/></View>
            <Text style={[s.fieldLabel,{marginTop:16}]}>GJENTA PASSORD</Text><View style={s.field}><TextInput value={again} onChangeText={setAgain} secureTextEntry placeholder="Gjenta passord" placeholderTextColor={colors.textMuted} autoComplete="new-password" style={s.input}/></View>
            {error ? <Text style={s.error}>{error}</Text> : null}
            <Pressable onPress={submit} disabled={busy} style={{marginTop:18}}><LinearGradient colors={busy?[colors.lineStrong,colors.lineStrong]:['#012A54','#001F3F']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.primaryButton}><Text style={s.primaryText}>{busy?'Lagrer…':'Lagre nytt passord'}</Text></LinearGradient></Pressable>
          </> : null}
          {state==='done' ? <>
            <View style={s.doneCircle}><Icon name="check" size={24} color={colors.accentOn}/></View><Text style={s.title}>Passordet er endret</Text><Text style={s.sub}>Du kan nå logge inn i KJAPP Driver.</Text>
            <Pressable style={s.secondaryButton} onPress={() => router.replace('/driver-login')}><Text style={s.secondaryText}>Logg inn</Text></Pressable>
          </> : null}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  screen:{flex:1,backgroundColor:c.driverBg}, wrap:{flex:1,paddingHorizontal:28},
  backLink:{minHeight:40,alignSelf:'flex-start',justifyContent:'center'}, backLinkText:{color:c.textSecondary,fontFamily:font.medium,fontSize:14},
  content:{flex:1,justifyContent:'center',paddingBottom:80}, eyebrow:{color:c.text,fontFamily:font.mono,fontSize:10,letterSpacing:2,marginTop:16},
  title:{color:c.text,fontFamily:font.semibold,fontSize:26,letterSpacing:-0.6,marginTop:8}, sub:{color:c.textSecondary,fontSize:14,lineHeight:21,marginTop:8,marginBottom:24},
  fieldLabel:{color:c.textMuted,fontFamily:font.mono,fontSize:10,letterSpacing:1.9,marginBottom:8}, field:{height:52,borderRadius:16,borderWidth:1,borderColor:c.lineStrong,backgroundColor:c.driverCard,paddingHorizontal:16,justifyContent:'center'},
  input:{color:c.text,fontFamily:font.body,fontSize:15,height:'100%'}, error:{color:c.danger,fontSize:12,marginTop:10},
  primaryButton:{minHeight:56,borderRadius:28,alignItems:'center',justifyContent:'center',shadowColor:c.text,shadowOpacity:0.22,shadowRadius:14,shadowOffset:{width:0,height:8},elevation:6}, primaryText:{color:c.accentOn,fontFamily:font.semibold,fontSize:14},
  secondaryButton:{minHeight:50,paddingHorizontal:22,borderRadius:25,alignItems:'center',justifyContent:'center',backgroundColor:c.surface,borderWidth:1,borderColor:c.lineStrong}, secondaryText:{color:c.text,fontFamily:font.semibold,fontSize:13},
  doneCircle:{width:58,height:58,borderRadius:29,backgroundColor:c.online,alignItems:'center',justifyContent:'center'},
}));

