import { animation, toggle } from '@/src/theme/snar10';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable } from 'react-native';
import { colors, useColorTheme } from '@/src/theme';
import { useReducedMotion } from '@/src/components/Motion';

/** Fleet v2 50 × 30 toggle with the source positive tone and 210 ms transitions. */
export function Toggle({ value, onChange, label, disabled, testID }: { value: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean; testID?: string }) {
  useColorTheme();
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current;
  const thumb = useRef(new Animated.Value(value ? 1 : 0)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) { progress.setValue(value ? 1 : 0); thumb.setValue(value ? 1 : 0); return; }
    const animations = [
      Animated.timing(progress, { toValue: value ? 1 : 0, duration: animation.component, easing: Easing.bezier(.25, .1, .25, 1), useNativeDriver: false }),
      Animated.timing(thumb, { toValue: value ? 1 : 0, duration: animation.component, easing: Easing.bezier(...animation.easeSpring), useNativeDriver: false }),
    ];
    animations.forEach(animation => animation.start());
    return () => animations.forEach(animation => animation.stop());
  }, [value, reduced, progress, thumb]);
  return <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: value, disabled }} disabled={disabled} testID={testID} onPress={() => onChange(!value)} hitSlop={8}>
    <Animated.View style={{ width: toggle.width, height: toggle.height, borderRadius: 15, opacity: disabled ? 0.55 : 1, backgroundColor: progress.interpolate({ inputRange: [0, 1], outputRange: [colors.lineStrong, colors.success] }) }}>
      <Animated.View style={{ position: 'absolute', top: toggle.inset, width: toggle.thumb, height: toggle.thumb, borderRadius: 12, backgroundColor: '#FFFFFF', left: thumb.interpolate({ inputRange: [0, 1], outputRange: [toggle.inset, toggle.inset + toggle.travel] }), boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </Animated.View>
  </Pressable>;
}
