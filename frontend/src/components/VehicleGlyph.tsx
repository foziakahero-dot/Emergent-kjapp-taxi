import React from 'react';
import { VehicleAsset, VehicleKind } from './VehicleAsset';
import { customerVehicleArt } from '@/src/lib/vehicleAssets';

/**
 * Vehicle selector artwork.
 * Keeps the existing Home API stable while rendering the original approved
 * SNAR car images bundled by VehicleAsset.
 */
export function VehicleGlyph({
  selected,
  kind = 'ai-first',
}: {
  selected: boolean;
  kind?: string;
}) {
  if (!customerVehicleArt(kind)) return null;
  const safeKind = kind as VehicleKind;

  return (
    <VehicleAsset
      kind={safeKind}
      selected={selected}
      width={64}
      height={36}
    />
  );
}
