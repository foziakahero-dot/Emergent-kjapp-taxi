import React, { type RefObject } from 'react';
import { Pressable, View } from 'react-native';
import { Glass } from '../Glass';
import { Text } from '@/src/components/Typography';
import { V10Icon } from '@/src/components/V10Icon';
import { V10Badge, v10 } from '@/src/components/V10UI';
import { colors, font, useColorTheme } from '@/src/theme';
export function OnlineChip({ target, onlineTime, income, disabled, onEarnings, onOffline }: { target?: RefObject<View | null>; onlineTime: string; income: string; disabled: boolean; onEarnings: () => void; onOffline: () => void }) {
  useColorTheme();
  return <View style={{ flex: 1, borderRadius: 20, boxShadow: colors.elevation2 }}><View testID="driver-online-chip" style={{ minHeight: 60, borderRadius: 20, overflow: 'hidden', paddingVertical: 10, paddingLeft: 16, paddingRight: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
    <Glass target={target} /><V10Badge inline tone="positive">Online</V10Badge><Text style={[v10.secondary, { color: colors.text, fontVariant: ['tabular-nums'] }]}>{onlineTime}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Dagens inntekt" onPress={onEarnings} style={{ marginLeft: 'auto' }}><Text style={{ fontFamily: font.semibold, fontSize: 17, lineHeight: 23, fontVariant: ['tabular-nums'] }}>{income}</Text></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Gå offline" testID="driver-online-toggle" disabled={disabled} onPress={onOffline} style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }}><V10Icon name="power" size={20} color={colors.text} /></Pressable>
  </View></View>;
}
