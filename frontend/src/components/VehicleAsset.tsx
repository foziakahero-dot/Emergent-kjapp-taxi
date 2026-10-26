import React from 'react';
import { Image } from 'expo-image';
import { customerVehicleArt, type CustomerVehicleArtType } from '@/src/lib/vehicleAssets';

type VehicleKind = CustomerVehicleArtType;

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
  return (
    <Image
      source={spec.source}
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
