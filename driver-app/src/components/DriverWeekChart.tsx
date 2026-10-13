import React from 'react';
import { View } from 'react-native';
import { Text } from '@/src/components/Typography';
import { colors, useColorTheme } from '@/src/theme';
import { v10 } from '@/src/components/V10UI';

export function DriverWeekChart({ days }: { days: { date?: string; income?: number }[] }) {
  useColorTheme();
  const usable = days.filter(day => typeof day.income === 'number' && Number.isFinite(day.income));
  if (!usable.length) return <Text style={v10.secondary}>Ingen grafdata tilgjengelig.</Text>;
  const maximum = Math.max(1, ...usable.map(day => day.income!));
  return <View accessibilityLabel="Bekreftet inntekt per dag">
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 64 }}>
      {usable.map((day, index) => <View key={day.date || index} accessibilityLabel={`${day.date || 'Dag'}: ${day.income} kroner`} style={{ flex: 1, height: day.income! > 0 ? `${Math.max(4, day.income! / maximum * 100)}%` : 1, borderRadius: 4, backgroundColor: index === usable.length - 1 ? colors.accent : colors.cardSubtle }} />)}
    </View>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>{usable.map((day, index) => {
      const date = new Date(`${day.date || ''}T12:00:00Z`);
      return <Text key={day.date || index} style={v10.caption}>{Number.isFinite(date.getTime()) ? date.toLocaleDateString('nb-NO', { weekday: 'short', timeZone: 'UTC' }).replace('.', '') : '—'}</Text>;
    })}</View>
  </View>;
}
