import React from 'react';
import { View } from 'react-native';
import { Text } from '@/src/components/Typography';
import { v10 } from '@/src/components/V10UI';
import { colors, useColorTheme } from '@/src/theme';
import { kr } from '@/src/lib/format';
export function EarningsMeter({ income, goal }: { income: number | null; goal: number }) {
  useColorTheme();
  const value = income !== null && Number.isFinite(income) && income >= 0 && Number.isFinite(goal) && goal > 0 ? Math.min(1, income / goal) : null;
  if (value === null) return null;
  return <View testID="driver-earnings-goal" style={{ marginTop: 16, gap: 8 }}>
    <Text style={v10.caption}>Personlig skiftmål · {kr(income)} av {kr(goal)}</Text>
    <View accessibilityRole="progressbar" accessibilityLabel="Dagens inntekt mot personlig mål" accessibilityValue={{ min: 0, max: goal, now: Math.min(income!, goal) }} style={{ height: 6, borderRadius: 3, backgroundColor: colors.cardSubtle, overflow: 'hidden' }}><View style={{ width: `${value * 100}%`, height: 6, borderRadius: 3, backgroundColor: colors.success }} /></View>
  </View>;
}
