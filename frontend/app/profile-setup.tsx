import { Text } from '@/src/components/Typography';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { KjappMark } from '@/src/components/KjappMark';
import { Icon } from '@/src/components/Icon';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, makeStyles } from '@/src/theme';

export default function ProfileSetup() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const s = useStyles();

  return (
    <View style={s.screen}>
      <LinearGradient colors={['#FFFFFF', '#F2F5FA']} style={StyleSheet.absoluteFill} />
      <View style={[s.content, { paddingTop: insets.top + 44, paddingBottom: insets.bottom + 24 }]}>
        <KjappMark size={44} />
        <Text style={s.title}>Sett opp profilen</Text>
        <Text style={s.sub}>Så vi kan gjøre hver tur raskere for deg.</Text>

        <View style={s.section}>
          <Text style={s.label}>NAVN</Text>
          <View style={s.readonlyField}><Text style={s.valueText}>{user?.fullName || 'KJAPP-kunde'}</Text></View>
        </View>

        <View style={s.section}>
          <Text style={s.label}>BETALINGSMÅTE</Text>
          <Pressable style={s.actionCard} onPress={() => router.push('/payment-methods')} testID="setup-payment">
            <View style={s.actionIcon}><Icon name="card" size={20} color={colors.accent} /></View>
            <View style={{ flex: 1 }}><Text style={s.actionTitle}>Velg betalingsmåte</Text><Text style={s.actionSub}>Kort, Apple Pay / Google Pay når aktivert</Text></View>
            <Icon name="chevron-right" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={s.section}>
          <Text style={s.label}>FASTE ADRESSER</Text>
          <Pressable style={s.actionCard} onPress={() => router.push('/saved-places')} testID="setup-places">
            <View style={s.actionIcon}><Icon name="home" size={20} color={colors.accent} /></View>
            <View style={{ flex: 1 }}><Text style={s.actionTitle}>Hjem og jobb</Text><Text style={s.actionSub}>Legg til hjem og jobb</Text></View>
            <Icon name="chevron-right" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        <Pressable onPress={() => router.replace('/(app)/home')} testID="setup-finish" style={{ marginTop: 'auto' }}>
          <LinearGradient colors={['#FF3B3B', '#FF0000']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primary}>
            <Text style={s.primaryText}>Fullfør</Text>
          </LinearGradient>
        </Pressable>
        <Pressable onPress={() => router.replace('/(app)/home')} style={s.skip} testID="setup-skip"><Text style={s.skipText}>Hopp over for nå</Text></Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles(c => ({
  screen: { flex: 1, backgroundColor: c.bg },
  content: { flex: 1, paddingHorizontal: 28 },
  title: { color: c.text, fontFamily: font.semibold, fontSize: 24, letterSpacing: -0.5, marginTop: 24 },
  sub: { color: c.textSecondary, fontSize: 14, marginTop: 5 },
  section: { marginTop: 24 },
  label: { color: c.textMuted, fontFamily: font.mono, fontSize: 10, letterSpacing: 1.9, marginBottom: 8 },
  readonlyField: { minHeight: 52, justifyContent: 'center', borderRadius: 16, paddingHorizontal: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.lineStrong },
  valueText: { color: c.text, fontFamily: font.medium, fontSize: 15 },
  actionCard: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, paddingHorizontal: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.lineStrong },
  actionIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentSoft },
  actionTitle: { color: c.text, fontFamily: font.semibold, fontSize: 14 },
  actionSub: { color: c.textSecondary, fontSize: 11.5, marginTop: 3 },
  primary: { minHeight: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: c.accent, shadowOpacity: 0.3, shadowRadius: 15, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  primaryText: { color: c.accentOn, fontFamily: font.semibold, fontSize: 14 },
  skip: { minHeight: 40, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  skipText: { color: c.textSecondary, fontFamily: font.medium, fontSize: 12 },
}));


