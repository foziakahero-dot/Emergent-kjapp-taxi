import React from 'react';
import { Image } from 'expo-image';

type VehicleKind = 'ai-first' | 'enkelt' | 'trygg' | 'premium';

// User's four transparent SNAR 3D renders from 25 October, bundled for offline use.
const VEHICLES = {
  'ai-first': { source: require('../../assets/vehicles/standard-3d.png'), label: 'SNAR Standard' },
  enkelt: { source: require('../../assets/vehicles/enkelt-3d.png'), label: 'SNAR Enkelt' },
  trygg: { source: require('../../assets/vehicles/xl-3d.png'), label: 'SNAR XL' },
  premium: { source: require('../../assets/vehicles/premium-3d.png'), label: 'SNAR Premium' },
} as const;

export function VehicleAsset({
  kind,
  selected = false,
  width = 132,
  height = 72,
}: {
  kind: VehicleKind;
  selected?: boolean;
  width?: number;
  height?: number;
}) {
  const spec = VEHICLES[kind];
  return (
    <Image
      source={spec.source}
      style={{ width, height }}
      contentFit="cover"
      accessibilityRole="image"
      accessibilityLabel={spec.label}
      accessibilityState={{ selected }}
    />
  );
}

export type { VehicleKind };
