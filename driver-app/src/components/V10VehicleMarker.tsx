import React, { useId } from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useSmoothPosition } from './useSmoothPosition';
import { colors, useColorTheme } from '@/src/theme';

/** Original reference/snar-v10-design/src/snar10/kit.tsx VehicleMarker geometry. */
export function V10VehicleBody({ color, vehicleType, bodyType }: { color?: string; vehicleType?: string; bodyType?: string }) {
  const theme = useColorTheme();
  const body = color || (theme.effective === 'dark' ? '#e9ecef' : '#1b1f24');
  const light = body === '#e9ecef' || body === '#ffffff';
  const id = `v10-car-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const shape = bodyType || (vehicleType === 'suv' ? 'suv' : vehicleType === 'trygg' ? 'van' : vehicleType === 'premium' ? 'executive' : 'sedan');
  const scale = shape === 'van' || shape === 'minibus' ? 'scale(1.3,1.3)' : shape === 'suv' ? 'scale(1.2,1.12)' : shape === 'executive' || vehicleType === 'premium' ? 'scale(1,1.2)' : 'scale(1,1)';
  return <G transform={scale}>
    <Defs><LinearGradient id={id} x1="0" x2="1"><Stop offset="0" stopColor={body} stopOpacity={light ? .82 : .9} /><Stop offset=".5" stopColor={light ? '#ffffff' : body} /><Stop offset="1" stopColor={body} stopOpacity={light ? .8 : .85} /></LinearGradient></Defs>
    <Ellipse cx={1.4} cy={2.2} rx={7.6} ry={12.6} fill="#000" opacity={.22} />
    <Rect x={-6.6} y={-11.8} width={13.2} height={23.6} rx={4.4} fill={`url(#${id})`} stroke={light ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.12)'} strokeWidth={.6} />
    <Path d="M-5.2 -5.4 Q0 -7.6 5.2 -5.4 L4.4 -1.8 L-4.4 -1.8Z" fill="#0c1520" opacity={.86} />
    <Rect x={-4.4} y={-1.6} width={8.8} height={6.6} rx={1.6} fill={light ? '#dfe3e8' : body} opacity={.95} />
    <Path d="M-4.4 5.2 L4.4 5.2 L5 8.4 Q0 9.8 -5 8.4Z" fill="#0c1520" opacity={.75} />
    <Rect x={-5.6} y={-11.4} width={2.4} height={1.2} rx={.6} fill="#fff8e0" opacity={.9} /><Rect x={3.2} y={-11.4} width={2.4} height={1.2} rx={.6} fill="#fff8e0" opacity={.9} />
    <Rect x={-5.6} y={10.4} width={2.4} height={1} rx={.5} fill="#ff2b2b" opacity={.8} /><Rect x={3.2} y={10.4} width={2.4} height={1} rx={.5} fill="#ff2b2b" opacity={.8} />
  </G>;
}
export function V10VehicleMarker({ heading = 0, active = false, vehicleType, bodyType }: { heading?: number; active?: boolean; vehicleType?: string; bodyType?: string }) {
  useColorTheme();
  return <Svg width={50} height={50} viewBox="-25 -25 50 50"><G scale={active ? 1.25 : 1}>
    {active ? <><Circle r={20} fill={colors.accent} opacity={.1} /><Circle r={20} fill="none" stroke={colors.accent} strokeOpacity={.35} strokeWidth={1} /></> : null}
    <G rotation={heading}><V10VehicleBody vehicleType={vehicleType} bodyType={bodyType} /></G>
  </G></Svg>;
}

export function V10RasterCar({ car, projectX, projectY }: { car: { lat: number; lng: number; heading?: number }; projectX: (lng: number) => number; projectY: (lat: number) => number }) {
  const position = useSmoothPosition(car);
  if (!position) return null;
  return <G transform={`translate(${projectX(position.lng)}, ${projectY(position.lat)}) rotate(${position.heading})`}><V10VehicleBody /></G>;
}
