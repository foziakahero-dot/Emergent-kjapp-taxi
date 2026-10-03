import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, View } from 'react-native';
import { Text } from '@/src/components/Typography';
import { FigmaGradient } from '@/src/components/FigmaGradient';
import { cssEase, useReducedMotion } from '@/src/components/Motion';
import { colors, font } from '@/src/theme';

/** Animate the Figma thumb, then call the existing canonical trip action. */
export function SlideConfirm({ label, onConfirm, onError, disabled, testID }: {
  label: string; onConfirm: () => void | Promise<void>; onError: (error: unknown) => void; disabled?: boolean; testID?: string;
}) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);
  const running = useRef(false);
  const [pending, setPending] = useState(false);
  const [width, setWidth] = useState(56);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; clearTimeout(timer.current); progress.stopAnimation(); }; }, [progress]);
  const confirm = () => {
    if (running.current || disabled) return;
    running.current = true;
    setPending(true);
    Animated.timing(progress, { toValue: 1, duration: reduced ? 0 : 300, easing: cssEase, useNativeDriver: true }).start();
    timer.current = setTimeout(async () => {
      if (!mounted.current) return;
      try { await onConfirm(); } catch (error) { onError(error); } finally {
        running.current = false;
        if (mounted.current) { setPending(false); progress.setValue(0); }
      }
    }, reduced ? 0 : 350);
  };
  return <Pressable onPress={confirm} disabled={disabled || pending} testID={testID} accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled: disabled || pending, busy: pending || disabled }}
    style={({ pressed }) => ({ height: 56, marginTop: 16, borderRadius: 999, boxShadow: '0 12px 30px rgba(255,0,0,0.35)', opacity: disabled ? 0.55 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}>
    <FigmaGradient colors={['#FF3B3B', '#FF0000']} style={{ flex: 1, borderRadius: 999, overflow: 'hidden' }} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: font.semibold, fontSize: 14, lineHeight: 20, color: '#FFFFFF' }}>{label}</Text></View>
      <Animated.View style={{ position: 'absolute', top: 4, left: 4, width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
        transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(0, width - 56)] }) }] }}>
        {disabled ? <ActivityIndicator color={colors.accent} /> : <Text style={{ color: colors.accent, fontSize: 20 }}>→</Text>}
      </Animated.View>
    </FigmaGradient>
  </Pressable>;
}
