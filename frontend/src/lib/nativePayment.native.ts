import { initStripe, initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';
import { paymentApi } from './api';

// null means not activated: use existing Checkout. Once an intent is created,
// never open a second payment flow automatically, even after a network error.
export async function payNative(tripId: string): Promise<boolean | null> {
  const config = await paymentApi.nativeConfig();
  if (!config.enabled) return null;
  const compiledMerchant = process.env.EXPO_PUBLIC_APPLE_PAY_MERCHANT_ID || '';
  await initStripe({ publishableKey: config.publishable_key, urlScheme: 'kjapp',
    merchantIdentifier: compiledMerchant || undefined });
  const intent = await paymentApi.nativeIntent(tripId);
  const initialized = await initPaymentSheet({
    merchantDisplayName: 'KJAPP', paymentIntentClientSecret: intent.client_secret,
    returnURL: 'kjapp://payment/success', allowsDelayedPaymentMethods: false,
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
