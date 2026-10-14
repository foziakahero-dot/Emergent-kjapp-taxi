import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { V10Entrance } from '@/src/components/V10Entrance';
import { useReducedMotion } from '@/src/components/Motion';
import { colors, useColorTheme } from '@/src/theme';

/** Original 88px payment mark; source path, 420ms draw after 160ms, no confetti. */
export function V10PaymentCheck() {
  useColorTheme();
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const [fraction, setFraction] = useState(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) { setFraction(1); return; }
    setFraction(0); progress.setValue(0);
    const listener = progress.addListener(({ value }) => setFraction(value));
    const animation = Animated.timing(progress, { toValue: 1, delay: 160, duration: 420, easing: Easing.bezier(.2, .8, .2, 1), useNativeDriver: false });
    animation.start(({ finished }) => { if (finished) setFraction(1); });
    return () => { animation.stop(); progress.removeListener(listener); };
  }, [reduced, progress]);
  return <V10Entrance pop><Svg width={88} height={88} viewBox="0 0 88 88" accessibilityLabel="Betaling bekreftet">
    <Circle cx={44} cy={44} r={42} fill={colors.positiveSoft} />
    <Path testID="payment-check-path" d="M28 45l11 11 21-23" fill="none" stroke={colors.success} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="47 47" strokeDashoffset={47 * (1 - (reduced ? 1 : fraction))} />
  </Svg></V10Entrance>;
}
