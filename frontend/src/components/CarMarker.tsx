import React from 'react';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { colors } from '@/src/theme';

/** Top-down vehicle marker. Its front points north; map layers rotate it by GPS heading. */
export function CarShape({
  body = colors.accent,
  roof = colors.accentHover,
  glass = '#0A0F13',
  shadow = 'rgba(0,0,0,0.35)',
}: {
  body?: string;
  roof?: string;
  glass?: string;
  shadow?: string;
}) {
  return (
    <>
      <Ellipse cx={12} cy={13} rx={11} ry={10.8} fill={shadow} />
      <Circle cx={12} cy={12} r={10.6} fill="#08141C" stroke={body} strokeOpacity={0.52} strokeWidth={1} />
      <Path
        d="M9 3.7 C7.2 3.7 6.8 5.5 6.8 7.3 L6.8 17 C6.8 19.1 8 20.3 9.8 20.3 L14.2 20.3 C16 20.3 17.2 19.1 17.2 17 L17.2 7.3 C17.2 5.5 16.8 3.7 15 3.7 Z"
        fill={body}
        stroke="#F4FFFF"
        strokeOpacity={0.65}
        strokeWidth={0.55}
      />
      <Path d="M8.6 8.4 L15.4 8.4 L14.7 6 C13.2 5.3 10.8 5.3 9.3 6 Z" fill={glass} />
      <Rect x={8.25} y={9.3} width={7.5} height={5.8} rx={1.7} fill={roof} />
      <Path d="M8.7 16.3 L15.3 16.3 L14.4 18.6 L9.6 18.6 Z" fill={glass} />
      <Path d="M8 4.8 L9.5 4.8 M14.5 4.8 L16 4.8" stroke="#FFFFFF" strokeWidth={0.8} strokeLinecap="round" />
      <Path d="M8 18.8 L9.2 18.8 M14.8 18.8 L16 18.8" stroke="#FF6B70" strokeWidth={0.7} strokeLinecap="round" />
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
