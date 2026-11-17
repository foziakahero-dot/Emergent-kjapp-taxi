import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors, useColorTheme } from '@/src/theme';

/**
 * Lightweight north-facing car; map surfaces rotate it with measured heading.
 * Heading 0 points north; map surfaces rotate it with the real backend heading.
 */
export function CarShape({
  body = '#A6B3C3',
  shadow = colors.positiveSoft,
}: {
  body?: string;
  roof?: string;
  glass?: string;
  shadow?: string;
}) {
  useColorTheme();
  return (
    <>
      <Path d="M12 0 5 8Q12 5 19 8Z" fill={colors.success} opacity={.6} />
      <Circle cx={12} cy={14} r={9} fill={shadow} />
      <Rect x={5.7} y={9} width={2} height={4} rx={.7} fill="#08131F" />
      <Rect x={16.3} y={9} width={2} height={4} rx={.7} fill="#08131F" />
      <Rect x={5.7} y={17} width={2} height={4} rx={.7} fill="#08131F" />
      <Rect x={16.3} y={17} width={2} height={4} rx={.7} fill="#08131F" />
      <Path d="M8 6Q12 3.8 16 6L17 11V20Q12 23 7 20V11Z" fill={body} stroke="#EEF2F7" strokeWidth={.7} />
      <Path d="M8.3 10.3Q12 8.4 15.7 10.3L14.7 13H9.3Z" fill="#142538" />
      <Path d="M9.3 17H14.7L15.5 19Q12 20 8.5 19Z" fill="#142538" />
      <Path d="M9.5 13.8H14.5V16.2H9.5Z" fill="#D5DCE5" opacity={.75} />
      <Path d="M8.5 7H10M14 7H15.5" stroke="#FFFFFF" strokeWidth={1} />
      <Path d="M8.5 20H10M14 20H15.5" stroke="#FF5468" strokeWidth={1} />
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
  useColorTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <CarShape {...props} />
    </Svg>
  );
}

export const CAR_ACTIVE = { body: '#A6B3C3', shadow: 'rgba(60,207,154,.16)' };
export const CAR_IDLE = { body: '#A6B3C3', shadow: 'rgba(60,207,154,.08)' };
