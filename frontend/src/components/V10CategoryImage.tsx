import React from 'react';
import { View } from 'react-native';
import { VehicleAsset, type VehicleKind } from '@/src/components/VehicleAsset';

/** Bundled category illustration; never presented as the driver's actual vehicle. */
export function V10CategoryImage({ kind, selected }: { kind: VehicleKind; selected: boolean }) {
  return <View style={{ width: 104, height: 74, overflow: 'hidden' }}>
    <VehicleAsset kind={kind} width={104} height={74} selected={selected} />
  </View>;
}
