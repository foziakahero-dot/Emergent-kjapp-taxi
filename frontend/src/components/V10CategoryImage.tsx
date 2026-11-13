import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { VehicleAsset, type VehicleKind } from './VehicleAsset';
import { useReducedMotion } from './Motion';

/** Booking and assistant use the exact approved SNAR 3D artwork while preserving API classes. */
export function V10CategoryImage({ kind, selected }: { kind: VehicleKind; selected: boolean }) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    progress.stopAnimation();
    if (reduced) { progress.setValue(selected ? 1 : 0); return; }
    const animation = Animated.timing(progress, { toValue: selected ? 1 : 0, duration: 260,
      easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start(); return () => animation.stop();
  }, [selected, reduced, progress]);
  return (
    <Animated.View style={{ width: 86, height: 58, flexShrink: 0, overflow: 'visible',
      transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) },
        { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 2] }) },
        { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }}>
      <VehicleAsset kind={kind} selected={selected} width={86} height={58} />
    </Animated.View>
  );
}
