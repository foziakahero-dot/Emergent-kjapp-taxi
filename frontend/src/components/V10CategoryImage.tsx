import React from 'react';
import { View } from 'react-native';
import { VehicleAsset, type VehicleKind } from './VehicleAsset';

/** Booking and assistant use the exact approved SNAR 3D artwork while preserving API classes. */
export function V10CategoryImage({ kind, selected }: { kind: VehicleKind; selected: boolean }) {
  return (
    <View style={{ width: 92, height: 58, borderRadius: 12, overflow: 'visible' }}>
      <VehicleAsset kind={kind} selected={selected} width={92} height={58} />
    </View>
  );
}
