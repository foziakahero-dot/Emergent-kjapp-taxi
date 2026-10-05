import { initStripe, initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';
import { api, paymentApi } from './api';

async function initNativeStripe() {
  const config = await paymentApi.nativeConfig();
  if (!config.enabled) throw new Error('Testbetaling er midlertidig utilgjengelig. Prøv igjen senere.');
  if (!config.test_mode || !config.publishable_key?.startsWith('pk_test_')) throw new Error('SNAR beta tillater bare testbetaling.');
  const compiledMerchant = process.env.EXPO_PUBLIC_APPLE_PAY_MERCHANT_ID || '';
  await initStripe({
    publishableKey: config.publishable_key,
    urlScheme: 'kjapp',
    merchantIdentifier: compiledMerchant || undefined,
  });
  return { config, compiledMerchant };
}

/**
 * Verify and save a card without leaving the native app.
 * PaymentSheet handles 3DS and returns through the kjapp:// URL scheme.
 */
export async function setupNativeCard(): Promise<boolean> {
  const { config } = await initNativeStripe();
  const setup = await api.post('/payments/native/setup-intent').then((r) => r.data);
  if (!setup?.client_secret || !setup?.setup_intent_id) {
    throw new Error('Stripe svarte uten kortverifisering.');
  }

  const initialized = await initPaymentSheet({
    merchantDisplayName: 'SNAR',
    setupIntentClientSecret: setup.client_secret,
    returnURL: 'kjapp://payment-methods?setup=success',
    allowsDelayedPaymentMethods: false,
  });
  if (initialized.error) throw new Error(initialized.error.message);

  const result = await presentPaymentSheet();
  if (result.error) {
    if (result.error.code === 'Canceled') return false;
    throw new Error(result.error.message);
  }

  // PaymentSheet closing is not enough proof. The backend re-reads the SetupIntent
  // from Stripe and persists only a succeeded/verified payment method.
  const status = await api.get(`/payments/native/setup-intent/${encodeURIComponent(setup.setup_intent_id)}`).then((r) => r.data);
  if (!status?.ready || status?.verified !== true) {
    throw new Error('Stripe har ikke bekreftet kortet ennå. Prøv igjen.');
  }
  return true;
}

// null means not activated: use existing Checkout on web only. Once an intent is created,
// never open a second payment flow automatically, even after a network error.
export async function payNative(tripId: string): Promise<boolean | null> {
  const { config, compiledMerchant } = await initNativeStripe();
  const intent = await paymentApi.nativeIntent(tripId);
  if (!intent.client_secret || !intent.payment_intent_id) throw new Error('Stripe svarte uten betalingsinformasjon.');
  const initialized = await initPaymentSheet({
    merchantDisplayName: 'SNAR', paymentIntentClientSecret: intent.client_secret,
    returnURL: `kjapp://receipt/${encodeURIComponent(tripId)}`, allowsDelayedPaymentMethods: false,
    applePay: compiledMerchant && compiledMerchant === config.apple_merchant_id
      ? { merchantCountryCode: 'NO' } : undefined,
    googlePay: config.google_pay_enabled ? { merchantCountryCode: 'NO', currencyCode: 'NOK', testEnv: config.test_mode } : undefined,
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
