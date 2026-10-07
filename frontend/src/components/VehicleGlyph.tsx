import React from 'react';
import { VehicleAsset, VehicleKind } from './VehicleAsset';

/**
 * Vehicle selector artwork.
 * Keeps the existing Home API stable while using the richer SNAR vehicle assets.
 * The final Figma-rendered assets can replace VehicleAsset later without touching Home.
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
