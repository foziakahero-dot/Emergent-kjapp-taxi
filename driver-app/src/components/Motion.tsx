import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Animated, Easing, type ViewProps } from 'react-native';

export const figmaEase = Easing.bezier(0.22, 1, 0.36, 1);
export const cssEase = Easing.bezier(0.25, 0.1, 0.25, 1);
export const cssEaseOut = Easing.bezier(0, 0, 0.58, 1);
export const cssEaseInOut = Easing.bezier(0.42, 0, 0.58, 1);

let reducedMotion = true;
let revision = 0;
let subscription: ReturnType<typeof AccessibilityInfo.addEventListener> | undefined;
const listeners = new Set<() => void>();
function updateReducedMotion(value: boolean) {
  reducedMotion = value;
  listeners.forEach(listener => listener());
}
function subscribeReducedMotion(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    const requestRevision = ++revision;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (revision === requestRevision) updateReducedMotion(value); }).catch(() => {});
    subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', updateReducedMotion);
  }
  return () => { listeners.delete(listener); if (listeners.size === 0) { revision++; subscription?.remove(); subscription = undefined; } };
}
export function useReducedMotion() {
  return useSyncExternalStore(subscribeReducedMotion, () => reducedMotion, () => true);
}

export function Rise({ delay = 0, style, ...props }: ViewProps & { delay?: number }) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { progress.setValue(1); return; }
    progress.setValue(0);
    const animation = Animated.timing(progress, { toValue: 1, delay, duration: 700, easing: figmaEase, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [delay, progress, reduced]);
  return <Animated.View {...props} style={[style, { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]} />;
}

export function Float({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    progress.setValue(0);
    if (reduced) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(progress, { toValue: -6, duration: 2000, easing: cssEaseInOut, useNativeDriver: true }),
      Animated.timing(progress, { toValue: 0, duration: 2000, easing: cssEaseInOut, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [progress, reduced]);
  return <Animated.View style={{ transform: [{ translateY: progress }] }}>{children}</Animated.View>;
}

export function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const [height, setHeight] = useState(0);
  const progress = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { progress.setValue(open ? 1 : 0); return; }
    const animation = Animated.timing(progress, { toValue: open ? 1 : 0, duration: 300, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [open, progress, reduced]);
  return <Animated.View pointerEvents={open ? 'auto' : 'none'} accessibilityElementsHidden={!open} importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
    style={{ height: progress.interpolate({ inputRange: [0, 1], outputRange: [0, height] }), opacity: progress, overflow: 'hidden' }}>
    <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0 }} onLayout={event => setHeight(event.nativeEvent.layout.height)}>{children}</Animated.View>
  </Animated.View>;
}
