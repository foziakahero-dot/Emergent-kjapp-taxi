import { initPaymentSheet, presentPaymentSheet, confirmPlatformPayPayment, isPlatformPaySupported } from '@stripe/stripe-react-native';
import { paymentApi } from './api';

export async function approveReservation(detail: { client_secret: string; trip_id: string; payment_provider?: string; amount_ore?: number; currency?: string }): Promise<boolean> {
  const config = await paymentApi.nativeConfig();
  if (!config.enabled || !config.publishable_key) throw new Error('Kortgodkjenning er midlertidig utilgjengelig.');
  if (process.env.EXPO_PUBLIC_PAYMENT_ENV === 'live' && config.test_mode !== false) throw new Error('Ekte betaling er ikke aktivert på SNAR-serveren.');
  const prefix = config.test_mode === true ? 'pk_test_' : 'pk_live_';
  if (!config.publishable_key.startsWith(prefix)) throw new Error('Betalingsoppsettet har ulike Stripe-miljøer.');
  if (detail.payment_provider === 'google_pay') {
    if (!config.google_pay_enabled || detail.currency !== 'nok' || !Number.isInteger(detail.amount_ore) || Number(detail.amount_ore) <= 0)
      throw new Error('Google Pay-reservasjonen kunne ikke bekreftes.');
    if (!(await isPlatformPaySupported({ googlePay: { testEnv: config.test_mode === true, existingPaymentMethodRequired: false } })))
      throw new Error('Google Pay er ikke tilgjengelig på denne enheten. Velg betalingskort.');
    const result = await confirmPlatformPayPayment(detail.client_secret, { googlePay: {
      testEnv: config.test_mode === true, merchantName: 'SNAR', merchantCountryCode: 'NO', currencyCode: 'NOK',
    }});
    if (result.error?.code === 'Canceled') return false;
    if (result.error) throw new Error(result.error.message);
    return true; // API client must confirm canonical requires_capture before booking succeeds.
  }
  const initialized = await initPaymentSheet({
    merchantDisplayName: 'SNAR', paymentIntentClientSecret: detail.client_secret,
    returnURL: `kjapp://booking/${encodeURIComponent(detail.trip_id)}`,
    allowsDelayedPaymentMethods: false,
    primaryButtonLabel: 'Reserver turbeløpet',
  });
  if (initialized.error) throw new Error(initialized.error.message);
  const result = await presentPaymentSheet();
  if (result.error?.code === 'Canceled') return false;
  if (result.error) throw new Error(result.error.message);
  return true;
}
