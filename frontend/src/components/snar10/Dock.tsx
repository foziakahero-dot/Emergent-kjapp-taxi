import React, { type RefObject } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/src/components/Typography';
import { V10Icon as Icon } from '@/src/components/V10Icon';
import { colors, font, useColorTheme } from '@/src/theme';
import { dock, dockBottom } from '@/src/theme/snar10';
import { Glass } from './Glass';

export type DockItem = { id: string; label: string; icon: string; ai?: boolean; dot?: boolean; testID?: string; accessibilityLabel?: string };
export function Dock({ items, active, onSelect, onLongPress, target, testID }: {
  items: DockItem[]; active?: string; onSelect: (id: string) => void;
  onLongPress?: (id: string) => void; target?: RefObject<View | null>; testID?: string;
}) {
  useColorTheme();
  const insets = useSafeAreaInsets();
  return <View testID={testID} style={{ position: 'absolute', left: dock.inset, right: dock.inset,
    bottom: dockBottom(insets.bottom), borderRadius: dock.radius, boxShadow: colors.elevation2, zIndex: 40 }}>
    <View style={{ height: dock.height, overflow: 'hidden', borderRadius: dock.radius,
      borderWidth: 1, borderColor: colors.glassLine, paddingHorizontal: dock.padding,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }}>
      <Glass target={target} />
      {items.map(item => {
        const selected = item.id === active;
        const color = item.ai ? colors.onInverse : selected ? colors.text : colors.textMuted;
        return <Pressable key={item.id} testID={item.testID ?? `tab-${item.id}`}
          accessibilityRole="tab" accessibilityLabel={item.accessibilityLabel ?? item.label}
          accessibilityState={{ selected }} onPress={() => onSelect(item.id)} onLongPress={() => onLongPress?.(item.id)}
          style={({ pressed }) => ({ width: item.ai ? dock.aiSize : dock.itemWidth,
            height: item.ai ? dock.aiSize : dock.itemHeight, borderRadius: item.ai ? dock.aiRadius : dock.itemRadius,
            backgroundColor: item.ai ? colors.surfaceInverse : 'transparent', gap: 3,
            alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? .9 : 1 }] })}>
          <Icon name={item.icon} size={item.ai ? 24 : 22} color={color} />
          {!item.ai ? <Text style={{ color, fontFamily: font.medium, fontSize: 10.5, lineHeight: 14 }}>{item.label}</Text> : null}
          {item.dot ? <View testID={`dock-unread-${item.id}`} style={{ position: 'absolute', top: 8, right: 14,
            width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, boxShadow: `0 0 0 2px ${colors.surface}` }} /> : null}
          {selected ? <View testID={`dock-active-${item.id}`} pointerEvents="none" style={{ position: 'absolute', bottom: 2,
            width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent }} /> : null}
        </Pressable>;
      })}
    </View>
  </View>;
}
