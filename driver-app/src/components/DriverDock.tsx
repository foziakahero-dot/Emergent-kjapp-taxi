import React, { type RefObject } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Typography';
import { V10Icon } from './V10Icon';
import { Glass } from './snar10/Glass';
import type { DockItem } from './snar10/Dock';
import { DRIVER_DOCK_HEIGHT, driverDockBottom } from './DriverHomeChrome';
import { colors, font, useColorTheme } from '@/src/theme';

export function DriverDock({ items, active, onSelect, onLongPress, target }: {
  items: DockItem[]; active?: string; onSelect: (id: string) => void; onLongPress?: (id: string) => void; target?: RefObject<View | null>;
}) {
  useColorTheme();
  const insets = useSafeAreaInsets();
  return <View testID="driver-dock" style={{ position: 'absolute', bottom: driverDockBottom(insets.bottom), left: 16, right: 16, borderRadius: 26,
    overflow: 'hidden', borderWidth: 1, borderColor: colors.glassLine, boxShadow: colors.elevation2, zIndex: 40 }}>
    <Glass target={target} />
    <View style={{ minHeight: DRIVER_DOCK_HEIGHT, padding: 6, flexDirection: 'row', alignItems: 'stretch' }}>
      {items.map(item => {
        const selected = item.id === active;
        return <Pressable key={item.id} testID={item.testID ?? `tab-${item.id}`} accessibilityRole="tab"
          accessibilityLabel={item.accessibilityLabel ?? item.label} accessibilityState={{ selected }}
          onPress={() => onSelect(item.id)} onLongPress={() => onLongPress?.(item.id)}
          style={({ pressed }) => ({ flex: 1, minWidth: 0, minHeight: 62, alignItems: 'center', justifyContent: 'center', gap: 4, opacity: pressed ? .7 : 1 })}>
          <View testID={selected ? `dock-active-${item.id}` : undefined} style={{ width: 42, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? colors.accent : 'transparent' }}>
            <V10Icon name={item.icon} size={23} color={selected ? colors.accentOn : colors.textSecondary} />
          </View>
          <Text numberOfLines={1} maxFontSizeMultiplier={1.5} style={{ fontFamily: selected ? font.semibold : font.medium, fontSize: 12, lineHeight: 17,
            color: selected ? colors.text : colors.textSecondary }}>{item.label}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}
