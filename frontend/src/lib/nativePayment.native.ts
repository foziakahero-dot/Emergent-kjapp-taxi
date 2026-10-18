import { Platform } from 'react-native';
import { initPaymentSheet, presentPaymentSheet, isPlatformPaySupported, confirmPlatformPaySetupIntent, PlatformPay } from '@stripe/stripe-react-native';
import { paymentApi } from './api';

export type NativeWallet = { kind: 'google' | 'apple'; label: string };
function assertPaymentConfig(config: any) {
  const prefix = config.test_mode ? 'pk_test_' : 'pk_live_';
  if (!config.enabled || !config.publishable_key?.startsWith(prefix)) throw new Error('Betaling er ikke aktivert i dette miljøet.');
}

/**
 * Stripe is initialized exactly once by NativePaymentProvider at app root.
 * Do not call initStripe here as well: mixing StripeProvider + imperative
 * initStripe can re-initialize the Android native SDK while an Activity is
 * active and has caused process-level crashes before PaymentSheet opens.
 */
export async function nativeWalletAvailability(config?: any): Promise<NativeWallet | null> {
  config = config || await paymentApi.nativeConfig();
  try { assertPaymentConfig(config); } catch { return null; }
  const merchant = process.env.EXPO_PUBLIC_APPLE_PAY_MERCHANT_ID || '';
  const eligible = Platform.OS === 'android' ? config.google_pay_enabled === true
    : Platform.OS === 'ios' && config.apple_pay_enabled === true && merchant && merchant === config.apple_merchant_id;
  if (!eligible) return null;
  try {
    const supported = await isPlatformPaySupported(Platform.OS === 'android'
      ? { googlePay: { testEnv: config.test_mode === true, existingPaymentMethodRequired: false } } : {});
    return supported ? { kind: Platform.OS === 'android' ? 'google' : 'apple', label: Platform.OS === 'android' ? 'Google Pay' : 'Apple Pay' } : null;
  } catch { return null; }
}
function walletOptions(wallet: NativeWallet | null, config: any) {
  return {
    applePay: wallet?.kind === 'apple' ? { merchantCountryCode: 'NO' } : undefined,
    googlePay: wallet?.kind === 'google' ? { merchantCountryCode: 'NO', currencyCode: 'NOK', testEnv: config.test_mode === true } : undefined,
  };
}

/** Save through Stripe's native sheet, then accept only server-verified setup. */
export async function setupNativePaymentMethod(walletRequired = false): Promise<any | null> {
  const config = await paymentApi.nativeConfig();
  assertPaymentConfig(config);

  // A normal card setup must not probe Platform Pay first. This keeps the
  // ordinary card path independent from Google/Apple wallet availability.
  const wallet = walletRequired ? await nativeWalletAvailability(config) : null;
  if (walletRequired && !wallet) throw new Error('Lommeboken er ikke tilgjengelig på denne enheten. Legg til et kort i stedet.');

  const setup = await paymentApi.nativeSetup(walletRequired && wallet ? wallet.kind === 'google' ? 'google_pay' : 'apple_pay' : undefined);
  if (!setup.client_secret || !setup.setup_intent_id) throw new Error('Stripe svarte uten kortverifisering.');
  let result;
  if (walletRequired && wallet?.kind === 'google') {
    result = await confirmPlatformPaySetupIntent(setup.client_secret, { googlePay: {
      testEnv: config.test_mode === true, merchantName: 'SNAR', merchantCountryCode: 'NO', currencyCode: 'NOK', amount: 0,
      label: 'Lagre betalingskort for turene du bestiller',
    } });
  } else if (walletRequired && wallet?.kind === 'apple') {
    result = await confirmPlatformPaySetupIntent(setup.client_secret, { applePay: {
      merchantCountryCode: 'NO', currencyCode: 'NOK',
      cartItems: [{ label: 'SNAR – lagre for turer du bestiller', amount: '0.00', paymentType: PlatformPay.PaymentType.Immediate }],
    } });
  } else {
    const initialized = await initPaymentSheet({ merchantDisplayName: 'SNAR',
      setupIntentClientSecret: setup.client_secret, returnURL: 'kjapp://payment-methods',
      allowsDelayedPaymentMethods: false });
    if (initialized.error) throw new Error(initialized.error.message);
    result = await presentPaymentSheet();
  }
  if (result.error?.code === 'Canceled') return null;
  if (result.error) throw new Error(result.error.message);
  const status = await paymentApi.nativeSetupStatus(setup.setup_intent_id);
  if (status.ready !== true || status.verified !== true || !status.card?.id) {
    throw new Error('Stripe har ikke bekreftet kortet ennå. Oppdater betalingsmåter før du bestiller.');
  }
  if (walletRequired && wallet && status.card.wallet !== (wallet.kind === 'google' ? 'google_pay' : 'apple_pay')) {
    throw new Error('Betalingsmåten ble ikke bekreftet med den valgte lommeboken.');
  }
  return status.card;
}

// null means not activated: use existing Checkout. Once an intent is created,
// never open a second payment flow automatically, even after a network error.
export async function payNative(tripId: string): Promise<boolean | null> {
  const config = await paymentApi.nativeConfig();
  assertPaymentConfig(config);
  const wallet = await nativeWalletAvailability(config);
  const intent = await paymentApi.nativeIntent(tripId);
  if (!intent.client_secret || !intent.payment_intent_id) throw new Error('Stripe svarte uten betalingsinformasjon.');
  const initialized = await initPaymentSheet({
    merchantDisplayName: 'SNAR', paymentIntentClientSecret: intent.client_secret,
    returnURL: `kjapp://receipt/${encodeURIComponent(tripId)}`, allowsDelayedPaymentMethods: false,
    ...walletOptions(wallet, config),
  });
  if (initialized.error) throw new Error(initialized.error.message);
  const result = await presentPaymentSheet();
  if (result.error) {
    if (result.error.code === 'Canceled') return false;
    throw new Error(result.error.message);
  }
  // The SDK result is not proof of settlement: confirm against Stripe through backend.
  const status = await paymentApi.nativeStatus(intent.payment_intent_id);
  return status.payment_status === 'paid';
}
