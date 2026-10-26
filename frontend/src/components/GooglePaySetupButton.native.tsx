import React from 'react';
import { Platform } from 'react-native';
import { PlatformPay, PlatformPayButton } from '@stripe/stripe-react-native';

export function GooglePaySetupButton({ onPress, disabled, testID }: { onPress: () => void; disabled?: boolean; testID?: string }) {
  if (Platform.OS !== 'android') return null;
  return <PlatformPayButton type={PlatformPay.ButtonType.GooglePayMark} onPress={onPress} disabled={disabled}
    testID={testID} accessibilityLabel="Lagre betalingskort med Google Pay" borderRadius={12} style={{ height: 48, width: '100%' }} />;
}
