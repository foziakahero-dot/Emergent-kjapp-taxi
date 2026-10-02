import { FigmaGradient } from '@/src/components/FigmaGradient';
import { Text } from '@/src/components/Typography';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { paymentApi } from '@/src/lib/api';
import { Icon } from '@/src/components/Icon';
import { colors, font, makeStyles } from '@/src/theme';

export default function Wallet() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const [methods, setMethods] = useState<any[]>([]);

  useFocusEffect(useCallback(() => {
    let active = true;
    paymentApi.list().then((r) => {
      if (active) setMethods(Array.isArray(r) ? r : (r?.payment_methods || []));
    }).catch(() => {});
    return () => { active = false; };
  }, []));

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingTop: insets.top + 56, paddingHorizontal: 28, paddingBottom: insets.bottom + 112 }}>
      <Text style={s.title}>Lommebok</Text>

      <FigmaGradient angle={135} colors={['#FF3B3B', '#B30000']} style={s.creditCard}>
        <Text style={s.creditEyebrow}>KJAPP-KREDITT</Text>
        <Text style={s.creditTitle}>Kommer snart</Text>
        <Text style={s.creditSub}>Kreditt og verving er ikke aktivert i beta.</Text>
      </FigmaGradient>

      <View style={s.list}>
        {methods.map((m, i) => (
          <Pressable key={m.id || i} style={s.methodRow} onPress={() => router.push('/payment-methods')}>
            <View style={s.methodIcon}><Icon name="card" size={19} color={colors.textSecondary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.methodTitle}>{m.type === 'vipps' ? 'Vipps' : (m.label || 'Betalingskort')}</Text>
              <Text style={s.methodSub}>{m.last4 ? `•• ${m.last4}` : 'Koblet betalingsmåte'}</Text>
            </View>
            {m.is_default ? <Text style={s.activePill}>Aktiv</Text> : null}
          </Pressable>
        ))}

        <Pressable style={s.methodRow} onPress={() => router.push('/payment-methods')} testID="wallet-add-payment">
          <View style={s.methodIcon}><Icon name="plus" size={19} color={colors.accent} /></View>
          <View style={{ flex: 1 }}><Text style={s.methodTitle}>Legg til betalingsmåte</Text><Text style={s.methodSub}>Kort og støttede wallet-metoder</Text></View>
          <Icon name="chevron-right" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
    </ScrollView>
  );
}

const useStyles = makeStyles(c => ({
  screen: { flex: 1, backgroundColor: c.bg },
  title: { color: c.text, fontFamily: font.semibold, fontSize: 24, letterSpacing: -0.5 },
  creditCard: { marginTop: 24, borderRadius: 24, padding: 20, backgroundColor: c.accent },
  creditEyebrow: { color: 'rgba(255,255,255,0.78)', fontFamily: font.mono, fontSize: 10, letterSpacing: 1.7 },
  creditTitle: { color: c.accentOn, fontFamily: font.semibold, fontSize: 27, marginTop: 8 },
  creditSub: { color: 'rgba(255,255,255,0.82)', fontSize: 12, marginTop: 4 },
  list: { gap: 12, marginTop: 12 },
  methodRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line },
  methodIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cardSubtle },
  methodTitle: { color: c.text, fontFamily: font.semibold, fontSize: 14 },
  methodSub: { color: c.textSecondary, fontSize: 12, lineHeight: 16, marginTop: 0 },
  activePill: { color: c.accentOn, fontFamily: font.semibold, fontSize: 10, backgroundColor: c.online, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
}));

