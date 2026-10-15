import React, { useId } from 'react';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { Float } from '@/src/components/Motion';

/** Original SNAR V10 mark, with unchanged paths and gradient geometry. */
export function BrandBadge({ size = 64, float = false }: { size?: number; float?: boolean }) {
  const id = `snar-mark-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const mark = <Svg accessibilityLabel="SNAR" width={size} height={size} viewBox="0 0 100 100">
    <Defs><LinearGradient id={id} x1="10%" y1="-7%" x2="90%" y2="107%">
      <Stop offset="0" stopColor="#ff3b3b" /><Stop offset=".55" stopColor="#ff0000" /><Stop offset="1" stopColor="#b30000" />
    </LinearGradient></Defs>
    <Rect width={100} height={100} rx={26} fill={`url(#${id})`} />
    <Path d="M28 29l21 21-21 21" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M53 29l21 21-21 21" fill="none" stroke="white" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>;
  return float ? <Float>{mark}</Float> : mark;
}
