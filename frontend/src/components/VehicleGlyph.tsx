import React from 'react';
import { VehicleAsset, VehicleKind } from './VehicleAsset';

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
  const safeKind: VehicleKind =
    kind === 'trygg' || kind === 'premium' ? kind : 'ai-first';

  return (
    <VehicleAsset
      kind={safeKind}
      selected={selected}
      width={64}
      height={36}
    />
  );
}
