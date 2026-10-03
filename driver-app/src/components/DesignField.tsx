import React, { useRef } from 'react';
import { Animated, Easing, View, type TextInputProps } from 'react-native';
import { Text, TextInput } from '@/src/components/Typography';
import { useReducedMotion } from '@/src/components/Motion';
import { colors, font } from '@/src/theme';

export function DesignField({ label, action, style, onFocus, onBlur, ...props }: TextInputProps & { label: string; action?: React.ReactNode }) {
  const focus = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  const animate = (toValue: number) => Animated.timing(focus, { toValue, duration: reduced ? 0 : 300, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: false }).start();
  return <View>
    <Text style={{ marginBottom: 8, color: colors.textMuted, fontFamily: font.mono, fontSize: 10, lineHeight: 15, letterSpacing: 2.4, textTransform: 'uppercase' }}>{label}</Text>
    <View style={{ position: 'relative' }}>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: -4, bottom: -4, left: -4, right: -4, borderRadius: 20, backgroundColor: 'rgba(255,0,0,0.12)', opacity: focus }} />
      <Animated.View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1,
        borderColor: focus.interpolate({ inputRange: [0, 1], outputRange: [colors.lineStrong, colors.accent] }), boxShadow: '0 1px 2px rgba(11,14,20,0.04)' }}>
        <TextInput {...props} placeholderTextColor={colors.textMuted} style={[{ flex: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, lineHeight: 22, color: colors.text }, style]}
          onFocus={event => { animate(1); onFocus?.(event); }} onBlur={event => { animate(0); onBlur?.(event); }} />
        {action}
      </Animated.View>
    </View>
  </View>;
}
