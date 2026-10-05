import React, { useEffect, useState } from 'react';
import { StripeProvider, handleURLCallback } from '@stripe/stripe-react-native';
import { Linking } from 'react-native';
import { paymentApi } from '@/src/lib/api';

export function NativePaymentProvider({ children }: { children: React.ReactNode }) {
  const [publishableKey, setPublishableKey] = useState('');

  useEffect(() => {
    const handle = (url: string | null) => {
      if (url?.startsWith('kjapp://')) void handleURLCallback(url).catch(() => {});
    };
    void Linking.getInitialURL().then(handle).catch(() => {});
    const listener = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => listener.remove();
  }, []);

  useEffect(() => {
    let mounted = true;
    paymentApi.nativeConfig().then(config => {
      if (mounted && config.enabled && config.test_mode && config.publishable_key?.startsWith('pk_test_')) {
        setPublishableKey(config.publishable_key);
      }
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  // Never construct StripeProvider with an empty key. Native card/payment actions also
  // initialize Stripe imperatively, while the URL listener above remains mounted.
  if (!publishableKey) return <>{children}</>;

  const merchantIdentifier = process.env.EXPO_PUBLIC_APPLE_PAY_MERCHANT_ID || undefined;
  return <StripeProvider publishableKey={publishableKey} urlScheme="kjapp" merchantIdentifier={merchantIdentifier}><>{children}</></StripeProvider>;
}
