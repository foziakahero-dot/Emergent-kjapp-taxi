// Central Customer artwork. API IDs and seat/pricing rules stay in their existing models.
const economy = { source: require('../../assets/vehicles/snar/economy.png'), label: 'Økonomi', visualKind: 'hatchback' } as const;
const premium = { source: require('../../assets/vehicles/snar/premium.png'), label: 'Premium', visualKind: 'sedan' } as const;
const suv = { source: require('../../assets/vehicles/snar/suv.png'), label: 'SUV', visualKind: 'suv' } as const;
const xl = { source: require('../../assets/vehicles/xl-3d.webp'), label: 'SNAR XL', visualKind: 'xl' } as const;

export const CUSTOMER_VEHICLE_ART = {
  'ai-first': economy,
  enkelt: economy,
  premium,
  suv,
  // This is a distinct seven-seat API class; the new SUV art must not relabel it.
  trygg: xl,
} as const;

export type CustomerVehicleArtType = keyof typeof CUSTOMER_VEHICLE_ART;

export function customerVehicleArt(apiType: string) {
  return Object.prototype.hasOwnProperty.call(CUSTOMER_VEHICLE_ART, apiType)
    ? CUSTOMER_VEHICLE_ART[apiType as CustomerVehicleArtType] : null;
}

// Live-map artwork is deliberately not assigned until the fourth upload is available.
// Category PNGs above are full-resolution originals, not optimized map textures.
