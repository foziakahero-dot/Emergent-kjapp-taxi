import React from 'react';
import { Image } from 'expo-image';

type VehicleKind = 'ai-first' | 'trygg' | 'premium';

// Original approved SNAR renders, recovered unchanged from the landing artwork.
const VEHICLES = {
  'ai-first': { source: require('../../assets/vehicles/standard-3d.webp'), label: 'SNAR' },
  trygg: { source: require('../../assets/vehicles/xl-3d.webp'), label: 'SNAR XL' },
  premium: { source: require('../../assets/vehicles/premium-3d.webp'), label: 'Premium' },
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
      contentFit="contain"
      accessibilityRole="image"
      accessibilityLabel={spec.label}
      accessibilityState={{ selected }}
    />
  );
}

export type { VehicleKind };
