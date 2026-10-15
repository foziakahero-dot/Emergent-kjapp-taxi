import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { useReducedMotion } from '@/src/components/Motion';
import { colors, useColorTheme } from '@/src/theme';

/** Original 48px listening glyph, driven by the recorder's actual audio meter. */
export function V10VoiceBars({ recording, metering }: { recording: boolean; metering?: number }) {
  useColorTheme();
  const reduced = useReducedMotion();
  const measured = recording && typeof metering === 'number' && Number.isFinite(metering);
  const level = measured ? .3 + .7 * Math.max(0, Math.min(1, (metering + 60) / 60)) : .3;
  const progress = useRef(new Animated.Value(level)).current;
  useEffect(() => {
    if (reduced) { progress.setValue(.3); return; }
    const animation = Animated.timing(progress, { toValue: level, duration: 150, easing: Easing.linear, useNativeDriver: true });
    animation.start(); return () => animation.stop();
  }, [level, reduced, progress]);
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="voice-meter" style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: colors.surfaceInverse, flexDirection: 'row', gap: 3, alignItems: 'center', justifyContent: 'center' }}>
    {[.7, .85, 1, .85, .7].map((factor, index) => <Animated.View key={index} style={{ width: 3, height: 20, borderRadius: 2, backgroundColor: colors.onInverse, transform: [{ scaleY: progress.interpolate({ inputRange: [.3, 1], outputRange: [.3, factor] }) }] }} />)}
  </View>;
}
