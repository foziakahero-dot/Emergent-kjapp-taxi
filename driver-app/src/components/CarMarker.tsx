import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, useColorTheme } from '@/src/theme';

/**
 * Figma map marker: forward-pointing red navigation/car glyph.
 * Heading 0 points north; map surfaces rotate it with the real backend heading.
 */
export function CarShape({
  body = colors.accent,
  shadow = 'rgba(255,0,0,0.24)',
}: {
  body?: string;
  roof?: string;
  glass?: string;
  shadow?: string;
}) {
  useColorTheme();
  return (
    <>
      <Circle cx={12} cy={12} r={11} fill={shadow} opacity={0.55} />
      <Path d="M12 2L19 20L12 16L5 20Z" fill={body} />
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

export const CAR_ACTIVE = { body: colors.accent, shadow: 'rgba(255,0,0,0.28)' };
export const CAR_IDLE = { body: colors.accent, shadow: 'rgba(255,0,0,0.18)' };
