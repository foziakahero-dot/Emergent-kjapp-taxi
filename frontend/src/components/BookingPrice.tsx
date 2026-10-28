import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { Text } from '@/src/components/Typography';
import { useReducedMotion } from '@/src/components/Motion';
import { colors, font, useColorTheme } from '@/src/theme';
import { kr } from '@/src/lib/format';

// Animate emphasis only; every displayed number remains the exact server quote.
export function BookingPrice({ amount, large = false }: { amount: number | null; large?: boolean }) {
  useColorTheme();
  const reduced = useReducedMotion();
  const emphasis = useRef(new Animated.Value(0)).current;
  const previous = useRef(amount);
  useEffect(() => {
    const changed = previous.current !== null && amount !== null && previous.current !== amount;
    previous.current = amount;
    emphasis.stopAnimation(); emphasis.setValue(0);
    if (!changed || reduced) return;
    const animation = Animated.sequence([
      Animated.timing(emphasis, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(emphasis, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]);
    animation.start(); return () => animation.stop();
  }, [amount, reduced, emphasis]);
  return <Animated.View style={{ transform: [{ scale: emphasis.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] }) }] }}>
    <Text accessibilityLiveRegion="polite" accessibilityLabel={amount === null ? 'Pris ikke tilgjengelig' : `Pris ${kr(amount)}`}
      style={{ fontFamily: font.bold, fontSize: large ? 32 : 19, lineHeight: large ? 40 : 26, letterSpacing: large ? -.8 : -.35, color: colors.text, fontVariant: ['tabular-nums'] }}>{amount === null ? '—' : kr(amount)}</Text>
  </Animated.View>;
}
