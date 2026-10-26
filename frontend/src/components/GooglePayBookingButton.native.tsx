import React from 'react';
import { PlatformPay, PlatformPayButton } from '@stripe/stripe-react-native';

export function GooglePayBookingButton({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  return <PlatformPayButton testID="booking-confirm-google-pay" accessibilityLabel="Bekreft og bestill med Google Pay"
    type={PlatformPay.ButtonType.Pay} appearance={PlatformPay.ButtonStyle.Black}
    disabled={disabled} onPress={onPress} style={{ height: 52, width: '100%', opacity: disabled ? .5 : 1 }} />;
}
