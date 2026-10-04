import React, { useEffect, useState } from 'react';
import { StripeProvider } from '@stripe/stripe-react-native';
import { paymentApi } from '@/src/lib/api';

export function NativePaymentProvider({ children }: { children: React.ReactNode }) {
  const [publishableKey, setPublishableKey] = useState('');
  useEffect(() => {
    let mounted = true;
    paymentApi.nativeConfig().then(config => {
      if (mounted && config.enabled && config.test_mode && config.publishable_key?.startsWith('pk_test_')) {
        setPublishableKey(config.publishable_key);
      }
    }).catch(() => {}); // Payment action reports recoverable configuration/network errors.
    return () => { mounted = false; };
  }, []);
  if (!publishableKey) return <>{children}</>;
  const merchantIdentifier = process.env.EXPO_PUBLIC_APPLE_PAY_MERCHANT_ID || undefined;
  return <StripeProvider publishableKey={publishableKey} urlScheme="kjapp" merchantIdentifier={merchantIdentifier}><>{children}</></StripeProvider>;
}
