import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/src/components/Typography';
import { V10Icon } from '@/src/components/V10Icon';
import { colors, font, useColorTheme } from '@/src/theme';
import { dockBottom } from '@/src/theme/snar10';

export function Island({ icon = 'vehicle', title, sub, eta, etaUnit = 'min', progress = 0, onClick, live = true, testID, inline = false }: {
  icon?: string; title: string; sub: string; eta?: string; etaUnit?: string; progress?: number;
  onClick: () => void; live?: boolean; testID?: string; inline?: boolean;
}) {
  useColorTheme();
  const insets = useSafeAreaInsets();
  const fraction = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={`Aktiv tur: ${title}. ${sub}. Trykk for å åpne.`}
    onPress={onClick} style={({ pressed }) => ({ ...(inline ? {} : { position: 'absolute' as const, left: 16, right: 16, bottom: dockBottom(insets.bottom) + 76, zIndex: 41 }),
      height: 60, borderRadius: 20, paddingLeft: 12, paddingRight: 10, backgroundColor: colors.surfaceInverse,
      flexDirection: 'row', alignItems: 'center', gap: 12, transform: [{ scale: pressed ? .98 : 1 }] })}>
    <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(127,127,127,.18)', alignItems: 'center', justifyContent: 'center' }}>
      <V10Icon name={icon} size={20} color={colors.onInverse} />
      {live ? <View testID="island-live" style={{ position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: 5,
        backgroundColor: colors.accent, borderWidth: 2, borderColor: colors.surfaceInverse }} /> : null}
    </View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text numberOfLines={1} style={{ color: colors.onInverse, fontFamily: font.semibold, fontSize: 14.5, lineHeight: 19 }}>{title}</Text>
      <Text numberOfLines={1} style={{ color: colors.onInverse, opacity: .65, fontSize: 12.5, lineHeight: 16 }}>{sub}</Text>
    </View>
    {eta ? <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}><Text style={{ color: colors.onInverse, fontFamily: font.semibold, fontSize: 22, lineHeight: 26 }}>{eta}</Text>
      <Text style={{ color: colors.onInverse, opacity: .65, fontSize: 12 }}>{etaUnit}</Text></View> : <V10Icon name="chevU" size={18} color={colors.onInverse} />}
    <View style={{ position: 'absolute', left: 14, right: 14, bottom: 0, height: 2, overflow: 'hidden', backgroundColor: 'rgba(127,127,127,.18)' }}>
      <View testID="island-progress" style={{ width: `${fraction * 100}%`, height: 2, backgroundColor: colors.accent }} />
    </View>
  </Pressable>;
}
