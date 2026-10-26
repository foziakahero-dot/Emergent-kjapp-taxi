import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/src/components/Typography';
import { V10Icon } from '@/src/components/V10Icon';
import { V10Entrance } from '@/src/components/V10Entrance';
import { colors, font, useColorTheme } from '@/src/theme';
/** Only supplied route instructions are shown. No fabricated turns or distances. */
export function TurnBanner({ dist, street, then, turn, children, style }: { dist: string; street: string; then?: string; turn?: string; children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  useColorTheme();
  return <V10Entrance testID="driver-turn-banner" style={[{ position: 'absolute', top: 56, left: 12, right: 12, minHeight: 88, borderRadius: 24, backgroundColor: colors.surfaceInverse, paddingVertical: 16, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 14, boxShadow: colors.elevation2 }, style]}>
    <V10Icon name={turn || 'navigation'} size={40} color={colors.onInverse} />
    <View style={{ flex: 1 }}><Text style={{ color: colors.onInverse, fontSize: 30, lineHeight: 34, letterSpacing: -.9, fontFamily: font.semibold, fontVariant: ['tabular-nums'] }}>{dist}</Text><Text style={{ color: colors.onInverse, fontFamily: font.semibold, fontSize: 17, lineHeight: 23, opacity: .85 }}>{street}</Text></View>
    {then ? <Text style={{ fontSize: 12, color: colors.onInverse, opacity: .6, textAlign: 'right' }}>Deretter{'\n'}{then}</Text> : null}{children}
  </V10Entrance>;
}
