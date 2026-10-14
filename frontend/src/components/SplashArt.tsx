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
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: inverse ? '#0B1A2C' : colors.bg }]} />;
}

/** One light traces the original chevrons; it never represents loading progress. */
export function SplashBrand({ inverse = false, label }: { inverse?: boolean; label?: string }) {
  useColorTheme();
  const reduced = useReducedMotion();
  const light = useRef(new Animated.Value(0)).current;
  const reveal = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const wordmark = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    light.setValue(0);
    reveal.setValue(reduced ? 1 : 0);
    wordmark.setValue(reduced ? 1 : 0);
    if (reduced) return;
    const entrance = Animated.parallel([
      Animated.timing(reveal, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.sequence([Animated.delay(120), Animated.timing(wordmark, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true })]),
    ]);
    entrance.start();
    const animation = Animated.sequence([
      Animated.delay(200),
      Animated.timing(light, { toValue: 1, duration: 1600, easing: Easing.bezier(.65, 0, .35, 1), useNativeDriver: false }),
    ]);
    animation.start();
    return () => { animation.stop(); entrance.stop(); };
  }, [light, reveal, wordmark, reduced]);
  const color = inverse ? '#F4F6F9' : colors.text;
  return <View style={{ alignItems: 'center', gap: 22 }}>
    <Animated.View style={{ width: 96, height: 96, opacity: reveal, transform: [{ scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [.94, 1] }) }] }}>
      <BrandBadge size={96} />
      {!reduced && <Svg pointerEvents="none" width={96} height={96} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <AnimatedPath d="M28 29l21 21-21 21M53 29l21 21-21 21" fill="none" stroke="#FFFFFF" strokeWidth={3}
          strokeLinecap="round" strokeLinejoin="round" strokeDasharray={[21.4, 142.6]}
          strokeDashoffset={light.interpolate({ inputRange: [0, 1], outputRange: [142.6, -23.76] })}
          opacity={light.interpolate({ inputRange: [0, .85, 1], outputRange: [1, 1, 0] })} />
      </Svg>}
    </Animated.View>
    <Animated.View style={{ alignItems: 'center', opacity: wordmark }}>
      <Text style={{ fontFamily: font.semibold, fontSize: 22, lineHeight: 27, letterSpacing: 3.96, color }} testID="ob-brand">SNAR</Text>
      {label ? <Text style={{ marginTop: 4, fontFamily: font.medium, fontSize: 12, lineHeight: 16, letterSpacing: 1.68, textTransform: 'uppercase', color: inverse ? '#6D7E93' : colors.textMuted }}>{label}</Text> : null}
    </Animated.View>
  </View>;
}

export function SplashAction({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  useColorTheme();
  return <Pressable accessibilityRole="button" onPress={onPress} testID={testID}
    style={({ pressed }) => ({ marginTop: 56, minHeight: 56, borderRadius: 16, backgroundColor: colors.accent, paddingHorizontal: 32, justifyContent: 'center', transform: [{ scale: pressed ? .97 : 1 }] })}>
    <Text style={{ fontFamily: font.semibold, fontSize: 16, lineHeight: 22, color: colors.accentOn }}>{label}</Text>
  </Pressable>;
}

/** The native launch mark hands off to the original animated V10 splash. */
export function LaunchSplash({ onLayout }: { onLayout?: () => void }) {
  return <View onLayout={onLayout} testID="v10-launch-splash" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B1A2C' }}>
    <SplashBackground inverse />
    <SplashBrand inverse  />
  </View>;
}
