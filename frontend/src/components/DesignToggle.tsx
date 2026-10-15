import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable } from 'react-native';
import { colors, useColorTheme } from '@/src/theme';
import { useReducedMotion } from '@/src/components/Motion';

/** Original 48 × 28 toggle; Tailwind's default 150 ms transition. */
export function DesignToggle({ value, onChange, label, disabled, testID }: { value: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean; testID?: string }) {
  useColorTheme();
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) { progress.setValue(value ? 1 : 0); return; }
    const animation = Animated.timing(progress, { toValue: value ? 1 : 0, duration: 150, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [value, reduced, progress]);
  return <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: value, disabled }} disabled={disabled} testID={testID} onPress={() => onChange(!value)} hitSlop={8}>
    <Animated.View style={{ width: 48, height: 28, borderRadius: 999, opacity: disabled ? 0.55 : 1, backgroundColor: progress.interpolate({ inputRange: [0, 1], outputRange: [colors.lineStrong, colors.accent] }) }}>
      <Animated.View style={{ position: 'absolute', top: 2, width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF', left: progress.interpolate({ inputRange: [0, 1], outputRange: [2, 22] }), boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.1)' }} />
    </Animated.View>
  </Pressable>;
}
