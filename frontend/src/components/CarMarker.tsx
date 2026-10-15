import React from 'react';
import Svg, { Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { colors, useColorTheme } from '@/src/theme';

/**
 * Top-down SNAR vehicle marker.
 * Heading 0 points north; map surfaces rotate the complete marker using backend heading.
 */
export function CarShape({
  body = '#F7F8FA',
  roof = '#D7DCE1',
  glass = '#17212B',
  shadow = 'rgba(7,11,14,0.22)',
}: {
  body?: string;
  roof?: string;
  glass?: string;
  shadow?: string;
}) {
  useColorTheme();
  return (
    <>
      <Ellipse cx={12} cy={12.8} rx={8.3} ry={10.8} fill={shadow} opacity={0.38} />
      <Path
        d="M12 1.6C8.2 1.6 6.25 3.55 5.7 7.25L4.95 17.4C4.7 20.75 6.7 22.4 12 22.4C17.3 22.4 19.3 20.75 19.05 17.4L18.3 7.25C17.75 3.55 15.8 1.6 12 1.6Z"
        fill={body}
        stroke="rgba(7,11,14,0.34)"
        strokeWidth={0.7}
      />
      <Path
        d="M8.25 7.1C8.85 4.75 10.05 3.65 12 3.65C13.95 3.65 15.15 4.75 15.75 7.1L16.35 10.15H7.65L8.25 7.1Z"
        fill={glass}
      />
      <Path
        d="M7.7 13.15H16.3L15.85 17.2C15.55 19.05 14.35 20 12 20C9.65 20 8.45 19.05 8.15 17.2L7.7 13.15Z"
        fill={roof}
      />
      <Rect x={5.55} y={7.3} width={1.15} height={4.1} rx={0.55} fill="#111820" opacity={0.76} />
      <Rect x={17.3} y={7.3} width={1.15} height={4.1} rx={0.55} fill="#111820" opacity={0.76} />
      <Rect x={5.35} y={14.25} width={1.2} height={4.0} rx={0.55} fill="#111820" opacity={0.76} />
      <Rect x={17.45} y={14.25} width={1.2} height={4.0} rx={0.55} fill="#111820" opacity={0.76} />
      <Path d="M9.4 2.7H14.6" stroke="#FFFFFF" strokeWidth={0.9} strokeLinecap="round" opacity={0.88} />
      <Path d="M8.35 20.3H15.65" stroke={colors.accent} strokeWidth={0.8} strokeLinecap="round" opacity={0.58} />
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
  const gradientId = 'snar-car-body';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <LinearGradient id={gradientId} x1="7" y1="3" x2="17" y2="21">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#D8DDE2" />
        </LinearGradient>
      </Defs>
      <G>
        <CarShape {...props} body={props.body || `url(#${gradientId})`} />
      </G>
    </Svg>
  );
}

export const CAR_ACTIVE = {
  body: '#FFFFFF',
  roof: '#D8DDE2',
  glass: '#111A23',
  shadow: 'rgba(214,0,19,0.26)',
};

export const CAR_IDLE = {
  body: '#FFFFFF',
  roof: '#D8DDE2',
  glass: '#111A23',
  shadow: 'rgba(7,11,14,0.20)',
};
