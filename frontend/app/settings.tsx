import { ThemeModeRow } from '@/src/components/ThemeModeRow';
import React,{useRef,useState} from 'react';
import {View} from 'react-native';
import {useRouter} from 'expo-router';
import {useAuth} from '@/src/context/AuthContext';
import {Text} from '@/src/components/Typography';
import {V10Action,V10Group,V10Header,V10Row,V10Screen,V10Section,v10} from '@/src/components/V10UI';
import { colors, useColorTheme } from '@/src/theme';
export default function Settings(){
  useColorTheme();
  const router=useRouter();const{logout}=useAuth();const lock=useRef(false);const[busy,setBusy]=useState(false),[error,setError]=useState('');
  const signOut=async()=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await logout();router.replace('/');}catch{setError('Kunne ikke logge ut. Prøv igjen.');}finally{lock.current=false;setBusy(false);}};
  return <V10Screen testID="customer-settings-screen"><V10Header title="Innstillinger" onBack={()=>router.back()}/>
    <V10Group><ThemeModeRow/><V10Row border icon="globe" title="Språk" subtitle="Appens tekst er på norsk bokmål." right={<Text style={v10.secondary}>Norsk</Text>}/></V10Group>
    <V10Section title="Turer"><V10Group><V10Row icon="safety" title="Del tur" subtitle="Du kan dele en aktiv tur fra turens sikkerhetsvalg."/><V10Row border icon="inside" title="Henteinstruks" subtitle="Velg «jeg venter inne» når en sjåfør er på vei."/></V10Group></V10Section>
    <V10Section title="Personvern"><V10Group><V10Row icon="lock" title="Data og personvern" onPress={()=>router.push('/customer-data')} testID="settings-data"/><V10Row border icon="bell" title="Varsler" onPress={()=>router.push('/customer-notifications')} testID="settings-notifications"/></V10Group></V10Section>
    <V10Section title="Konto"><V10Group><V10Row icon="user" title="Konto og profil" onPress={()=>router.push('/customer-account')} testID="settings-account"/><V10Row border icon="text" title="Tilgjengelighet" onPress={()=>router.push('/customer-accessibility')}/></V10Group></V10Section>
    <View style={{marginTop:16}}><V10Action kind="ghost" label="Logg ut" onPress={()=>void signOut()} busy={busy} testID="settings-logout"/></View>{error?<Text accessibilityRole="alert" style={[v10.secondary,{color:colors.danger}]}>{error}</Text>:null}
  </V10Screen>;
}
