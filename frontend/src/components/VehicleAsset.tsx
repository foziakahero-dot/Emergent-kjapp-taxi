import React, { useId } from 'react';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors } from '@/src/theme';

type VehicleKind = 'ai-first' | 'trygg' | 'premium';

const VEHICLE_SHAPES: Record<VehicleKind, {
  body: string;
  windows: string;
  belt: string;
  wheels: [number, number];
  label: string;
}> = {
  'ai-first': {
    body: 'M10 46C12 42 17 39 27 37L40 34L51 23C56 18 63 16 72 16H88C99 16 108 21 116 32L137 38C145 40 150 44 150 50V54C150 57 147 59 143 59H17C12 59 10 56 10 52Z',
    windows: 'M49 34L57 24C60 21 65 20 72 20H87C96 20 102 23 108 31L112 35H49Z',
    belt: 'M17 45C49 41 105 40 143 44',
    wheels: [39, 122],
    label: 'KJAPP',
  },
  trygg: {
    body: 'M8 45C10 40 15 37 26 35L40 33L46 23C50 17 56 15 66 15H103C111 15 117 19 122 29L135 33C145 36 151 41 151 49V54C151 57 148 59 144 59H16C11 59 8 56 8 52Z',
    windows: 'M44 34L51 23C54 20 58 19 66 19H101C109 19 113 22 117 30L120 35H44Z',
    belt: 'M15 44C49 41 112 39 146 44',
    wheels: [38, 123],
    label: 'KJAPP XL',
  },
  premium: {
    body: 'M6 49C9 44 15 41 27 39L45 35L59 22C64 17 72 15 82 15H100C112 15 121 21 129 33L143 38C150 41 154 45 154 51V54C154 57 151 59 146 59H13C9 59 6 56 6 53Z',
    windows: 'M54 35L64 24C68 20 74 19 82 19H99C109 19 115 23 121 32L124 36H54Z',
    belt: 'M13 47C46 43 112 40 148 45',
    wheels: [37, 125],
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
  const vehicle = VEHICLE_SHAPES[kind];
  const bodyId = 'vehicle-body-' + uid;
  const glassId = 'vehicle-glass-' + uid;

  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 160 80"
      accessibilityRole="image"
      accessibilityLabel={vehicle.label}
    >
      <Defs>
        <LinearGradient id={bodyId} x1="16" y1="18" x2="130" y2="62">
          <Stop offset="0" stopColor={kind === 'premium' ? '#56616A' : '#47535C'} />
          <Stop offset="0.48" stopColor="#27333B" />
          <Stop offset="1" stopColor="#121C24" />
        </LinearGradient>
        <LinearGradient id={glassId} x1="64" y1="18" x2="99" y2="38">
          <Stop offset="0" stopColor="#B9D4DC" />
          <Stop offset="0.55" stopColor="#526977" />
          <Stop offset="1" stopColor="#263A46" />
        </LinearGradient>
      </Defs>

      <Ellipse cx="80" cy="67" rx="67" ry="5" fill="#000" opacity="0.28" />
      {vehicle.wheels.map((x) => (
        <Circle key={'tire-' + x} cx={x} cy="57" r="9.5" fill="#080D12" />
      ))}
      <Path
        d={vehicle.body}
        fill={'url(#' + bodyId + ')'}
        stroke={selected ? colors.accent : '#8999A1'}
        strokeOpacity={selected ? 0.88 : 0.58}
        strokeWidth={selected ? 1.5 : 1}
      />
      <Path d={vehicle.windows} fill={'url(#' + glassId + ')'} stroke="#A8C2CB" strokeOpacity="0.42" strokeWidth="0.8" />
      <Path d={vehicle.belt} fill="none" stroke="#D1DDE1" strokeOpacity="0.24" strokeWidth="1" />
      <Path d="M75 20L73 35M105 23L110 35" fill="none" stroke="#182832" strokeWidth="2.2" />
      {kind === 'trygg' ? (
        <Path d="M57 15H105M53 19H108" fill="none" stroke="#A2AFB6" strokeOpacity="0.55" strokeWidth="1.2" />
      ) : null}
      {kind === 'premium' ? (
        <Path d="M27 51H137" fill="none" stroke={colors.accent} strokeOpacity={selected ? 0.58 : 0.26} strokeWidth="1.2" />
      ) : null}
      <Path d="M141 42L151 46V49L141 48Z" fill="#D7E9ED" opacity="0.78" />
      <Path d="M9 47L18 45V49L8 51Z" fill="#AF4D4C" opacity="0.58" />
      {vehicle.wheels.map((x) => (
        <React.Fragment key={'hub-' + x}>
          <Circle cx={x} cy="57" r="6.5" fill="#151D24" stroke="#77858C" strokeOpacity="0.68" strokeWidth="1.1" />
          <Circle cx={x} cy="57" r="3.3" fill="#4B5A62" stroke="#A5B2B8" strokeOpacity="0.7" strokeWidth="0.8" />
        </React.Fragment>
      ))}
    </Svg>
  );
}

export type { VehicleKind };
