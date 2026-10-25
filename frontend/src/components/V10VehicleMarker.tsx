import React, { useId } from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { useSmoothPosition } from './useSmoothPosition';
import { colors, useColorTheme } from '@/src/theme';

/** Original reference/snar-v10-design/src/snar10/kit.tsx VehicleMarker geometry. */
export function V10VehicleBody({ color }: { color?: string }) {
  const theme = useColorTheme();
  const body = color || (theme.effective === 'dark' ? '#e9ecef' : '#1b1f24');
  const light = body === '#e9ecef' || body === '#ffffff';
  const id = `v10-car-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const glass = light ? '#27313d' : '#0b1118';
  const roof = light ? '#f6f8fa' : '#2a3038';
  const edge = light ? 'rgba(0,0,0,.22)' : 'rgba(255,255,255,.16)';
  return <>
    <Defs>
      <LinearGradient id={id} x1="0" x2="1"><Stop offset="0" stopColor={body} stopOpacity={light ? .78 : .92} /><Stop offset=".5" stopColor={light ? '#ffffff' : body} /><Stop offset="1" stopColor={body} stopOpacity={light ? .78 : .88} /></LinearGradient>
      <LinearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={glass} stopOpacity={.95} /><Stop offset="1" stopColor={glass} stopOpacity={.75} /></LinearGradient>
    </Defs>
    <Ellipse cx={1.2} cy={2} rx={9} ry={16.8} fill="#000" opacity={.26} />
    <Rect x={-9.1} y={-6.6} width={2.4} height={1.8} rx={.8} fill={body} stroke={edge} strokeWidth={.4} />
    <Rect x={6.7} y={-6.6} width={2.4} height={1.8} rx={.8} fill={body} stroke={edge} strokeWidth={.4} />
    <Path d="M-6.4 -12.4 Q-6.8 -15.4 -3.6 -15.9 Q0 -16.4 3.6 -15.9 Q6.8 -15.4 6.4 -12.4 L7.3 -6 L7.3 11.2 Q7.3 15.4 3.8 15.8 Q0 16.2 -3.8 15.8 Q-7.3 15.4 -7.3 11.2 L-7.3 -6Z"
      fill={`url(#${id})`} stroke={edge} strokeWidth={.5} />
    <Path d="M-3.2 -14.6 Q0 -15.2 3.2 -14.6" stroke={light ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.14)'} strokeWidth={.5} fill="none" />
    <Path d="M-5.6 -6.2 Q0 -8.8 5.6 -6.2 L4.9 -1.6 Q0 -2.6 -4.9 -1.6Z" fill={`url(#${id}g)`} />
    <Path d="M-6.3 -1 L-5.4 -0.6 L-5.4 7.2 L-6.3 8Z" fill={glass} opacity={.82} />
    <Path d="M6.3 -1 L5.4 -0.6 L5.4 7.2 L6.3 8Z" fill={glass} opacity={.82} />
    <Rect x={-4.9} y={-1.4} width={9.8} height={8.4} rx={1.8} fill={roof} opacity={.96} />
    <Path d="M-4.9 7.6 Q0 8.4 4.9 7.6 L5.5 10.8 Q0 12.2 -5.5 10.8Z" fill={`url(#${id}g)`} opacity={.9} />
    <Path d="M-5.9 -14.4 Q-5 -15.4 -3.2 -15.5 L-3.6 -14.2Z" fill="#fff6d6" />
    <Path d="M5.9 -14.4 Q5 -15.4 3.2 -15.5 L3.6 -14.2Z" fill="#fff6d6" />
    <Rect x={-6} y={14.2} width={3} height={1} rx={.5} fill="#ff2b2b" opacity={.9} />
    <Rect x={3} y={14.2} width={3} height={1} rx={.5} fill="#ff2b2b" opacity={.9} />
  </>;
}
export function V10VehicleMarker({ heading = 0, active = false }: { heading?: number; active?: boolean }) {
  useColorTheme();
  return <Svg width={50} height={50} viewBox="-25 -25 50 50"><G scale={active ? 1.25 : 1}>
    {active ? <><Circle r={20} fill={colors.accent} opacity={.1} /><Circle r={20} fill="none" stroke={colors.accent} strokeOpacity={.35} strokeWidth={1} /></> : null}
    <G rotation={heading}><V10VehicleBody /></G>
  </G></Svg>;
}

export function V10RasterCar({ car, projectX, projectY }: { car: { lat: number; lng: number; heading?: number; eta_min?: number }; projectX: (lng: number) => number; projectY: (lat: number) => number }) {
  useColorTheme();
  const position = useSmoothPosition(car);
  if (!position) return null;
  const minutes = Number.isFinite(car.eta_min) && Number(car.eta_min) > 0 ? Math.ceil(Number(car.eta_min)) : null;
  return <G transform={`translate(${projectX(position.lng)}, ${projectY(position.lat)})`}>
    <G rotation={position.heading}><V10VehicleBody /></G>
    <Rect x={-40} y={-42} width={80} height={20} rx={10} fill={colors.online} />
    <SvgText y={-28} textAnchor="middle" fontSize={10} fontWeight="600" fill="#FFFFFF">LEDIG{minutes ? ` · ${minutes} min` : ''}</SvgText>
  </G>;
}
