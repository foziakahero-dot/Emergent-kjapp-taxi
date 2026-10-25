import { V10Entrance } from '@/src/components/V10Entrance';
import { Text } from '@/src/components/Typography';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, font, useColorTheme } from '@/src/theme';
import { V10Icon } from '@/src/components/V10Icon';
import { V10Action, V10Badge, V10Group, V10Header, V10Row, V10Screen, V10Section, V10State, v10 } from '@/src/components/V10UI';
import { FigmaGradient } from '@/src/components/FigmaGradient';
import { confirmedPaymentMethod } from '@/src/components/BookingPrimitives';
import { useAuth } from '@/src/context/AuthContext';
import { Loader } from '@/src/components/ui';
import { usePlatformWallet } from '@/src/lib/usePlatformWallet';
import { paymentApi } from '@/src/lib/api';
import { apiError } from '@/src/lib/format';

const CHECKOUT_ORIGIN = process.env.EXPO_PUBLIC_CHECKOUT_ORIGIN || 'https://kjappapp.no';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function PaymentMethods() {
  useColorTheme();
  const { setup, session_id } = useLocalSearchParams<{ setup?: string; session_id?: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const operation = useRef(false), handledSetup = useRef<string | null>(null), mounted = useRef(true), account = useRef(user?.id);
  account.current = user?.id;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const current = () => mounted.current && account.current === user?.id;
  const methodsKey = ['payment-methods', user?.id];

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: methodsKey, queryFn: paymentApi.list, enabled: !!user?.id });
  const { data: nativeConfig } = useQuery({ queryKey: ['native-payment-config'], queryFn: paymentApi.nativeConfig });
  const methods = data?.payment_methods || data?.methods || (Array.isArray(data) ? data : []);

  const verifySetup = async (sessionId: string) => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        const result = await paymentApi.cardSetupStatus(sessionId);
        if (result?.ready === true) {
          await qc.invalidateQueries({ queryKey: methodsKey });
          if (!current()) return;
          if (result?.verified === true) {
            setNotice('Kortet er verifisert og klart for SNAR-bestillinger.');
            setError('');
          } else {
            setError('Kortet ble ikke verifisert av Stripe. Prøv et annet kort.');
          }
          return;
        }
      } catch {}
      await sleep(1200);
    }
    if (current()) setError('Stripe-bekreftelsen er ikke klar ennå. Åpne betalingsmåter igjen om noen sekunder.');
  };

  useEffect(() => {
    if (setup === 'success' && session_id && handledSetup.current !== session_id && !operation.current) {
      handledSetup.current = session_id; operation.current = true; setBusy(true);
      void verifySetup(session_id).finally(() => { operation.current = false; if (current()) setBusy(false); });
    } else if (setup === 'cancel') {
      setNotice('Kortverifiseringen ble avbrutt. Ingen kortdata ble lagret.');
    }
  }, [setup, session_id]);

  const remove = async (id: string) => {
    if (operation.current) return;
    operation.current = true; setBusy(true); setError('');
    try {
      const confirmed = await paymentApi.remove(id);
      if (confirmed?.deleted !== true) throw new Error('Kortet ble ikke bekreftet fjernet.');
      await qc.invalidateQueries({ queryKey: methodsKey });
    } catch (error) { if (current()) setError(apiError(error)); }
    finally { operation.current = false; if (current()) setBusy(false); }
  };

  const addStripeCard = async () => {
    if (operation.current) return;
    operation.current = true; setBusy(true);
    setNotice('');
    setError('');
    try {
      const { checkout_url, session_id: stripeSessionId } = await paymentApi.cardSetup(CHECKOUT_ORIGIN);
      if (!checkout_url || !stripeSessionId) throw new Error('Stripe svarte uten verifiseringslenke.');

      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') window.location.assign(checkout_url);
        return;
      }

      await WebBrowser.openBrowserAsync(checkout_url);
      await verifySetup(stripeSessionId);
    } catch (e) {
      if (current()) setError(apiError(e));
    } finally {
      operation.current = false; if (current()) setBusy(false);
    }
  };

  const wallet = usePlatformWallet(user?.id, async () => { await qc.invalidateQueries({ queryKey: methodsKey }); if (current()) setNotice('Lommebokkortet er verifisert og valgt for neste tur.'); });
  const paymentBusy = busy || wallet.busy;
  const primary = !isError && confirmedPaymentMethod(methods);
  const others = methods.filter((method: any) => method.id !== primary?.id);
  const verified = (method: any) => confirmedPaymentMethod([method]) != null;
  const expiry = primary && Number.isInteger(primary.exp_month) && primary.exp_month >= 1 && primary.exp_month <= 12 && Number.isInteger(primary.exp_year) ? `${String(primary.exp_month).padStart(2, '0')}/${String(primary.exp_year).slice(-2)}` : null;
  const removeButton = (method: any) => <Pressable disabled={paymentBusy} onPress={() => void remove(method.id)} testID={`pm-remove-${method.id}`} accessibilityRole="button" accessibilityLabel={`Fjern ${method.label || 'betalingskort'} ${method.last4 || ''}`} accessibilityState={{ disabled: busy }} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><V10Icon name="x" size={18} color={colors.textMuted} /></Pressable>;
  return <V10Screen testID="payment-methods-screen"><V10Header title="Betalingsmåter" onBack={() => router.back()} /><V10Entrance>
    {isLoading ? <Loader /> : isError ? <V10State warning icon="wifiOff" title="Kunne ikke hente betalingsmåter" body="Dette betyr ikke at kortene dine er borte. Prøv å hente listen på nytt." action="Prøv igjen" onAction={() => void refetch()} /> : <>
      {notice ? <Text accessibilityLiveRegion="polite" testID="pm-notice" style={[v10.secondary, { marginBottom: 12, color: colors.success }]}>{notice}</Text> : null}
      {error || wallet.error ? <Text accessibilityRole="alert" testID="pm-error" style={[v10.secondary, { marginBottom: 12, color: colors.danger }]}>{error || wallet.error}</Text> : null}
      {primary ? <FigmaGradient angle={135} colors={['#0b1a2c', '#1c3350']} style={{ height: 180, borderRadius: 24, padding: 20, justifyContent: 'space-between', overflow: 'hidden', boxShadow: colors.elevation2 }} testID="payment-primary-card">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: '#fff', opacity: .7, fontSize: 13 }}>Kort for bestilling</Text><Text style={{ color: '#fff', fontFamily: font.bold, fontStyle: 'italic', fontSize: 20 }}>{String(primary.label || primary.type || 'Kort').toUpperCase()}</Text></View>
        <Text style={{ color: '#fff', fontFamily: font.medium, fontSize: 20, letterSpacing: 2.4, fontVariant: ['tabular-nums'] }}>•••• •••• •••• {primary.last4 || '—'}</Text><Text style={{ color: '#fff', opacity: .7, fontSize: 13 }}>{expiry ? `Utløper ${expiry}` : 'Verifisert av Stripe'}</Text>
      </FigmaGradient> : <V10State icon="payment" title="Ingen verifisert betalingsmåte" body="Legg til og verifiser et kort før du bestiller en tur." />}
      {primary ? <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}><V10Badge tone="positive">Verifisert</V10Badge>{removeButton(primary)}</View> : null}
      {others.length ? <V10Section title="Andre kort"><V10Group>{others.map((method: any, index: number) => <V10Row key={method.id} border={index > 0} icon="payment" title={`${method.label || method.type || 'Kort'}${method.last4 ? ` ·· ${method.last4}` : ''}`} subtitle={verified(method) ? 'Verifisert av Stripe' : 'Ikke verifisert · kan ikke reservere tur'} right={removeButton(method)} testID={`pm-${method.id}`} />)}</V10Group></V10Section> : null}
      <V10Section title="Betaling på enheten">{wallet.ready ? <V10Action testID="pm-wallet" label={wallet.kind === 'apple' ? 'Bruk Apple Pay' : 'Bruk Google Pay'} busy={wallet.busy} disabled={paymentBusy} onPress={() => void wallet.addWallet()} /> : null}<V10Group><V10Row icon="payment" title="Apple Pay og Google Pay" subtitle={nativeConfig?.enabled === true ? `Native betaling er konfigurert${nativeConfig.test_mode ? ' i testmodus' : ''}. Lommebok krever støtte på enheten.` : 'Ikke aktivert for denne appen.'} testID="wallet-native-status" /></V10Group></V10Section>
      <View style={{ marginTop: 16 }}><V10Action kind="soft" icon="plus" label="Legg til kort" onPress={() => void addStripeCard()} busy={busy} disabled={paymentBusy} testID="pm-stripe" /></View><Text style={[v10.caption, { marginTop: 12 }]}>Kortopplysninger håndteres av Stripe. SNAR lagrer ikke kortnummer eller CVC. Kort for neste tur bestemmes av det verifiserte standardkortet, eller det nyeste verifiserte kortet.</Text>
    </>}
  </V10Entrance></V10Screen>;
}
