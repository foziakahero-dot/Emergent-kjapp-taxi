import React, { useId } from 'react';
import Svg, { Defs, Ellipse, LinearGradient, Path, Stop, Circle } from 'react-native-svg';
import { colors } from '@/src/theme';

type VehicleKind = 'ai-first' | 'trygg' | 'premium';

const VEHICLE_PATHS: Record<VehicleKind, {
  body: string;
  glass: string;
  wheels: [number, number];
  label: string;
}> = {
  'ai-first': {
    body: 'M13 47C16 35 25 28 41 25L76 23C87 23 96 28 105 38L119 42C123 43 126 46 126 50V54C126 57 123 59 120 59H17C13 59 10 56 11 52L13 47Z',
    glass: 'M41 28C46 21 53 18 61 18L78 18C85 18 92 23 99 33L102 37L34 38L41 28Z',
    wheels: [35, 101],
    label: 'KJAPP standardbil',
  },
  trygg: {
    body: 'M11 45C13 33 22 25 38 22L82 20C94 20 104 27 112 38L121 42C125 44 128 47 128 51V55C128 58 125 60 122 60H15C11 60 9 56 10 52L11 45Z',
    glass: 'M35 25C41 18 48 15 57 15L84 15C93 15 101 21 108 33L110 37L29 38L35 25Z',
    wheels: [36, 103],
    label: 'KJAPP XL',
  },
  premium: {
    body: 'M8 48C11 37 21 30 40 27L79 20C90 18 99 22 109 34L122 40C126 42 129 46 129 50V54C129 58 126 60 122 60H12C8 60 6 56 7 52L8 48Z',
    glass: 'M40 29C46 21 54 17 63 16L81 14C90 13 98 18 106 31L109 35L33 39L40 29Z',
    wheels: [33, 105],
    label: 'KJAPP Premium',
  },
};

export function VehicleAsset({
  kind,
  selected = false,
  width = 132,
  height = 72,
}: {
  kind: VehicleKind;
  selected?: boolean;
  width?: number;
  height?: number;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const v = VEHICLE_PATHS[kind];
  const body = `vehicle-body-${uid}`;
  const glass = `vehicle-glass-${uid}`;
  const accent = colors.accent;

  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 138 74"
      accessibilityRole="image"
      accessibilityLabel={v.label}
    >
      <Defs>
        <LinearGradient id={body} x1="18" y1="20" x2="108" y2="61">
          <Stop offset="0" stopColor={selected ? '#52616C' : '#34414B'} />
          <Stop offset="0.48" stopColor="#18232B" />
          <Stop offset="1" stopColor="#071016" />
        </LinearGradient>
        <LinearGradient id={glass} x1="48" y1="16" x2="82" y2="40">
          <Stop offset="0" stopColor="#D8F9FB" stopOpacity={selected ? 0.72 : 0.48} />
          <Stop offset="0.5" stopColor="#45606C" stopOpacity="0.82" />
          <Stop offset="1" stopColor="#12212A" stopOpacity="0.96" />
        </LinearGradient>
      </Defs>

      <Ellipse cx="69" cy="64" rx="52" ry="5" fill="#000" opacity="0.32" />
      {selected ? <Ellipse cx="70" cy="60" rx="56" ry="10" fill={accent} opacity="0.08" /> : null}

      <Path
        d={v.body}
        fill={`url(#${body})`}
        stroke={selected ? accent : '#657783'}
        strokeOpacity={selected ? 0.95 : 0.46}
        strokeWidth={selected ? 1.6 : 1.1}
      />
      <Path d={v.glass} fill={`url(#${glass})`} stroke="#BCEFF2" strokeOpacity="0.22" strokeWidth="0.8" />
      <Path d="M18 47C43 44 84 42 121 44" stroke="#F8FAFC" strokeOpacity="0.10" strokeWidth="1" />
      <Path d="M21 52H119" stroke={accent} strokeOpacity={selected ? 0.34 : 0.14} strokeWidth="0.9" />
      <Path d="M116 41L124 44L121 48L113 46Z" fill="#DDFBFD" opacity="0.9" />
      <Path d="M12 46L20 44L22 48L11 49Z" fill="#EF6B69" opacity="0.8" />

      {v.wheels.map((x) => (
        <React.Fragment key={x}>
          <Circle cx={x} cy="58" r="8.4" fill="#05090C" stroke="#43515A" strokeWidth="1.2" />
          <Circle cx={x} cy="58" r="4.7" fill="#1D2930" stroke={selected ? accent : '#6A7A83'} strokeWidth="1" />
          <Circle cx={x} cy="58" r="1.4" fill="#B8C4CA" />
        </React.Fragment>
      ))}

      {kind === 'trygg' ? (
        <Path d="M41 18H91" stroke={accent} strokeOpacity="0.42" strokeWidth="1.5" strokeLinecap="round" />
      ) : null}
      {kind === 'premium' ? (
        <Path d="M38 52H108" stroke={accent} strokeOpacity="0.48" strokeWidth="1.1" strokeLinecap="round" />
      ) : null}
    </Svg>
  );
}

export type { VehicleKind };
