import { confirmPayment, handleNextAction, initStripe, initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';
import { paymentApi } from './api';

export async function approveReservation(detail: {
  client_secret: string; trip_id: string; payment_provider?: string; payment_method_id?: string;
  strict_payment_method?: boolean; confirmation_status?: string;
}): Promise<boolean> {
  const config = await paymentApi.nativeConfig();
  if (!config.enabled || !config.publishable_key) throw new Error('Kortgodkjenning er midlertidig utilgjengelig.');
  await initStripe({ publishableKey: config.publishable_key, urlScheme: 'kjapp' });
  const returnURL = `kjapp://booking/${encodeURIComponent(detail.trip_id)}`;
  if (detail.strict_payment_method) {
    if (!detail.payment_method_id) throw new Error('Reservasjonen mangler en bekreftet betalingsmåte.');
    const action = detail.confirmation_status === 'requires_action'
      ? await handleNextAction(detail.client_secret, returnURL)
      : await confirmPayment(detail.client_secret, {
          paymentMethodType: 'Card', paymentMethodData: { paymentMethodId: detail.payment_method_id },
        });
    if (action.error?.code === 'Canceled') return false;
    if (action.error) throw new Error(action.error.message);
    return action.paymentIntent?.status === 'RequiresCapture';
  }
  const initialized = await initPaymentSheet({
    merchantDisplayName: 'SNAR', paymentIntentClientSecret: detail.client_secret,
    returnURL,
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
