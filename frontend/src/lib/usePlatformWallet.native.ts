import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { confirmPlatformPaySetupIntent, initStripe, isPlatformPaySupported, PlatformPay } from '@stripe/stripe-react-native';
import { paymentApi } from './api';
import { apiError } from './format';
type WalletKind = 'apple' | 'google';
export function usePlatformWallet(accountId?: string, onSaved?: () => Promise<void> | void) {
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false), generation = useRef(0);
  const kind: WalletKind | null = Platform.OS === 'ios' ? 'apple' : Platform.OS === 'android' ? 'google' : null;
  useEffect(() => {
    const id = ++generation.current;
    setReady(false); setError(''); setBusy(false);
    if (accountId && kind) void walletConfig(kind).then(config => { if (generation.current === id) setReady(Boolean(config)); }).catch(() => {});
    return () => { generation.current++; };
  }, [accountId, kind]);
  const addWallet = async () => {
    if (!ready || !kind || !accountId || lock.current) return false;
    const id = generation.current, current = () => generation.current === id;
    lock.current = true; setBusy(true); setError('');
    try {
      const config = await walletConfig(kind);
      if (!config || !current()) throw new Error('Lommeboken er ikke tilgjengelig på denne enheten.');
      await initStripe({ publishableKey: config.publishable_key, merchantIdentifier: config.apple_merchant_id || undefined, urlScheme: 'kjapp' });
      const setup = await paymentApi.nativeSetup();
      if (!current()) return false;
      if (!setup.client_secret || !setup.setup_intent_id) throw new Error('Stripe svarte uten kortverifisering.');
      const result = await confirmPlatformPaySetupIntent(setup.client_secret, kind === 'google' ? { googlePay: {
        testEnv: config.test_mode === true, merchantName: 'SNAR', merchantCountryCode: 'NO', currencyCode: 'NOK', amount: 0,
      }} : { applePay: {
        merchantCountryCode: 'NO', currencyCode: 'NOK', cartItems: [{ label: 'SNAR – lagre betalingskort', amount: '0.00', paymentType: PlatformPay.PaymentType.Immediate }],
      }});
      if (result.error?.code === 'Canceled') return false;
      if (result.error) throw new Error(result.error.message);
      if (!current()) return false;
      const verified = await paymentApi.nativeSetupStatus(setup.setup_intent_id);
      if (!current()) return false;
      if (verified.ready !== true || verified.verified !== true || !verified.card?.id) throw new Error('Stripe har ikke bekreftet betalingskortet ennå. Prøv igjen.');
      const selected = await paymentApi.makeDefault(verified.card.id);
      if (selected?.selected !== true) throw new Error('Kortvalget ble ikke bekreftet av SNAR.');
      if (!current()) return false;
      await onSaved?.();
      return true;
    } catch (err) { if (current()) setError(apiError(err)); return false; }
    finally { lock.current = false; if (current()) setBusy(false); }
  };
  return { kind, ready, busy, error, addWallet };
}
async function walletConfig(kind: WalletKind) {
  const config = await paymentApi.nativeConfig();
  const prefix = config.test_mode === true ? 'pk_test_' : 'pk_live_';
  if (config.enabled !== true || !config.publishable_key?.startsWith(prefix)) return null;
  if (kind === 'google' && config.google_pay_enabled !== true) return null;
  if (kind === 'apple' && (!config.apple_merchant_id || config.apple_merchant_id !== process.env.EXPO_PUBLIC_APPLE_PAY_MERCHANT_ID)) return null;
  const supported = await isPlatformPaySupported(kind === 'google' ? { googlePay: { testEnv: config.test_mode === true, existingPaymentMethodRequired: true } } : undefined);
  return supported ? config : null;
}
