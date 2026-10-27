import React from 'react';
import Svg, { Circle, G, Image as SvgImage } from 'react-native-svg';
import { useSmoothPosition } from './useSmoothPosition';
import { colors, useColorTheme } from '@/src/theme';

/** Approved original transparent PNG. Its nose points southeast (135 degrees). */
export function V10VehicleBody(_props: { color?: string; vehicleType?: string; bodyType?: string }) {
  return <G rotation={-135}><SvgImage href={require('../../assets/vehicles/snar/live-marker.png')} x={-25} y={-25} width={50} height={50} preserveAspectRatio="xMidYMid meet" /></G>;
}
export function V10VehicleMarker({ heading = 0, active = false, selected = false, vehicleType, bodyType }: { heading?: number; active?: boolean; selected?: boolean; vehicleType?: string; bodyType?: string }) {
  useColorTheme();
  return <Svg width={50} height={50} viewBox="-25 -25 50 50"><G>
    {active ? <><Circle r={20} fill={colors.accent} opacity={.1} /><Circle r={20} fill="none" stroke={colors.accent} strokeOpacity={.35} strokeWidth={1} /></> : null}
    {selected && !active ? <Circle r={21} fill={colors.surface} fillOpacity={.5} stroke={colors.text} strokeOpacity={.45} strokeWidth={1.5} /> : null}
    <G rotation={heading}><V10VehicleBody vehicleType={vehicleType} bodyType={bodyType} /></G>
  </G></Svg>;
}

export function V10RasterCar({ car, projectX, projectY }: { car: { lat: number; lng: number; heading?: number }; projectX: (lng: number) => number; projectY: (lat: number) => number }) {
  const position = useSmoothPosition(car);
  if (!position) return null;
  return <G transform={`translate(${projectX(position.lng)}, ${projectY(position.lat)}) rotate(${position.heading})`}><V10VehicleBody /></G>;
}
