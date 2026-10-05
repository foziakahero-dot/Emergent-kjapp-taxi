import React, { useEffect, useId, useRef } from 'react';
import { Animated, View } from 'react-native';
import Svg, { Circle, Defs, G, Path, Rect, RadialGradient, Stop } from 'react-native-svg';
import { cssEaseOut, useReducedMotion } from '@/src/components/Motion';

export function MapCar({ heading = 0, active = false }: { heading?: number; active?: boolean }) {
  const id = `car-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return <Svg width={30} height={30} viewBox="0 0 30 30">
    <Defs><RadialGradient id={id}><Stop offset="0" stopColor="#FF0000" stopOpacity={0.22} /><Stop offset="0.7" stopColor="#FF0000" stopOpacity={0} /></RadialGradient></Defs>
    <Circle cx={15} cy={15} r={15} fill={`url(#${id})`} />
    <G transform={`rotate(${heading} 15 15)`}>
      <Rect x={9} y={4} width={12} height={22} rx={4} fill={active ? '#FF0000' : '#001F3F'} stroke="#FFFFFF" strokeWidth={1.5} />
      <Path d="M11 8h8l-1 5h-6z" fill="#DDE8F1" /><Rect x={11} y={17} width={8} height={5} rx={1.5} fill="#DDE8F1" />
      <Path d="M10 6h3m4 0h3" stroke="#FFFFFF" strokeWidth={1.4} />
    </G>
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
