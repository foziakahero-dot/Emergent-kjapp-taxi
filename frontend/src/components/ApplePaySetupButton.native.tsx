import React from 'react';
import { Platform } from 'react-native';
import { PlatformPay, PlatformPayButton } from '@stripe/stripe-react-native';
export function ApplePaySetupButton({ onPress, disabled, testID }: { onPress: () => void; disabled?: boolean; testID?: string }) {
  if (Platform.OS !== 'ios') return null;
  return <PlatformPayButton type={PlatformPay.ButtonType.SetUp} onPress={onPress} disabled={disabled}
    testID={testID} accessibilityLabel="Lagre Apple Pay for turer" borderRadius={12} style={{ height: 48, width: '100%' }} />;
}
