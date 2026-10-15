import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, type TextStyle } from 'react-native';
import { Text } from '@/src/components/Typography';
import { useReducedMotion } from '@/src/components/Motion';

/** Summary-only animation of confirmed metrics. Missing values stay missing. */
export function V10CountUp({ value, format, style }: { value: unknown; format: (value: number) => string; style?: TextStyle | TextStyle[] }) {
  const valid = typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const [fraction, setFraction] = useState(reduced ? 1 : 0);
  useEffect(() => {
    if (!valid || reduced) { setFraction(1); return; }
    setFraction(0); progress.setValue(0);
    const listener = progress.addListener(({ value: next }) => setFraction(next));
    const animation = Animated.timing(progress, { toValue: 1, duration: 700, easing: Easing.bezier(.2, .8, .2, 1), useNativeDriver: false });
    animation.start(({ finished }) => { if (finished) setFraction(1); });
    return () => { animation.stop(); progress.removeListener(listener); };
  }, [valid, value, reduced, progress]);
  return <Text accessibilityLabel={valid ? format(value as number) : 'Ikke tilgjengelig'} style={style}>{valid ? format((value as number) * (reduced ? 1 : fraction)) : '—'}</Text>;
}
