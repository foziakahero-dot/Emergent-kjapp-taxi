import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, View } from 'react-native';
import { Text } from '@/src/components/Typography';
import { useReducedMotion } from '@/src/components/Motion';
import { colors, font, useColorTheme } from '@/src/theme';

/** A real 900 ms hold: releasing or unmounting cancels; accessible activation is deliberate. */
export function V10HoldAction({ label, onConfirm, onError, disabled = false, testID }: { label: string; onConfirm: () => void | Promise<void>; onError: (error: unknown) => void; disabled?: boolean; testID?: string }) {
  useColorTheme();
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const active = useRef(true);
  const running = useRef(false);
  const [pending, setPending] = useState(false);
  const cancel = () => { clearTimeout(timer.current); progress.stopAnimation(); if (!running.current) progress.setValue(0); };
  useEffect(() => { active.current = true; return () => { active.current = false; clearTimeout(timer.current); progress.stopAnimation(); }; }, [progress]);
  useEffect(() => { if (disabled) cancel(); }, [disabled]);
  const confirm = async () => {
    clearTimeout(timer.current);
    if (!active.current || running.current || disabled) return;
    running.current = true; setPending(true); progress.setValue(1);
    try { await onConfirm(); } catch (error) { if (active.current) onError(error); }
    finally { running.current = false; if (active.current) { setPending(false); progress.setValue(0); } }
  };
  const begin = () => {
    if (disabled || running.current) return;
    clearTimeout(timer.current); progress.setValue(0);
    if (!reduced) Animated.timing(progress, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: false }).start();
    timer.current = setTimeout(() => void confirm(), 900);
  };
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Hold inne i 0,9 sekunder for å bekrefte" accessibilityState={{ disabled: disabled || pending, busy: pending }} disabled={disabled || pending}
    accessibilityActions={[{ name: 'activate', label }]} onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'activate') void confirm(); }}
    onPressIn={begin} onPressOut={cancel} style={{ height: 58, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.accent, boxShadow: `0 6px 20px -10px ${colors.accent}`, opacity: disabled ? .55 : 1 }}>
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,.18)', width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
    <View pointerEvents="none" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>{pending ? <ActivityIndicator color={colors.accentOn} /> : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Text style={{ fontFamily: font.semibold, fontSize: 16, lineHeight: 22, letterSpacing: -.16, color: colors.accentOn }}>{label}</Text><Text style={{ fontFamily: font.medium, fontSize: 12, lineHeight: 16, letterSpacing: -.16, color: colors.accentOn, opacity: .7 }}>Hold</Text></View>}</View>
  </Pressable>;
}
