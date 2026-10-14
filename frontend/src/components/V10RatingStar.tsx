import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useReducedMotion } from '@/src/components/Motion';
import { colors, useColorTheme } from '@/src/theme';

export function V10RatingStar({ number, selected, filled, disabled, onPress }: { number: number; selected: boolean; filled: boolean; disabled: boolean; onPress: () => void }) {
  useColorTheme();
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(filled ? 1.08 : 1)).current;
  useEffect(() => {
    if (reduced) { scale.setValue(filled ? 1.08 : 1); return; }
    const animation = Animated.timing(scale, { toValue: filled ? 1.08 : 1, duration: 240, easing: Easing.bezier(.34, 1.32, .52, 1), useNativeDriver: true });
    animation.start(); return () => animation.stop();
  }, [filled, reduced, scale]);
  return <Pressable testID={`rate-star-${number}`} disabled={disabled} onPress={onPress} accessibilityRole="radio" accessibilityLabel={`${number} stjerner`} accessibilityState={{ checked: selected, disabled }} style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}>
    <Animated.View style={{ transform: [{ scale }] }}><Svg width={34} height={34} viewBox="0 0 24 24"><Path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" fill={filled ? colors.text : 'none'} stroke={filled ? colors.text : colors.lineStrong} strokeWidth={1.6} strokeLinejoin="round" /></Svg></Animated.View>
  </Pressable>;
}
