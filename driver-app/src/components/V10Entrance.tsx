import { animation as motionTokens } from '@/src/theme/snar10';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, type ViewProps } from 'react-native';
import { useReducedMotion } from './Motion';

/** Source s10-in (210ms/8px), s10-sheet (280ms/40%) and s10-pop (320ms/.94 scale). */
export function V10Entrance({ delay = 0, sheet = false, pop = false, fade = false, onLayout, style, ...props }: ViewProps & { delay?: number; sheet?: boolean; pop?: boolean; fade?: boolean }) {
  const reduced = useReducedMotion();
  const [height, setHeight] = useState(0);
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { progress.setValue(1); return; }
    if (sheet && !height) return;
    progress.setValue(0);
    const animation = Animated.timing(progress, { toValue: 1, delay, duration: pop ? motionTokens.pop : sheet ? motionTokens.sheet : fade ? motionTokens.fade : motionTokens.component,
      easing: sheet || pop ? Easing.bezier(...motionTokens.easeSpring) : Easing.bezier(...motionTokens.easeOut), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [reduced, delay, sheet, pop, fade, height, progress]);
  return <Animated.View {...props} onLayout={event => { if (sheet) setHeight(previous => previous || event.nativeEvent.layout.height); onLayout?.(event); }} style={[style, {
    opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [sheet ? .4 : 0, 1] }),
    transform: pop ? [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [.94, 1] }) }] : fade ? [] : [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [sheet ? height * .4 : 8, 0] }) }],
  }]} />;
}
