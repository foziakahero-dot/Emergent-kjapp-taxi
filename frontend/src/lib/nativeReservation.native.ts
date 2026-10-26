import { initStripe, initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';
import { paymentApi } from './api';

export async function approveReservation(detail: { client_secret: string; trip_id: string; payment_provider?: string }): Promise<boolean> {
  const config = await paymentApi.nativeConfig();
  if (!config.enabled || !config.publishable_key) throw new Error('Kortgodkjenning er midlertidig utilgjengelig.');
  await initStripe({ publishableKey: config.publishable_key, urlScheme: 'kjapp' });
  const initialized = await initPaymentSheet({
    merchantDisplayName: 'SNAR', paymentIntentClientSecret: detail.client_secret,
    returnURL: `kjapp://booking/${encodeURIComponent(detail.trip_id)}`,
    allowsDelayedPaymentMethods: false,
    primaryButtonLabel: 'Reserver turbeløpet',
    ...(detail.payment_provider === 'google_pay' ? {
      googlePay: { merchantCountryCode: 'NO', testEnv: config.test_mode === true },
    } : {}),
  });
  if (initialized.error) throw new Error(initialized.error.message);
  const result = await presentPaymentSheet();
  if (result.error?.code === 'Canceled') return false;
  if (result.error) throw new Error(result.error.message);
  return true;
}
