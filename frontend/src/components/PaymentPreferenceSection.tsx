import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './Typography';
import { V10Icon } from './V10Icon';
import { V10Group, V10Section, v10 } from './V10UI';
import { colors, font, useColorTheme } from '@/src/theme';
import { usePaymentPreference } from '@/src/lib/usePaymentPreference';
import type { PaymentChoice } from '@/src/lib/paymentPreference';

export function PaymentPreferenceSection({ userId, cashEnabled, cardEnabled, configReady, disabled: unavailable = false }: {
  userId?: string; cashEnabled: boolean; cardEnabled: boolean; configReady: boolean; disabled?: boolean;
}) {
  useColorTheme();
  const preference = usePaymentPreference(userId);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const mountedAccount = useRef(userId);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  mountedAccount.current = userId;
  const select = async (choice: PaymentChoice) => {
    if (lock.current || unavailable || !configReady || preference.pending || (choice === 'cash' ? !cashEnabled : !cardEnabled)) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      await preference.save(choice);
      if (mounted.current && mountedAccount.current === userId) setNotice(choice === 'cash' ? 'Kontant er valgt for neste tur.' : 'Kort er valgt for neste tur.');
    } catch {
      if (mounted.current && mountedAccount.current === userId) setError('Valget ble ikke lagret. Prøv igjen.');
    } finally { lock.current = false; if (mounted.current && mountedAccount.current === userId) setBusy(false); }
  };
  const option = (choice: PaymentChoice, title: string, subtitle: string, enabled: boolean) => {
    const selected = preference.choice === choice;
    const disabled = busy || unavailable || preference.pending || !configReady || !enabled;
    return <Pressable testID={`payment-preference-${choice}`} accessibilityRole="radio"
      accessibilityLabel={`${title}. ${subtitle}`} accessibilityState={{ checked: selected, disabled }} disabled={disabled}
      onPress={() => void select(choice)} style={{ minHeight: 76, paddingHorizontal: 16, paddingVertical: 12,
        flexDirection: 'row', gap: 12, alignItems: 'center', opacity: disabled ? .55 : 1,
        borderTopWidth: choice === 'cash' ? 1 : 0, borderColor: colors.line }}>
      <V10Icon name={choice === 'cash' ? 'cash' : 'payment'} size={24} color={selected ? colors.accent : colors.textSecondary} />
      <View style={{ flex: 1 }}><Text style={{ fontFamily: font.semibold, fontSize: 16 }}>{title}</Text>
        <Text style={[v10.caption, { marginTop: 3 }]}>{subtitle}</Text></View>
      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: selected ? 7 : 1.5,
        borderColor: selected ? colors.accent : colors.lineStrong }} />
    </Pressable>;
  };
  return <V10Section title="Foretrukket betaling">
    <V10Group>
      {option('card', 'Kort og digital lommebok', cardEnabled ? 'Bruk verifisert standardkort eller lagret lommebok' : 'Kortbetaling er ikke tilgjengelig nå', cardEnabled)}
      {option('cash', 'Kontant', !configReady ? 'Henter tilgjengelighet…' : cashEnabled ? 'Betal direkte til sjåføren etter turen' : 'Kontantbetaling er ikke tilgjengelig nå', cashEnabled)}
    </V10Group>
    <Text style={[v10.caption, { marginTop: 10 }]}>Lagres på denne enheten for kontoen din. Du kan endre betalingsmåte før hver bestilling.</Text>
    {preference.failed || error ? <Text testID="payment-preference-error" accessibilityRole="alert" style={[v10.secondary, { marginTop: 8, color: colors.danger }]}>{error || 'Kunne ikke hente lagret betalingsvalg. Velg på nytt.'}</Text> : null}
    {notice ? <Text testID="payment-preference-notice" accessibilityLiveRegion="polite" style={[v10.secondary, { marginTop: 8, color: colors.success }]}>{notice}</Text> : null}
  </V10Section>;
}
