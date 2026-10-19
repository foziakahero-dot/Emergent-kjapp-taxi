import React from 'react';
import { View } from 'react-native';
import { VehicleAsset, type VehicleKind } from './VehicleAsset';

type Kind = VehicleKind | 'comfort';
/** Booking and assistant use the same supplied artwork and preserve API classes. */
export function V10CategoryImage({ kind, selected }: { kind: Kind; selected: boolean }) {
  if (kind === 'comfort') return null;
  return <View style={{ width: 84, height: 56, borderRadius: 12, overflow: 'hidden' }}>
    <VehicleAsset kind={kind} selected={selected} width={84} height={56} />
  </View>;
}
