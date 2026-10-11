import React, { useEffect, useId, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { BrandBadge } from '@/src/components/BrandBadge';
import { Text } from '@/src/components/Typography';
import { FigmaGradient } from '@/src/components/FigmaGradient';
import { cssEaseOut, Rise, useReducedMotion } from '@/src/components/Motion';
import { colors, font } from '@/src/theme';

export function SplashBackground() {
  const id = `splash-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [size, setSize] = useState({ width: 1, height: 1 });
  const { width, height } = size;
  return <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={event => setSize(event.nativeEvent.layout)}>
    <Svg width="100%" height="100%">
      <Defs><RadialGradient id={id} gradientUnits="userSpaceOnUse" cx={width / 2} cy={height * 0.3} r={Math.hypot(width / 2, height * 0.7)}>
        <Stop offset="0" stopColor="#FFFFFF" /><Stop offset="0.7" stopColor="#EEF2F8" /><Stop offset="1" stopColor="#E6EBF3" />
      </RadialGradient></Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  </View>;
}

function Pulse({ delay }: { delay: number }) {
  const reduced = useReducedMotion();
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    value.setValue(0);
    if (reduced) return;
    let loop: Animated.CompositeAnimation | undefined;
    const timer = setTimeout(() => {
      loop = Animated.loop(Animated.timing(value, { toValue: 1, duration: 3000, easing: cssEaseOut, useNativeDriver: true }));
      loop.start();
    }, delay);
    return () => { clearTimeout(timer); loop?.stop(); };
  }, [delay, reduced, value]);
  return <Animated.View pointerEvents="none" style={{
    position: 'absolute', width: 104, height: 104, borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,0,0,0.35)',
    opacity: reduced ? 0 : value.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
    transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.9] }) }],
  }} />;
}

export function SplashBrand() {
  return <Rise style={{ alignItems: 'center' }}>
    <View style={{ width: 104, height: 104 }}><Pulse delay={0} /><Pulse delay={1200} /><BrandBadge size={104} float /></View>
    <Text style={{ marginTop: 36, fontFamily: font.bold, fontSize: 60, lineHeight: 60, letterSpacing: -1.5, color: colors.text }} testID="ob-brand">SNAR</Text>
  </Rise>;
}

export function SplashAction({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  const reduced = useReducedMotion();
  const shimmer = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(200);
  useEffect(() => {
    shimmer.setValue(0);
    if (reduced) return;
    const loop = Animated.loop(Animated.timing(shimmer, { toValue: 1, duration: 2800, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [reduced, shimmer]);
  return <Pressable accessibilityRole="button" onPress={onPress} testID={testID}
    style={({ pressed }) => ({ marginTop: 56, borderRadius: 999, boxShadow: '0 14px 34px rgba(255,0,0,0.4)', transform: [{ scale: pressed ? 0.95 : 1 }] })}>
    <FigmaGradient colors={['#FF3B3B', '#FF0000']} style={{ borderRadius: 999, overflow: 'hidden', paddingHorizontal: 40, paddingVertical: 16 }} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      {!reduced && <Animated.View pointerEvents="none" style={{ ...StyleSheet.absoluteFill, width: width * 2,
        transform: [{ translateX: shimmer.interpolate({ inputRange: [0, 1], outputRange: [-width * 2, width * 2] }) }] }}>
        <FigmaGradient angle={100} colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.4)', 'rgba(255,255,255,0)']} style={{ flex: 1 }} />
      </Animated.View>}
      <Text style={{ fontFamily: font.semibold, fontSize: 14, lineHeight: 20, letterSpacing: -0.28, color: '#FFFFFF' }}>{label}</Text>
    </FigmaGradient>
  </Pressable>;
}
