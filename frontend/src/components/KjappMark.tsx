import React, { useId } from 'react';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

export function KjappMark({ size = 40 }: { size?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const fillId = `kjapp-mark-${uid}`;
  const radius = size * 0.28;

  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" accessibilityLabel="KJAPP">
      <Defs>
        <LinearGradient id={fillId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FF3B3B" />
          <Stop offset="0.55" stopColor="#FF0000" />
          <Stop offset="1" stopColor="#B30000" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="96" height="96" rx={radius * (96 / size)} fill={`url(#${fillId})`} />
      <Path d="M16 20L44 48L16 76" stroke="rgba(255,255,255,0.55)" strokeWidth="10.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M48 20L76 48L48 76" stroke="#FFFFFF" strokeWidth="10.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

export default KjappMark;
