import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon } from '@/src/components/Icon';
import { Loader } from '@/src/components/ui';
import { paymentApi } from '@/src/lib/api';
import { apiError } from '@/src/lib/format';

const CHECKOUT_ORIGIN = process.env.EXPO_PUBLIC_CHECKOUT_ORIGIN || 'https://kjappapp.no';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function PaymentMethods() {
  const { setup, session_id } = useLocalSearchParams<{ setup?: string; session_id?: string }>();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const router = useRouter();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['payment-methods'], queryFn: paymentApi.list });
  const methods = data?.payment_methods || data?.methods || (Array.isArray(data) ? data : []);

  const verifySetup = async (sessionId: string) => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        const result = await paymentApi.cardSetupStatus(sessionId);
        if (result?.ready) {
          await qc.invalidateQueries({ queryKey: ['payment-methods'] });
          if (result?.verified) {
            setNotice('Kortet er verifisert og klart for KJAPP-bestillinger.');
            setError('');
          } else {
            setError('Kortet ble ikke verifisert av Stripe. Prøv et annet kort.');
          }
          return;
        }
      } catch {}
      await sleep(1200);
    }
    setError('Stripe-bekreftelsen er ikke klar ennå. Åpne betalingsmåter igjen om noen sekunder.');
  };

  useEffect(() => {
    if (setup === 'success' && session_id) {
      setBusy(true);
      verifySetup(session_id).finally(() => setBusy(false));
    } else if (setup === 'cancel') {
      setNotice('Kortverifiseringen ble avbrutt. Ingen kortdata ble lagret.');
    }
  }, [setup, session_id]);

  const remove = async (id: string) => {
    setError('');
    try {
      await paymentApi.remove(id);
      await qc.invalidateQueries({ queryKey: ['payment-methods'] });
    } catch (e) {
      setError(apiError(e));
    }
  };

  const addStripeCard = async () => {
    if (busy) return;
    setBusy(true);
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
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={s.back} testID="pm-back" accessibilityRole="button" accessibilityLabel="Tilbake">
          <Icon name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text style={s.title}>Betalingsmåter</Text>
      </View>

      <View style={{ paddingHorizontal: 20 }}>
        {isLoading ? (
          <View style={{ paddingTop: 60 }}><Loader /></View>
        ) : isError ? (
          <View style={s.loadError} testID="pm-load-error">
            <View style={s.loadErrorIcon}><Icon name="card" size={22} color={colors.accent} /></View>
            <Text style={s.loadErrorTitle}>Kunne ikke hente betalingsmåter</Text>
            <Text style={s.loadErrorSub}>Dette betyr ikke at kortene dine er borte. Prøv å hente listen på nytt.</Text>
            <Pressable style={s.retryBtn} onPress={() => refetch()} testID="pm-retry">
              <Text style={s.retryBtnText}>Prøv igjen</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {notice ? (
              <View style={s.notice} testID="pm-notice">
                <Icon name="check" size={17} color={colors.online} />
                <Text style={s.noticeText}>{notice}</Text>
              </View>
            ) : null}

            {error ? <Text style={s.error} testID="pm-error">{error}</Text> : null}

            {methods.map((m: any) => {
              const verified = m.verified !== false;
              return (
                <View key={m.id} style={s.card} testID={`pm-${m.id}`}>
                  <View style={s.cardIcon}><Icon name={m.type === 'vipps' ? 'wallet' : 'card'} size={20} color={colors.accent} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardLabel}>{m.label || (m.type === 'vipps' ? 'Vipps' : 'Kort')}</Text>
                    <Text style={s.cardSub}>{m.type === 'vipps' ? 'Vipps' : `•••• ${m.last4 || '—'}`}{m.is_default ? ' · Standard' : ''}</Text>
                  </View>
                  <View style={verified ? s.verified : s.unverified}>
                    <Text style={verified ? s.verifiedText : s.unverifiedText}>{verified ? 'Verifisert' : 'Ikke verifisert'}</Text>
                  </View>
                  <Pressable onPress={() => remove(m.id)} testID={`pm-remove-${m.id}`} style={s.removeBtn} accessibilityRole="button" accessibilityLabel="Fjern betalingsmåte">
                    <Icon name="x" size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
              );
            })}

            {!methods.length ? (
              <View style={s.emptyCard}>
                <Icon name="card" size={24} color={colors.accent} />
                <Text style={s.emptyTitle}>Ingen verifisert betalingsmåte</Text>
                <Text style={s.empty}>Legg til et kort via Stripe før du bestiller din første tur. Når automatisk betaling aktiveres for betaen, kan avtalt turbeløp belastes etter fullført tur.</Text>
              </View>
            ) : null}

            <Pressable style={[s.stripeBtn, busy && { opacity: 0.65 }]} onPress={addStripeCard} disabled={busy} testID="pm-stripe">
              {busy ? <ActivityIndicator color={colors.accentOn} /> : <Icon name="lock" size={16} color={colors.accentOn} />}
              <Text style={s.stripeText}>{busy ? 'Bekrefter…' : 'Legg til og verifiser kort'}</Text>
            </Pressable>

            <View style={s.securityNote}>
              <Icon name="shield" size={15} color={colors.online} />
              <Text style={s.note}>Kortopplysninger håndteres av Stripe. KJAPP lagrer ikke kortnummer eller CVC. Hvis automatisk betaling er aktivert, forsøker KJAPP å belaste det avtalte turbeløpet når turen er ferdig; hvis banken krever ny godkjenning, får du beskjed og kan betale fra kvitteringen.</Text>
            </View>
            <Text style={s.vippsNote}>Vipps aktiveres først når produksjonsintegrasjonen er konfigurert og verifisert.</Text>
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
  loadError: { alignItems: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 18, padding: 22, marginTop: 12 },
  loadErrorIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' },
  loadErrorTitle: { color: c.text, fontFamily: font.semibold, fontSize: 15, marginTop: 12, textAlign: 'center' },
  loadErrorSub: { color: c.textMuted, fontSize: 12, lineHeight: 18, marginTop: 6, textAlign: 'center' },
  retryBtn: { minHeight: 46, borderRadius: 12, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, marginTop: 14 },
  retryBtnText: { color: c.accentOn, fontFamily: font.bold, fontSize: 13 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.line, paddingLeft: 14, paddingRight: 6, paddingVertical: 10, marginBottom: 12 },
  cardIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.cardSubtle, alignItems: 'center', justifyContent: 'center' },
  cardLabel: { color: c.text, fontFamily: font.semibold, fontSize: 15 },
  cardSub: { color: c.textMuted, fontSize: 13, marginTop: 2, fontFamily: font.mono },
  removeBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  verified: { backgroundColor: c.onlineSoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  verifiedText: { color: c.online, fontFamily: font.bold, fontSize: 10 },
  unverified: { backgroundColor: c.dangerSoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  unverifiedText: { color: c.danger, fontFamily: font.bold, fontSize: 10 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: c.onlineSoft, borderRadius: 14, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(57,229,140,0.28)' },
  noticeText: { color: c.textSecondary, fontSize: 12, lineHeight: 18, flex: 1 },
  error: { color: c.danger, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  emptyCard: { alignItems: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 18, padding: 20, marginBottom: 12 },
  emptyTitle: { color: c.text, fontFamily: font.semibold, fontSize: 15, marginTop: 10 },
  empty: { color: c.textMuted, fontSize: 13, marginTop: 5, lineHeight: 19, textAlign: 'center' },
  stripeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 54, paddingVertical: 15, borderRadius: 16, backgroundColor: c.accent, marginTop: 4 },
  stripeText: { color: c.accentOn, fontFamily: font.bold, fontSize: 15 },
  securityNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 14, paddingHorizontal: 4 },
  note: { color: c.textMuted, fontSize: 12, lineHeight: 18, flex: 1 },
  vippsNote: { color: c.textMuted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 12, paddingHorizontal: 10 },
}));