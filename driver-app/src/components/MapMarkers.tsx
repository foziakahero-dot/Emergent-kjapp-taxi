import React, { useEffect, useId, useRef } from 'react';
import { Animated, View } from 'react-native';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';
import { cssEaseOut, useReducedMotion } from '@/src/components/Motion';

export function MapCar({ heading = 0 }: { heading?: number }) {
  const id = `car-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return <Svg width={30} height={30} viewBox="0 0 30 30">
    <Defs><RadialGradient id={id}><Stop offset="0" stopColor="#FF0000" stopOpacity={0.22} /><Stop offset="0.7" stopColor="#FF0000" stopOpacity={0} /></RadialGradient></Defs>
    <Circle cx={15} cy={15} r={15} fill={`url(#${id})`} />
    <G transform={`translate(6 6) scale(0.75) rotate(${heading} 12 12)`}><Path d="M12 2l7 18-7-4-7 4z" fill="#FF0000" /></G>
  </Svg>;
}

export function PositionDot() {
  const id = `position-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const reduced = useReducedMotion();
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    pulse.setValue(0);
    if (reduced) return;
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 2400, easing: cssEaseOut, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse, reduced]);
  return <View style={{ width: 22, height: 22 }}>
    <Animated.View style={{ position: 'absolute', inset: 0, opacity: reduced ? 1 : pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }), transform: [{ scale: reduced ? 1 : pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.9] }) }] }}>
      <Svg width={22} height={22}><Defs><RadialGradient id={id}><Stop offset="0" stopColor="#FF0000" stopOpacity={0.35} /><Stop offset="0.7" stopColor="#FF0000" stopOpacity={0} /></RadialGradient></Defs><Circle cx={11} cy={11} r={11} fill={`url(#${id})`} /></Svg>
    </Animated.View>
    <View style={{ position: 'absolute', inset: 6, borderRadius: 99, backgroundColor: '#FF0000', borderWidth: 2, borderColor: '#FFFFFF', boxShadow: '0 0 8px rgba(255,0,0,0.6)' }} />
  </View>;
}
