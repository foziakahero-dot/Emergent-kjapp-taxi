import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { LinearGradient } from 'expo-linear-gradient';
import { KjappMark } from '@/src/components/KjappMark';
import { Icon } from '@/src/components/Icon';
import { colors, font, makeStyles } from '@/src/theme';

export default function Permissions() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const [locationOn, setLocationOn] = useState(true);
  const [notificationsOn, setNotificationsOn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const continueFlow = async () => {
    setBusy(true);
    setError('');
    try {
      if (locationOn) await Location.requestForegroundPermissionsAsync();
      if (notificationsOn) await Notifications.requestPermissionsAsync();
      router.replace('/login');
    } catch {
      setError('Kunne ikke åpne alle systemtillatelsene. Du kan endre dem senere i Innstillinger.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.screen}>
      <LinearGradient colors={['#FFFFFF', '#F2F5FA']} style={StyleSheet.absoluteFillObject} />
      <View style={[s.content, { paddingTop: insets.top + 44, paddingBottom: insets.bottom + 24 }]}>
        <KjappMark size={44} />
        <Text style={s.title}>Noen få tillatelser</Text>
        <Text style={s.sub}>Vi trenger disse for en trygg og rask opplevelse.</Text>

        <View style={s.rows}>
          <PermissionRow icon="map-pin" title="Posisjon" sub="For å finne sjåfører i nærheten og vise hvor du er" value={locationOn} onPress={() => setLocationOn(v => !v)} s={s} />
          <PermissionRow icon="bell" title="Varsler" sub="Beskjed når sjåføren er på vei og har ankommet" value={notificationsOn} onPress={() => setNotificationsOn(v => !v)} s={s} />
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}

        <Pressable onPress={continueFlow} disabled={busy} testID="permissions-continue" style={{ marginTop: 'auto' }}>
          <LinearGradient colors={busy ? [colors.lineStrong, colors.lineStrong] : ['#FF3B3B', '#FF0000']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primary}>
            {busy ? <ActivityIndicator color={colors.accentOn} /> : <Text style={s.primaryText}>Tillat og fortsett</Text>}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function PermissionRow({ icon, title, sub, value, onPress, s }: any) {
  return (
    <View style={s.row}>
      <View style={s.rowIcon}><Icon name={icon} size={20} color={colors.accent} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle}>{title}</Text>
        <Text style={s.rowSub}>{sub}</Text>
      </View>
      <Pressable onPress={onPress} style={[s.toggle, value && s.toggleOn]} accessibilityRole="switch" accessibilityState={{ checked: value }}>
        <View style={[s.knob, value && s.knobOn]} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles(c => ({
  screen: { flex: 1, backgroundColor: c.bg },
  content: { flex: 1, paddingHorizontal: 28 },
  title: { color: c.text, fontFamily: font.semibold, fontSize: 24, letterSpacing: -0.5, marginTop: 24 },
  sub: { color: c.textSecondary, fontSize: 14, marginTop: 5 },
  rows: { gap: 12, marginTop: 30 },
  row: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line },
  rowIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentSoft },
  rowTitle: { color: c.text, fontFamily: font.semibold, fontSize: 14 },
  rowSub: { color: c.textSecondary, fontSize: 11.5, lineHeight: 16, marginTop: 3 },
  toggle: { width: 48, height: 28, borderRadius: 14, padding: 2, backgroundColor: c.lineStrong },
  toggleOn: { backgroundColor: c.accent },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: c.surface },
  knobOn: { marginLeft: 20 },
  primary: { minHeight: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: c.accent, shadowOpacity: 0.3, shadowRadius: 15, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  primaryText: { color: c.accentOn, fontFamily: font.semibold, fontSize: 14 },
  error: { color: c.danger, fontSize: 12, textAlign: 'center', marginTop: 12 },
}));
