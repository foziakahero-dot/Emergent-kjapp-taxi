import React, { useId } from 'react';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors } from '@/src/theme';

type VehicleVariant = 'ai-first' | 'trygg' | 'premium' | 'enkelt' | string;

const VEHICLE_SHAPES = {
  'ai-first': {
    label: 'KJAPP standard sedan',
    body: 'M12 48 C15 39 23 34 38 32 L72 30 C82 30 91 34 99 42 L113 45 C117 46 120 49 120 53 L120 56 L8 56 L8 52 C8 50 9 49 12 48 Z',
    glass: 'M40 33 C45 26 51 23 59 23 L73 23 C81 23 87 28 93 36 L38 38 Z',
    wheels: [32, 96],
  },
  trygg: {
    label: 'KJAPP XL',
    body: 'M8 46 C10 35 18 29 31 27 L79 25 C91 25 100 31 108 42 L118 45 C122 47 124 50 124 54 L124 58 L6 58 L6 51 C6 49 7 47 8 46 Z',
    glass: 'M31 29 C36 21 42 18 51 18 L81 18 C89 18 97 25 103 36 L27 38 Z',
    wheels: [31, 99],
  },
  premium: {
    label: 'KJAPP Premium executive fastback',
    body: 'M5 50 C10 40 21 35 39 32 L75 25 C85 23 93 27 104 40 L119 45 C123 47 126 50 126 54 L126 57 L4 57 L4 53 C4 52 4 51 5 50 Z',
    glass: 'M40 32 C47 23 54 19 63 18 L77 17 C86 17 94 24 101 36 L34 39 Z',
    wheels: [31, 101],
  },
};

export function VehicleArtwork({
  variant,
  active = false,
  width = 116,
  height = 62,
}: {
  variant: VehicleVariant;
  active?: boolean;
  width?: number;
  height?: number;
}) {
  const shape = VEHICLE_SHAPES[variant as keyof typeof VEHICLE_SHAPES] || VEHICLE_SHAPES['ai-first'];
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const bodyId = `kjapp-body-${rawId}`;
  const glassId = `kjapp-glass-${rawId}`;
  const signal = active ? colors.accent : colors.textSecondary;

  return (
    <Svg width={width} height={height} viewBox="0 0 132 72" accessibilityRole="image" accessibilityLabel={shape.label}>
      <Defs>
        <LinearGradient id={bodyId} x1="18" y1="24" x2="108" y2="62" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={active ? '#3B4A55' : '#2A3640'} />
          <Stop offset="0.52" stopColor="#111B23" />
          <Stop offset="1" stopColor="#05090D" />
        </LinearGradient>
        <LinearGradient id={glassId} x1="54" y1="18" x2="75" y2="41" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#A8D9E2" stopOpacity={active ? 0.78 : 0.5} />
          <Stop offset="1" stopColor="#10202B" stopOpacity="0.96" />
        </LinearGradient>
      </Defs>

      <Ellipse cx="66" cy="62" rx="52" ry="5" fill="#000" opacity="0.34" />
      {active ? <Ellipse cx="66" cy="59" rx="56" ry="8" fill={colors.accent} opacity="0.06" /> : null}

      <Path d={shape.body} fill={`url(#${bodyId})`} stroke={signal} strokeOpacity={active ? 0.9 : 0.42} strokeWidth={active ? 1.5 : 1} />
      <Path d={shape.glass} fill={`url(#${glassId})`} stroke="#D8F7FA" strokeOpacity="0.2" strokeWidth="0.8" />
      <Path d="M15 48 C42 46 87 43 117 47" stroke="#F8FAFC" strokeOpacity="0.12" strokeWidth="0.9" />
      <Path d="M105 43 L117 46 L113 50 L102 49 Z" fill="#DFFBFF" opacity="0.92" />
      <Path d="M9 48 L18 46 L19 50 L8 52 Z" fill="#FF6B72" opacity="0.82" />

      {shape.wheels.map((x) => (
        <React.Fragment key={x}>
          <Circle cx={x} cy="57" r="9" fill="#04070A" stroke="#42515D" strokeWidth="1.2" />
          <Circle cx={x} cy="57" r="4.6" fill="#18242D" stroke={signal} strokeOpacity="0.7" strokeWidth="1" />
          <Circle cx={x} cy="57" r="1.4" fill="#C9D3DB" />
        </React.Fragment>
      ))}

      {variant === 'trygg' ? <Path d="M39 20 L91 20" stroke={signal} strokeOpacity="0.48" strokeWidth="1.5" strokeLinecap="round" /> : null}
      {variant === 'premium' ? <Path d="M42 51 L102 49" stroke={signal} strokeOpacity="0.6" strokeWidth="1.1" strokeLinecap="round" /> : null}
    </Svg>
  );
}
