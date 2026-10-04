import { Platform } from 'react-native';
import {
  initPaymentSheet,
  initStripe,
  presentPaymentSheet,
} from '@stripe/stripe-react-native';
import { paymentApi } from './api';

let activePublishableKey = '';

async function ensureStripeReady() {
  if (Platform.OS === 'web') return null;

  const config = await paymentApi.nativeConfig();
  const publishableKey = String(config?.publishable_key || '').trim();
  if (!config?.enabled || !publishableKey) return null;

  if (activePublishableKey !== publishableKey) {
    const options: any = {
      publishableKey,
      urlScheme: 'kjapp',
    };
    if (config?.apple_merchant_id) options.merchantIdentifier = config.apple_merchant_id;
    await initStripe(options);
    activePublishableKey = publishableKey;
  }

  return config;
}

export async function payNative(tripId: string): Promise<boolean | null> {
  const config = await ensureStripeReady();
  if (!config) return null;

  const intent = await paymentApi.nativeIntent(tripId);
  const clientSecret = String(intent?.client_secret || '').trim();
  const intentId = String(intent?.payment_intent_id || '').trim();
  if (!clientSecret || !intentId) {
    throw new Error('Stripe svarte uten betalingsinformasjon.');
  }

  const sheetOptions: any = {
    merchantDisplayName: 'SNAR',
    paymentIntentClientSecret: clientSecret,
    returnURL: 'kjapp://stripe-redirect',
    allowsDelayedPaymentMethods: false,
  };

  if (config?.apple_merchant_id) {
    sheetOptions.applePay = { merchantCountryCode: 'NO' };
  }
  if (config?.google_pay_enabled) {
    sheetOptions.googlePay = {
      merchantCountryCode: 'NO',
      testEnv: Boolean(config?.test_mode),
    };
  }

  const { error: initError } = await initPaymentSheet(sheetOptions);
  if (initError) {
    throw new Error(initError.message || 'Kunne ikke klargjøre Stripe-betalingen.');
  }

  const { error } = await presentPaymentSheet();
  if (error) {
    if (String((error as any).code || '').toLowerCase() === 'canceled') return false;
    throw new Error(error.message || 'Stripe-betalingen feilet.');
  }

  const status = await paymentApi.nativeStatus(intentId);
  return status?.payment_status === 'paid';
}
