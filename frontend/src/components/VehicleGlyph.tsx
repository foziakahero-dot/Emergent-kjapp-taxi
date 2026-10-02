import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/src/theme';

export function VehicleGlyph({ selected }: { selected: boolean }) {
  return <Svg width={48} height={24} viewBox="0 0 48 24" fill={selected ? colors.accent : colors.textSecondary}>
    <Path d="M6 16l3-7a3 3 0 013-2h12a3 3 0 013 2l3 7v4h-4a3 3 0 01-6 0h-8a3 3 0 01-6 0H6z" />
  </Svg>;
}
