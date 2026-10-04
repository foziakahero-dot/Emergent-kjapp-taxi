import React from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/src/theme';

export function BrandBadge({ size = 64 }: { size?: number }) {
  return (
    <View
      accessibilityLabel="KJAPP Driver"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        overflow: 'hidden',
        shadowColor: colors.accent,
        shadowOpacity: 0.24,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
        elevation: 8,
      }}
    >
      <LinearGradient
        colors={['#FF4B4B', '#F71922', '#BA121C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      >
        <Svg width={size * 0.52} height={size * 0.52} viewBox="0 0 24 24" fill="none">
          <Path d="M4 5l7 7-7 7" stroke={colors.surface} strokeOpacity={0.55} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M12 5l7 7-7 7" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </LinearGradient>
    </View>
  );
}
