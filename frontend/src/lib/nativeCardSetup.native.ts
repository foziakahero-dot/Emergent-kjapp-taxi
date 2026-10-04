import { initPaymentSheet, initStripe, presentPaymentSheet } from '@stripe/stripe-react-native';
import { paymentApi } from './api';

export async function addNativeTestCard(): Promise<{ added: boolean; canceled?: boolean } | null> {
  const config = await paymentApi.nativeConfig();
  if (!config?.enabled) return null;
  if (!config?.test_mode || !config?.publishable_key?.startsWith('pk_test_')) {
    throw new Error('SNAR beta tillater bare Stripe testmodus.');
  }

  await initStripe({
    publishableKey: config.publishable_key,
    urlScheme: 'kjapp',
  });

  const setup = await paymentApi.nativeSetupIntent();
  if (!setup?.client_secret || !setup?.setup_intent_id) {
    throw new Error('Stripe svarte uten SetupIntent.');
  }

  const initialized = await initPaymentSheet({
    merchantDisplayName: 'SNAR',
    setupIntentClientSecret: setup.client_secret,
    returnURL: 'kjapp://payment/setup-success',
    allowsDelayedPaymentMethods: false,
  });
  if (initialized.error) throw new Error(initialized.error.message);

  const result = await presentPaymentSheet();
  if (result.error) {
    if (result.error.code === 'Canceled') return { added: false, canceled: true };
    throw new Error(result.error.message);
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const status = await paymentApi.nativeSetupStatus(setup.setup_intent_id);
    if (status?.ready && status?.verified) return { added: true };
    await new Promise(resolve => setTimeout(resolve, 700));
  }

  throw new Error('Stripe bekreftet kortet, men SNAR rakk ikke å registrere det. Åpne Betalingsmåter på nytt.');
}
