// Central Customer artwork. API IDs and seat/pricing rules stay in their existing models.
import { SNAR_MAP_VEHICLES, SNAR_SELECTOR_VEHICLES, type SnarVehicleVisual } from './snarVehicleSelectorAssets';

const economy = { source: SNAR_SELECTOR_VEHICLES.snar, label: 'SNAR', visualKind: 'sedan' } as const;
const comfort = { source: SNAR_SELECTOR_VEHICLES.comfort, label: 'Comfort', visualKind: 'sedan' } as const;
const premium = { source: SNAR_SELECTOR_VEHICLES.premium, label: 'Premium', visualKind: 'executive' } as const;
const suv = { source: SNAR_SELECTOR_VEHICLES.xl, label: 'SUV', visualKind: 'suv' } as const;
const xl = { source: SNAR_SELECTOR_VEHICLES.xl, label: 'SNAR XL', visualKind: 'xl' } as const;

export const CUSTOMER_VEHICLE_ART = {
  'ai-first': economy,
  enkelt: economy,
  comfort,
  premium,
  suv,
  // This is a distinct seven-seat API class; the new SUV art must not relabel it.
  trygg: xl,
} as const;

export type CustomerVehicleArtType = keyof typeof CUSTOMER_VEHICLE_ART;

export function customerVehicleArt(apiType: string) {
  return Object.prototype.hasOwnProperty.call(CUSTOMER_VEHICLE_ART, apiType)
    ? CUSTOMER_VEHICLE_ART[apiType as CustomerVehicleArtType]
    : null;
}

export function customerVehicleVisual(apiType?: string, bodyType?: string): SnarVehicleVisual {
  const type = String(apiType || '').trim().toLowerCase();
  const body = String(bodyType || '').trim().toLowerCase();

  if (type.includes('comfort')) return 'comfort';
  if (type.includes('premium') || body.includes('executive')) return 'premium';
  if (
    type.includes('suv') ||
    type.includes('trygg') ||
    type.includes('xl') ||
    body.includes('suv') ||
    body.includes('van') ||
    body.includes('minibus') ||
    body.includes('xl')
  ) return 'xl';

  return 'snar';
}

export function customerMapVehicleArt(apiType?: string, bodyType?: string) {
  return SNAR_MAP_VEHICLES[customerVehicleVisual(apiType, bodyType)];
}
