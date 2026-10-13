import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { BrandBadge } from '@/src/components/BrandBadge';
import { Text } from '@/src/components/Typography';
import { useReducedMotion } from '@/src/components/Motion';
import { colors, font, useColorTheme } from '@/src/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export function SplashBackground({ inverse = false }: { inverse?: boolean }) {
  useColorTheme();
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: inverse ? '#08131F' : colors.bg }]} />;
}

/** One light traces the original chevrons; it never represents loading progress. */
export function SplashBrand({ inverse = false, label }: { inverse?: boolean; label?: string }) {
  useColorTheme();
  const reduced = useReducedMotion();
  const light = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    light.setValue(0);
    if (reduced) return;
    const animation = Animated.sequence([
      Animated.delay(200),
      Animated.timing(light, { toValue: 1, duration: 1600, easing: Easing.bezier(.65, 0, .35, 1), useNativeDriver: false }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [light, reduced]);
  const color = inverse ? '#EEF2F7' : colors.text;
  return <View style={{ alignItems: 'center', gap: 22 }}>
    <View style={{ width: 96, height: 96 }}>
      <BrandBadge size={96} />
      {!reduced && <Svg pointerEvents="none" width={96} height={96} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <AnimatedPath d="M28 29l21 21-21 21M53 29l21 21-21 21" fill="none" stroke="#FFFFFF" strokeWidth={3}
          strokeLinecap="round" strokeLinejoin="round" strokeDasharray={[21.4, 142.6]}
          strokeDashoffset={light.interpolate({ inputRange: [0, 1], outputRange: [21.4, -142.6] })}
          opacity={light.interpolate({ inputRange: [0, .85, 1], outputRange: [1, 1, 0] })} />
      </Svg>}
    </View>
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontFamily: font.semibold, fontSize: 22, lineHeight: 27, letterSpacing: 3.96, color }} testID="ob-brand">SNAR</Text>
      {label ? <Text style={{ marginTop: 4, fontFamily: font.medium, fontSize: 12, lineHeight: 16, letterSpacing: 1.68, textTransform: 'uppercase', color: colors.textMuted }}>{label}</Text> : null}
    </View>
  </View>;
}

export function SplashAction({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  useColorTheme();
  return <Pressable accessibilityRole="button" onPress={onPress} testID={testID}
    style={({ pressed }) => ({ marginTop: 56, minHeight: 56, borderRadius: 16, backgroundColor: colors.accent, paddingHorizontal: 32, justifyContent: 'center', transform: [{ scale: pressed ? .97 : 1 }] })}>
    <Text style={{ fontFamily: font.semibold, fontSize: 16, lineHeight: 22, color: colors.accentOn }}>{label}</Text>
  </Pressable>;
}
