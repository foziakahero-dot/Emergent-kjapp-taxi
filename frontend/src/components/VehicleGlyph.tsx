import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors } from '@/src/theme';
export function VehicleGlyph({ selected, kind = 'ai-first' }: { selected: boolean; kind?: string }) {
  const art: Record<string, React.ReactNode> = {
    'ai-first': <><Path d="M4 18 L6 12.5 C6.8 10.4 8.3 9.6 10.3 9.6 L18 9.6 L20.6 6.8 C21.4 6.2 22.2 6 23.2 6 L28.8 6 C30.8 6 32.2 6.9 33.2 8.8 L34.2 10.6 L43 12.2 C44.5 12.6 45 13.6 45 15 L45 18 Z" />
      <Circle cx="13.5" cy="18.2" r="3.2" />
      <Circle cx="35" cy="18.2" r="3.2" /></>,
    'trygg': <><Path d="M3 18 L3 9.5 C3 7.8 4.2 7 6 7 L34 7 C36.2 7 37.6 7.8 38.6 9.4 L44 12.2 C45.6 13 46 13.8 46 15 L46 18 Z" />
      <Circle cx="13" cy="18.2" r="3.2" />
      <Circle cx="37" cy="18.2" r="3.2" /></>,
    'premium': <><Path d="M2 18 L3 14.2 C3.6 12.3 5.4 11.6 8 11.6 L14.5 8.2 C17.5 6.2 21.4 5.4 26 5.4 C30.4 5.4 33.6 6.4 36.8 9 L44.8 12 C46.4 12.5 47 13.6 47 15 L47 18 Z" />
      <Circle cx="12" cy="18.3" r="3.4" />
      <Circle cx="38" cy="18.3" r="3.4" /></>,
  };
  return <Svg width={48} height={24} viewBox="0 0 48 24" fill={selected ? colors.accent : colors.textSecondary}>{art[kind] || art['ai-first']}</Svg>;
}
