import React, { useId } from 'react';
import Svg, { Defs, Ellipse, LinearGradient, Path, Stop, Circle, G } from 'react-native-svg';
import { colors } from '@/src/theme';

type VehicleKind = 'ai-first' | 'trygg' | 'premium';

type VehicleSpec = {
  body: string;
  glass: string;
  wheels: [number, number];
  label: string;
  bodyTop: string;
  bodyMid: string;
  bodyBottom: string;
  glassTop: string;
  glassBottom: string;
  stroke: string;
  accent: string;
  headlight: string;
  taillight: string;
};

const VEHICLES: Record<VehicleKind, VehicleSpec> = {
  'ai-first': {
    body: 'M10 49C12 39 21 32 35 29L78 24C90 23 99 28 108 39L121 43C126 45 129 49 128 54C128 58 124 61 119 61H17C11 61 8 57 10 49Z',
    glass: 'M39 31C45 23 53 19 63 19H78C87 19 95 24 102 35L105 39L31 40L39 31Z',
    wheels: [33, 103],
    label: 'SNAR',
    bodyTop: '#FFFFFF',
    bodyMid: '#E7ECF1',
    bodyBottom: '#AAB4BE',
    glassTop: '#BFD7E7',
    glassBottom: '#15222E',
    stroke: '#7A8792',
    accent: '#3B82F6',
    headlight: '#DDF8FF',
    taillight: '#E34850',
  },
  trygg: {
    body: 'M8 48C9 35 19 27 35 24L86 21C98 21 108 28 115 40L124 43C129 45 131 49 130 54C130 58 126 61 121 61H15C9 61 7 57 8 48Z',
    glass: 'M34 27C40 19 49 15 60 15H87C97 15 105 21 111 34L113 39L27 40L34 27Z',
    wheels: [35, 106],
    label: 'SNAR XL',
    bodyTop: '#FFFFFF',
    bodyMid: '#E8EDF2',
    bodyBottom: '#9EAAB5',
    glassTop: '#B9D4E7',
    glassBottom: '#111D27',
    stroke: '#75828E',
    accent: '#4EA1FF',
    headlight: '#E4FAFF',
    taillight: '#E24B53',
  },
  premium: {
    body: 'M7 50C10 39 20 32 39 28L82 21C93 19 103 24 112 37L124 42C129 44 131 48 130 53C130 58 126 61 121 61H13C7 61 5 56 7 50Z',
    glass: 'M40 30C46 22 55 17 65 16L83 15C93 14 101 20 108 33L111 37L33 40L40 30Z',
    wheels: [33, 106],
    label: 'Premium',
    bodyTop: '#3B4047',
    bodyMid: '#151A20',
    bodyBottom: '#05080B',
    glassTop: '#73808B',
    glassBottom: '#080D12',
    stroke: '#6D737A',
    accent: '#D5A94E',
    headlight: '#F2F7FF',
    taillight: '#B82C35',
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
  const spec = VEHICLES[kind];
  const bodyId = `vehicle-body-${uid}`;
  const glassId = `vehicle-glass-${uid}`;
  const rimId = `vehicle-rim-${uid}`;

  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 138 74"
      accessibilityRole="image"
      accessibilityLabel={spec.label}
    >
      <Defs>
        <LinearGradient id={bodyId} x1="20" y1="20" x2="110" y2="63">
          <Stop offset="0" stopColor={spec.bodyTop} />
          <Stop offset="0.48" stopColor={spec.bodyMid} />
          <Stop offset="1" stopColor={spec.bodyBottom} />
        </LinearGradient>
        <LinearGradient id={glassId} x1="48" y1="15" x2="84" y2="41">
          <Stop offset="0" stopColor={spec.glassTop} stopOpacity="0.92" />
          <Stop offset="0.58" stopColor="#30404D" stopOpacity="0.92" />
          <Stop offset="1" stopColor={spec.glassBottom} stopOpacity="0.98" />
        </LinearGradient>
        <LinearGradient id={rimId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#EFF3F6" />
          <Stop offset="0.5" stopColor="#6F7A84" />
          <Stop offset="1" stopColor="#20272D" />
        </LinearGradient>
      </Defs>

      <Ellipse cx="69" cy="64" rx={kind === 'trygg' ? 57 : 54} ry="5.6" fill="#000" opacity="0.28" />
      {selected ? <Ellipse cx="70" cy="60" rx="59" ry="10" fill={colors.accent} opacity="0.10" /> : null}

      <Path
        d={spec.body}
        fill={`url(#${bodyId})`}
        stroke={selected ? colors.accent : spec.stroke}
        strokeWidth={selected ? 1.7 : 1.05}
        strokeOpacity={selected ? 0.96 : 0.72}
      />

      <Path d={spec.glass} fill={`url(#${glassId})`} stroke="#DDE8F0" strokeOpacity="0.30" strokeWidth="0.85" />

      <Path d="M22 45C48 41 90 40 121 44" stroke="#FFFFFF" strokeOpacity={kind === 'premium' ? 0.12 : 0.52} strokeWidth="1.25" strokeLinecap="round" />
      <Path d="M20 52C46 51 94 50 120 51" stroke={spec.accent} strokeOpacity={selected ? 0.50 : 0.24} strokeWidth="0.9" strokeLinecap="round" />
      <Path d="M59 22L58 39" stroke="#D8E2E8" strokeOpacity="0.22" strokeWidth="0.8" />
      <Path d="M83 20L84 38" stroke="#D8E2E8" strokeOpacity="0.18" strokeWidth="0.8" />

      {kind === 'trygg' ? (
        <>
          <Path d="M38 16H95" stroke="#65727D" strokeWidth="1.7" strokeLinecap="round" />
          <Path d="M43 13.7V17.2M91 13.7V17.2" stroke="#7C8993" strokeWidth="1.4" strokeLinecap="round" />
        </>
      ) : null}

      {kind === 'premium' ? (
        <Path d="M43 55H111" stroke={spec.accent} strokeOpacity="0.55" strokeWidth="1" strokeLinecap="round" />
      ) : null}

      <Path d="M115 40L126 44L123 48L112 46Z" fill={spec.headlight} opacity="0.95" />
      <Path d="M9 46L20 43L22 47L9 50Z" fill={spec.taillight} opacity="0.88" />

      {spec.wheels.map((x) => (
        <G key={x}>
          <Circle cx={x} cy="58.5" r="8.8" fill="#05080B" stroke="#323A41" strokeWidth="1.2" />
          <Circle cx={x} cy="58.5" r="5.4" fill={`url(#${rimId})`} stroke="#A6B0B7" strokeOpacity="0.45" strokeWidth="0.75" />
          <Circle cx={x} cy="58.5" r="1.5" fill="#D8DEE3" />
          <Path d={`M${x - 4} 58.5H${x + 4}M${x} 54.5V62.5`} stroke="#E9EEF2" strokeOpacity="0.55" strokeWidth="0.65" />
        </G>
      ))}
    </Svg>
  );
}

export type { VehicleKind };
