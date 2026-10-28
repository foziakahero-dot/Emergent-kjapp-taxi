import React from 'react';
import Svg, { Circle, G, Image as SvgImage } from 'react-native-svg';
import { useSmoothPosition } from './useSmoothPosition';
import { colors, useColorTheme } from '@/src/theme';
import { DRIVER_SNAR_MAP_ASSETS, driverVehicleVisual } from '@/src/lib/snarVehicleMapAssets';

const APPROVED_ASSET_NOSE_DEG = 225;

/** Exact approved SNAR 3D vehicle render. Visual class changes only; backend vehicle data stays untouched. */
export function V10VehicleBody({ vehicleType, bodyType }: { color?: string; vehicleType?: string; bodyType?: string }) {
  const visual = driverVehicleVisual(vehicleType, bodyType);
  const uri = DRIVER_SNAR_MAP_ASSETS[visual];
  return (
    <G rotation={-APPROVED_ASSET_NOSE_DEG}>
      <SvgImage href={{ uri }} x={-29} y={-25} width={58} height={50} preserveAspectRatio="xMidYMid meet" />
    </G>
  );
}

export function V10VehicleMarker({
  heading = 0,
  active = false,
  vehicleType,
  bodyType,
}: {
  heading?: number;
  active?: boolean;
  vehicleType?: string;
  bodyType?: string;
}) {
  useColorTheme();
  return (
    <Svg width={54} height={54} viewBox="-27 -27 54 54">
      <G>
        {active ? (
          <>
            <Circle r={21} fill={colors.accent} opacity={0.1} />
            <Circle r={21} fill="none" stroke={colors.accent} strokeOpacity={0.35} strokeWidth={1} />
          </>
        ) : null}
        <G rotation={heading}>
          <V10VehicleBody vehicleType={vehicleType} bodyType={bodyType} />
        </G>
      </G>
    </Svg>
  );
}

export function V10RasterCar({
  car,
  projectX,
  projectY,
}: {
  car: { lat: number; lng: number; heading?: number; type?: string; body_type?: string };
  projectX: (lng: number) => number;
  projectY: (lat: number) => number;
}) {
  const position = useSmoothPosition(car);
  if (!position) return null;
  return (
    <G transform={`translate(${projectX(position.lng)}, ${projectY(position.lat)}) rotate(${position.heading})`}>
      <V10VehicleBody vehicleType={car.type} bodyType={car.body_type} />
    </G>
  );
}
