import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, type ViewProps } from 'react-native';
import { useReducedMotion } from './Motion';

/** Source s10-in (210ms/8px) and s10-sheet (280ms/40% of measured height). */
export function V10Entrance({ delay = 0, sheet = false, onLayout, style, ...props }: ViewProps & { delay?: number; sheet?: boolean }) {
  const reduced = useReducedMotion();
  const [height, setHeight] = useState(0);
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { progress.setValue(1); return; }
    if (sheet && !height) return;
    progress.setValue(0);
    const animation = Animated.timing(progress, { toValue: 1, delay, duration: sheet ? 280 : 210,
      easing: sheet ? Easing.bezier(.34, 1.32, .52, 1) : Easing.bezier(.2, .8, .2, 1), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [reduced, delay, sheet, height, progress]);
  return <Animated.View {...props} onLayout={event => { if (sheet) setHeight(previous => previous || event.nativeEvent.layout.height); onLayout?.(event); }} style={[style, {
    opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [sheet ? .4 : 0, 1] }),
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [sheet ? height * .4 : 8, 0] }) }],
  }]} />;
}
