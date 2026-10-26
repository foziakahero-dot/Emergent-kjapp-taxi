import { initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';
import { paymentApi } from './api';

// null means not activated: use existing Checkout. Once an intent is created,
// never open a second payment flow automatically, even after a network error.
export async function payNative(tripId: string): Promise<boolean | null> {
  const config = await paymentApi.nativeConfig();
  if (!config.enabled) throw new Error('Testbetaling er midlertidig utilgjengelig. Prøv igjen senere.');
  if (!config.publishable_key?.startsWith(config.test_mode ? 'pk_test_' : 'pk_live_')) throw new Error('Betalingsoppsettet har ulike Stripe-miljøer.');
  const compiledMerchant = process.env.EXPO_PUBLIC_APPLE_PAY_MERCHANT_ID || '';
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

