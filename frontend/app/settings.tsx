import { V10Entrance } from '@/src/components/V10Entrance';
import { ThemeModeRow } from '@/src/components/ThemeModeRow';
import { LanguageRow } from '@/src/components/LanguageRow';
import { useTranslation } from '@/src/lib/customerLanguage';
import React,{useRef,useState} from 'react';
import {View} from 'react-native';
import {useRouter} from 'expo-router';
import {useAuth} from '@/src/context/AuthContext';
import {Text} from '@/src/components/Typography';
import {V10Action,V10Group,V10Header,V10Row,V10Screen,V10Section,v10} from '@/src/components/V10UI';
import { colors, useColorTheme } from '@/src/theme';
export default function Settings(){
  useColorTheme();
  const { t } = useTranslation();
  const router=useRouter();const{logout}=useAuth();const lock=useRef(false);const[busy,setBusy]=useState(false),[error,setError]=useState('');
  const signOut=async()=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await logout();router.replace('/');}catch{setError(t("Kunne ikke logge ut. Prøv igjen."));}finally{lock.current=false;setBusy(false);}};
  return <V10Screen dock testID="customer-settings-screen"><V10Header title={t("Innstillinger")} onBack={()=>router.back()}/><V10Entrance>
    <V10Group><ThemeModeRow/><LanguageRow border /></V10Group>
    <V10Section title={t("Turer")}><V10Group><V10Row icon="safety" title={t("Del tur")} subtitle={t("Del den aktive turen med noen du stoler på.")} onPress={() => router.push({ pathname: '/customer-trip-settings', params: { mode: 'share' } })} testID="settings-trip-share"/><V10Row border icon="inside" title={t("Henteinstruks")} subtitle={t("Gi sjåføren beskjed om at du venter inne.")} onPress={() => router.push({ pathname: '/customer-trip-settings', params: { mode: 'pickup' } })} testID="settings-pickup-instructions"/></V10Group></V10Section>
    <V10Section title={t("Personvern")}><V10Group><V10Row icon="lock" title={t("Data og personvern")} onPress={()=>router.push('/customer-data')} testID="settings-data"/><V10Row border icon="bell" title={t("Varsler")} onPress={()=>router.push('/customer-notifications')} testID="settings-notifications"/></V10Group></V10Section>
    <V10Section title={t("Konto")}><V10Group><V10Row icon="user" title={t("Konto og profil")} onPress={()=>router.push('/customer-account')} testID="settings-account"/><V10Row border icon="text" title={t("Tilgjengelighet")} onPress={()=>router.push('/customer-accessibility')}/></V10Group></V10Section>
    <View style={{marginTop:16}}><V10Action kind="ghost" label={t("Logg ut")} onPress={()=>void signOut()} busy={busy} testID="settings-logout"/></View>{error?<Text accessibilityRole="alert" style={[v10.secondary,{color:colors.danger}]}>{error}</Text>:null}
  </V10Entrance></V10Screen>;
}
