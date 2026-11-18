import React from 'react';
import { View } from 'react-native';
import { V10Badge } from '@/src/components/V10UI';

export function DriverIdentityBadge({ confirmed }: { confirmed: boolean }) {
  if (!confirmed) return null;
  return <View testID="customer-driver-identity-confirmed" style={{ marginTop: 6 }}>
    <V10Badge tone="positive">Identitet bekreftet av SNAR</V10Badge>
  </View>;
}
