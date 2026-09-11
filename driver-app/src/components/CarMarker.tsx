import React from 'react';
import Svg, { Ellipse, Path, Rect } from 'react-native-svg';
import { colors } from '@/src/theme';

/**
 * Top-down car glyph (points "north" at heading 0). Rendered with a soft drop
 * shadow + a lighter roof panel to give a subtle 3D read instead of a flat dot.
 * `CarShape` returns raw SVG elements in a 0..24 space so it can be embedded
 * inside another <Svg> (MapCanvas). `CarSvg` is a standalone <Svg> for use as a
 * react-native-maps Marker child on native.
 */
export function CarShape({
  body = colors.accent,
  roof = colors.accentHover,
  glass = '#0A0F13',
  shadow = 'rgba(0,0,0,0.45)',
}: {
  body?: string;
  roof?: string;
  glass?: string;
  shadow?: string;
}) {
  return (
    <>
      <Ellipse cx={12} cy={13.5} rx={6.4} ry={10.2} fill={shadow} />
      <Path
        d="M9 2.6 Q6.7 2.6 6.7 6 L6.7 18 Q6.7 21.6 9.4 21.6 L14.6 21.6 Q17.3 21.6 17.3 18 L17.3 6 Q17.3 2.6 15 2.6 Z"
        fill={body}
      />
      <Path d="M8.3 8.4 L15.7 8.4 L14.6 6.2 Q12 5.4 9.4 6.2 Z" fill={glass} />
      <Path d="M8.8 16.4 L15.2 16.4 L14.4 18.8 Q12 19.4 9.6 18.8 Z" fill={glass} />
      <Rect x={8.2} y={9} width={7.6} height={6.6} rx={1.8} fill={roof} />
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

// palette presets
export const CAR_ACTIVE = { body: colors.accent, roof: colors.accentHover, glass: '#0A0F13' };
export const CAR_IDLE = { body: '#3B4650', roof: '#4C5862', glass: '#0A0F13' };
