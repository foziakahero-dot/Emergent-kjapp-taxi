// Exact transparent vehicle renders cropped from the approved SNAR 3D sheet (2026-10-28).
import { SNAR_SELECTOR_ASSET } from './vehicleAssetsGenerated/snarSelector';
import { COMFORT_SELECTOR_ASSET } from './vehicleAssetsGenerated/comfortSelector';
import { PREMIUM_SELECTOR_ASSET } from './vehicleAssetsGenerated/premiumSelector';
import { XL_SELECTOR_ASSET } from './vehicleAssetsGenerated/xlSelector';
import { SNAR_MAP_ASSET } from './vehicleAssetsGenerated/snarMap';
import { COMFORT_MAP_ASSET } from './vehicleAssetsGenerated/comfortMap';
import { PREMIUM_MAP_ASSET } from './vehicleAssetsGenerated/premiumMap';
import { XL_MAP_ASSET } from './vehicleAssetsGenerated/xlMap';

export const SNAR_SELECTOR_VEHICLES = {
  snar: SNAR_SELECTOR_ASSET,
  comfort: COMFORT_SELECTOR_ASSET,
  premium: PREMIUM_SELECTOR_ASSET,
  xl: XL_SELECTOR_ASSET,
} as const;

export const SNAR_MAP_VEHICLES = {
  snar: SNAR_MAP_ASSET,
  comfort: COMFORT_MAP_ASSET,
  premium: PREMIUM_MAP_ASSET,
  xl: XL_MAP_ASSET,
} as const;

export type SnarVehicleVisual = keyof typeof SNAR_SELECTOR_VEHICLES;
