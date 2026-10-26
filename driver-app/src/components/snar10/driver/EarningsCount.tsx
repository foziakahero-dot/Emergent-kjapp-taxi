import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { Text } from '@/src/components/Typography';
import { useReducedMotion } from '@/src/components/Motion';
import { colors, font, useColorTheme } from '@/src/theme';
import { kr } from '@/src/lib/format';
/** Animate only the confirmed server amount, never pending payment or a local estimate. */
export function EarningsCount({ amount }: { amount: number }) {
  useColorTheme();
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(amount);
  useEffect(() => {
    if (reduced) { setDisplay(amount); return; }
    // Native Animated supports listeners; test/platform shims may intentionally omit them.
    if (!progress.addListener) { setDisplay(amount); return; }
    progress.setValue(0); setDisplay(0);
    const listener = progress.addListener(({ value }) => setDisplay(amount * value));
    const animation = Animated.timing(progress, { toValue: 1, duration: 700, easing: Easing.bezier(0, 0, .58, 1), useNativeDriver: false });
    animation.start(({ finished }) => { if (finished) setDisplay(amount); });
    return () => { animation.stop(); progress.removeListener(listener); };
  }, [amount, reduced, progress]);
  return <Text accessibilityLabel={`Bekreftet inntekt ${kr(amount)}`} style={{ color: colors.text, fontFamily: font.semibold, fontSize: 52, lineHeight: 56, letterSpacing: -1.82, fontVariant: ['tabular-nums'] }}>{kr(display)}</Text>;
}
