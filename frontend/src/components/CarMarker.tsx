import React from 'react';
import Svg, { Ellipse, Path, Rect } from 'react-native-svg';
import { colors } from '@/src/theme';

/** Compact top-down car; its nose points north and map layers rotate it by GPS heading. */
export function CarShape({
  body = colors.accent,
  roof = colors.accentHover,
  glass = '#0A0F13',
  shadow = 'rgba(0,0,0,0.38)',
}: {
  body?: string;
  roof?: string;
  glass?: string;
  shadow?: string;
}) {
  return (
    <>
      <Ellipse cx={12} cy={13.2} rx={7.5} ry={10} fill={shadow} />
      <Path d="M8.5 3.1C9.1 2.5 10 2.2 12 2.2S14.9 2.5 15.5 3.1L17.4 7V18.1C17.4 20.2 15.8 21.4 13.9 21.4H10.1C8.2 21.4 6.6 20.2 6.6 18.1V7Z"
        fill={body} stroke="#E8FAFC" strokeOpacity={0.82} strokeWidth={0.75} />
      <Path d="M7.2 9.3H5.6V12.2H7.2M16.8 9.3H18.4V12.2H16.8" fill={body}
        stroke="#D7F7FA" strokeOpacity={0.6} strokeWidth={0.5} />
      <Path d="M8.3 8.5L9.2 5.7C10.9 5.1 13.1 5.1 14.8 5.7L15.7 8.5Z" fill={glass} />
      <Rect x={8.2} y={10.1} width={7.6} height={5.1} rx={1.4} fill={roof} opacity={0.94} />
      <Path d="M8.5 17.2H15.5L14.7 19H9.3Z" fill={glass} />
      <Path d="M8.2 3.8H9.7M14.3 3.8H15.8" stroke="#FFFFFF" strokeWidth={0.85} strokeLinecap="round" />
      <Path d="M8 19.9H9.7M14.3 19.9H16" stroke="#EF7476" strokeWidth={0.8} strokeLinecap="round" />
    </>
  );
}

export function CarSvg({
  size = 30,
  ...props
}: {
  size?: number;
  body?: string;
  roof?: string;
  glass?: string;
  shadow?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <CarShape {...props} />
    </Svg>
  );
}

export const CAR_ACTIVE = { body: colors.accent, roof: '#79F5FC', glass: '#19414B' };
export const CAR_IDLE = { body: '#75DCE5', roof: '#D9FBFD', glass: '#28505B' };
