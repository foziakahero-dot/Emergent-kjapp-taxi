import React, { useCallback, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Text, TextInput } from '@/src/components/Typography';
import { Loader } from '@/src/components/ui';
import { V10Action, V10Group, V10Header, V10Screen, V10State, v10 } from '@/src/components/V10UI';
import { useAuth } from '@/src/context/AuthContext';
import { businessPaymentApi, paymentApi } from '@/src/lib/api';
import { apiError } from '@/src/lib/format';
import { paymentLabel } from '@/src/components/BookingPrimitives';
import { colors, useColorTheme } from '@/src/theme';

export default function BusinessBilling() {
  useColorTheme();
  const { user } = useAuth();
  const router = useRouter(), queryClient = useQueryClient();
  const profileKey = ['business-payment', user?.id];
  const profile = useQuery({ queryKey: profileKey, queryFn: businessPaymentApi.get, enabled: !!user?.id });
  const methods = useQuery({ queryKey: ['business-payment-methods', user?.id], queryFn: paymentApi.list, enabled: !!user?.id });
  useFocusEffect(useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['business-payment-methods', user?.id] });
  }, [queryClient, user?.id]));
  const [org, setOrg] = useState<string>();
  const [card, setCard] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const saving = useRef(false);
  const value = org ?? profile.data?.profile?.organisation_number ?? '';
  const selected = card ?? profile.data?.profile?.payment_method_id;
  const list = Array.isArray(methods.data) ? methods.data : methods.data?.payment_methods || methods.data?.methods || [];
  const cards = list.filter((method: any) => !method.wallet && method.verified === true && method.setup_status === 'succeeded' && typeof method.id === 'string');
  const canSave = /^\d{9}$/.test(value) && cards.some((method: any) => method.id === selected);
  const save = async () => {
    if (!canSave || saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try {
      const result = await businessPaymentApi.save(value, selected);
      if (result?.card_ready !== true || result?.profile?.organisation_number !== value || result?.profile?.payment_method_id !== selected) {
        throw new Error('Bedriftskortet ble ikke bekreftet.');
      }
      queryClient.setQueryData(profileKey, result);
      router.back();
    } catch (e) { setError(apiError(e)); }
    finally { saving.current = false; setBusy(false); }
  };
  return <V10Screen dock testID="business-billing-screen"><V10Header title="Bedriftskort" onBack={() => router.back()} />
    {profile.isPending || methods.isPending ? <Loader /> : profile.isError || methods.isError ? <V10State icon="wifiOff" warning
      title="Kunne ikke hente betalingsoppsettet" body="Sjekk forbindelsen og prøv igjen."
      action="Prøv igjen" onAction={() => { void profile.refetch(); void methods.refetch(); }} />
    : profile.data?.enabled !== true ? <V10State icon="work" title="Bedriftskort er utilgjengelig" body="Bruk en tilgjengelig betalingsmåte i bestillingen." />
    : <View style={{ gap: 12 }}>
      <Text style={v10.secondary}>Knytt et verifisert kort til jobbturer. Etter betaling får du en kvittering med bedriftens navn og organisasjonsnummer.</Text>
      <Text style={v10.body}>Organisasjonsnummer</Text>
      <TextInput accessibilityLabel="Organisasjonsnummer" keyboardType="number-pad" maxLength={9} value={value}
        onChangeText={text => setOrg(text.replace(/\D/g, ''))} placeholder="9 sifre" placeholderTextColor={colors.textMuted}
        style={[v10.body, { borderRadius: 12, paddingHorizontal: 12, minHeight: 48, backgroundColor: colors.cardSubtle }]} testID="business-org-number" />
      {profile.data?.profile?.organisation_number === value ? <Text style={v10.caption}>{profile.data.profile.company_name}</Text> : null}
      {cards.length ? <V10Group>{cards.map((method: any) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected === method.id }}
        key={method.id} onPress={() => setCard(method.id)} disabled={busy} style={{ padding: 14, minHeight: 46, backgroundColor: selected === method.id ? colors.accentSoft : colors.surface }}
        testID={`business-card-${method.id}`}><Text style={v10.body}>{paymentLabel(method)}</Text></Pressable>)}</V10Group>
        : <V10Action kind="soft" label="Legg til betalingskort" onPress={() => router.push('/payment-methods')} />}
      <V10Action label="Lagre bedriftskort" busy={busy} disabled={!canSave} onPress={() => void save()} testID="save-business-billing" />
      {error ? <Text accessibilityRole="alert" style={[v10.secondary, { color: colors.danger }]}>{error}</Text> : null}
    </View>}
  </V10Screen>;
}
