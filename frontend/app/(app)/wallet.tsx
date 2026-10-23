import { FigmaGradient } from '@/src/components/FigmaGradient';
import { Text } from '@/src/components/Typography';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { paymentApi, promoApi } from '@/src/lib/api';
import { kr } from '@/src/lib/format';
import { Icon } from '@/src/components/Icon';
import { colors, font, makeStyles, useColorTheme } from '@/src/theme';

export default function Wallet() {
  useColorTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const [methods, setMethods] = useState<any[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    paymentApi.list().then((r) => {
      if (active) setMethods(Array.isArray(r) ? r : (r?.payment_methods || []));
    }).catch(() => {});
    promoApi.wallet().then((r) => { if (active) setBalance(Number(r?.balance_kr || 0)); }).catch(() => {});
    return () => { active = false; };
  }, []));

  const redeem = async () => {
    const value = code.trim();
    if (value.length < 3 || redeeming) return;
    setRedeeming(true);
    setMessage(null);
    try {
      const r = await promoApi.redeem(value);
      setBalance(Number(r?.balance_kr || 0));
      setCode('');
      setMessage({ ok: true, text: `${kr(r.credit_kr)} er lagt til. Trekkes automatisk på neste tur.` });
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setMessage({ ok: false, text: typeof detail === 'string' ? detail : 'Kunne ikke bruke koden. Prøv igjen.' });
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingTop: insets.top + 56, paddingHorizontal: 28, paddingBottom: insets.bottom + 112 }}>
      <Text style={s.title}>Lommebok</Text>

      <FigmaGradient angle={135} colors={['#FF3B3B', '#B30000']} style={s.creditCard}>
        <Text style={s.creditEyebrow}>SNAR-KREDITT</Text>
        <Text style={s.creditTitle} testID="wallet-credit-balance">{balance == null ? '—' : kr(balance)}</Text>
        <Text style={s.creditSub}>Trekkes automatisk fra turprisen når du bestiller.</Text>
      </FigmaGradient>

      <View style={s.codeBox}>
        <Text style={s.methodTitle}>Kampanjekode</Text>
        <View style={s.codeRow}>
          <TextInput
            testID="wallet-promo-input"
            value={code}
            onChangeText={(t) => { setCode(t.toUpperCase()); setMessage(null); }}
            placeholder="F.eks. SNAR100"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={24}
            returnKeyType="done"
            onSubmitEditing={redeem}
            accessibilityLabel="Kampanjekode"
            style={s.codeInput}
          />
          <Pressable testID="wallet-promo-redeem" accessibilityRole="button" onPress={redeem}
            disabled={redeeming || code.trim().length < 3}
            style={[s.codeButton, (redeeming || code.trim().length < 3) && { opacity: 0.5 }]}>
            {redeeming ? <ActivityIndicator color={colors.accentOn} /> : <Text style={s.codeButtonText}>Bruk</Text>}
          </Pressable>
        </View>
        {message ? <Text accessibilityRole="alert" style={[s.methodSub, { marginTop: 8, color: message.ok ? colors.online : colors.accent }]}>{message.text}</Text> : null}
      </View>

      <View style={s.list}>
        {methods.map((m, i) => (
          <Pressable testID="customer-app-app-wallet-36" key={m.id || i} style={s.methodRow} onPress={() => router.push('/payment-methods')}>
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
  codeBox: { marginTop: 12, borderRadius: 16, padding: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line },
  codeRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  codeInput: { flex: 1, minHeight: 44, borderRadius: 12, paddingHorizontal: 14, backgroundColor: c.cardSubtle, color: c.text, fontFamily: font.mono, fontSize: 15, letterSpacing: 1 },
  codeButton: { minHeight: 44, minWidth: 72, borderRadius: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent },
  codeButtonText: { color: c.accentOn, fontFamily: font.semibold, fontSize: 14 },
  list: { gap: 12, marginTop: 12 },
  methodRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line },
  methodIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cardSubtle },
  methodTitle: { color: c.text, fontFamily: font.semibold, fontSize: 14 },
  methodSub: { color: c.textSecondary, fontSize: 12, lineHeight: 16, marginTop: 0 },
  activePill: { color: c.accentOn, fontFamily: font.semibold, fontSize: 10, backgroundColor: c.online, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
}));

