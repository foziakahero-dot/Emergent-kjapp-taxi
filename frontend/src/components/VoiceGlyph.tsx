import React from 'react';
import Svg, { Path, Line } from 'react-native-svg';
import { colors } from '@/src/theme';

export function VoiceGlyph({ size = 22, color = colors.text }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <Line x1="12" y1="19" x2="12" y2="22" />
      <Line x1="8" y1="22" x2="16" y2="22" />
    </Svg>
  );
}
