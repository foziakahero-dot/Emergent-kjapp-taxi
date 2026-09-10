import React, { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon } from '@/src/components/Icon';
import { Button, Loader } from '@/src/components/ui';
import { paymentApi } from '@/src/lib/api';

const TYPES: { type: 'visa' | 'mastercard' | 'vipps'; label: string }[] = [
  { type: 'visa', label: 'Visa' },
  { type: 'mastercard', label: 'Mastercard' },
  { type: 'vipps', label: 'Vipps' },
];

export default function PaymentMethods() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const router = useRouter();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState<'visa' | 'mastercard' | 'vipps'>('visa');
  const [last4, setLast4] = useState('');
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ['payment-methods'], queryFn: paymentApi.list });
  const methods = data?.payment_methods || data?.methods || (Array.isArray(data) ? data : []);

  const add = async () => {
    if (last4.length < 4 && type !== 'vipps') return;
    setBusy(true);
    try {
      const label = TYPES.find((t) => t.type === type)!.label;
      await paymentApi.add({ type, label, last4: type === 'vipps' ? '0000' : last4.slice(-4), is_default: methods.length === 0 });
      await qc.invalidateQueries({ queryKey: ['payment-methods'] });
      setAdding(false);
      setLast4('');
    } catch {}
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    try {
      await paymentApi.remove(id);
      await qc.invalidateQueries({ queryKey: ['payment-methods'] });
    } catch {}
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={s.back} testID="pm-back">
          <Icon name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text style={s.title}>Betalingsmåter</Text>
      </View>

      <View style={{ paddingHorizontal: 20 }}>
        {isLoading ? (
          <View style={{ paddingTop: 60 }}><Loader /></View>
        ) : (
          <>
            {methods.map((m: any) => (
              <View key={m.id} style={s.card} testID={`pm-${m.id}`}>
                <View style={s.cardIcon}><Icon name={m.type === 'vipps' ? 'wallet' : 'card'} size={20} color={colors.accent} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardLabel}>{m.label}</Text>
                  <Text style={s.cardSub}>{m.type === 'vipps' ? 'Vipps' : `•••• ${m.last4}`}{m.is_default ? ' · Standard' : ''}</Text>
                </View>
                {m.verified !== false ? <View style={s.verified}><Text style={s.verifiedText}>Verifisert</Text></View> : null}
                <Pressable onPress={() => remove(m.id)} testID={`pm-remove-${m.id}`} style={{ padding: 6 }}>
                  <Icon name="x" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            ))}

            {!methods.length ? (
              <Text style={s.empty}>Legg til en betalingsmåte for å kunne bestille turer.</Text>
            ) : null}

            {adding ? (
              <View style={s.addBox}>
                <View style={s.typeRow}>
                  {TYPES.map((t) => (
                    <Pressable key={t.type} onPress={() => setType(t.type)} style={[s.typeChip, type === t.type && s.typeChipActive]} testID={`pm-type-${t.type}`}>
                      <Text style={[s.typeChipText, type === t.type && { color: colors.accent }]}>{t.label}</Text>
                    </Pressable>
                  ))}
                </View>
                {type !== 'vipps' ? (
                  <TextInput
                    testID="pm-last4"
                    placeholder="Siste 4 sifre"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={4}
                    value={last4}
                    onChangeText={setLast4}
                    style={s.input}
                  />
                ) : null}
                <Button label="Lagre" onPress={add} loading={busy} testID="pm-save" style={{ marginTop: 12 }} />
              </View>
            ) : (
              <Pressable style={s.addBtn} onPress={() => setAdding(true)} testID="pm-add">
                <Icon name="plus" size={18} color={colors.accent} />
                <Text style={s.addText}>Legg til betalingsmåte</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  header: { paddingHorizontal: 20, paddingBottom: 16, gap: 16 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line },
  title: { fontFamily: font.display, fontSize: 26, color: c.text },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 14, marginBottom: 12 },
  cardIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.cardSubtle, alignItems: 'center', justifyContent: 'center' },
  cardLabel: { color: c.text, fontSize: 15, fontWeight: '600' },
  cardSub: { color: c.textMuted, fontSize: 13, marginTop: 2, fontFamily: font.mono },
  verified: { backgroundColor: c.onlineSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  verifiedText: { color: c.online, fontSize: 11 },
  empty: { color: c.textMuted, fontSize: 14, marginVertical: 16, lineHeight: 20 },
  addBox: { backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 16, marginTop: 8 },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeChip: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line },
  typeChipActive: { borderColor: c.accent, backgroundColor: c.accentSoft },
  typeChipText: { color: c.textSecondary, fontSize: 14 },
  input: { marginTop: 12, backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingHorizontal: 16, height: 52, color: c.text, fontSize: 16, fontFamily: font.mono },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 16, borderWidth: 1, borderColor: c.line, borderStyle: 'dashed', marginTop: 8 },
  addText: { color: c.accent, fontSize: 15, fontWeight: '600' },
}));
