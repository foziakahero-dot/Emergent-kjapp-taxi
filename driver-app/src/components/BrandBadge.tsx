import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { FigmaGradient } from '@/src/components/FigmaGradient';
import { Float } from '@/src/components/Motion';

export function BrandBadge({ size = 64, float = false }: { size?: number; float?: boolean }) {
  const mark = (
    <View accessibilityLabel="SNAR" style={{ width: size, height: size, borderRadius: size * 0.28, boxShadow: '0 12px 30px rgba(255,0,0,0.35)' }}>
      <FigmaGradient angle={145} colors={['#FF3B3B', '#FF0000', '#B30000']} locations={[0, 0.55, 1]}
        style={{ flex: 1, borderRadius: size * 0.28, alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)' }}>
        <Svg width={size * 0.52} height={size * 0.52} viewBox="0 0 24 24" fill="none">
          <Path d="M4 5l7 7-7 7" stroke="rgba(255,255,255,0.55)" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M12 5l7 7-7 7" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </FigmaGradient>
    </View>
  );
  return float ? <Float>{mark}</Float> : mark;
}
