import React from 'react';
import { Image } from 'expo-image';
import { customerVehicleArt, type CustomerVehicleArtType } from '@/src/lib/vehicleAssets';

type VehicleKind = CustomerVehicleArtType;

// Transparent derivatives of the owner's November renders. Map markers keep their
// separate, shared Customer/Driver assets and heading convention.
const bookingRenders = {
  'ai-first': require('../../assets/vehicles/customer-20261111/snar.png'),
  enkelt: require('../../assets/vehicles/customer-20261111/snar.png'),
  premium: require('../../assets/vehicles/customer-20261111/premium.png'),
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
  const spec = customerVehicleArt(kind);
  if (!spec) return null;
  const source = kind in bookingRenders
    ? bookingRenders[kind as keyof typeof bookingRenders] : { uri: spec.source };
  return (
    <Image
      source={source}
      style={{ width, height }}
      contentFit="contain"
      allowDownscaling
      accessibilityRole="image"
      accessibilityLabel={spec.label}
      accessibilityState={{ selected }}
    />
  );
}

export type { VehicleKind };
