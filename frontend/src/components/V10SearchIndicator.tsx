import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useReducedMotion } from '@/src/components/Motion';
import { colors, useColorTheme } from '@/src/theme';

/** Decorative source activity only; server trip state owns matching progress. */
export function V10SearchIndicator({ bar = false }: { bar?: boolean }) {
  useColorTheme();
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);
  useEffect(() => {
    progress.setValue(0);
    if (reduced) return;
    const loop = Animated.loop(Animated.timing(progress, { toValue: 1, duration: bar ? 1500 : 1400, easing: Easing.linear, useNativeDriver: true }));
    loop.start(); return () => loop.stop();
  }, [bar, progress, reduced]);
  return bar ? <View testID="matching-activity-bar" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ height: 3, borderRadius: 2, overflow: 'hidden', backgroundColor: colors.cardSubtle, marginVertical: 22 }}>
    <Animated.View style={{ height: 3, width: '40%', backgroundColor: colors.accent, transform: [{ translateX: reduced ? 0 : progress.interpolate({ inputRange: [0, 1], outputRange: [-width * .4, width] }) }] }} />
  </View> : <View testID="matching-activity-icon" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardSubtle }}>
    <Animated.View style={{ width: 28, height: 28, transform: [{ rotate: reduced ? '0deg' : progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
      <Svg width={28} height={28} viewBox="0 0 28 28"><Circle cx={14} cy={14} r={11} fill="none" stroke={colors.accent} strokeWidth={2} strokeDasharray="16 60" strokeLinecap="round" /></Svg>
    </Animated.View>
  </View>;
}
