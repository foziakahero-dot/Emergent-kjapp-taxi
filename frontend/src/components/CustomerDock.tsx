import React, { useEffect, useRef, type RefObject } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Typography';
import { V10Icon } from './V10Icon';
import { useReducedMotion } from './Motion';
import { Glass } from './snar10/Glass';
import type { DockItem } from './snar10/Dock';
import { dockBottom } from '@/src/theme/snar10';
import { colors, font, useColorTheme } from '@/src/theme';

type Props = {
  items: DockItem[]; active?: string; onSelect: (id: string) => void;
  onLongPress?: (id: string) => void; target?: RefObject<View | null>;
};

/** Customer-only navigation; keeps the existing routes, events and Driver dock. */
export function CustomerDock({ items, active, onSelect, onLongPress, target }: Props) {
  useColorTheme();
  const insets = useSafeAreaInsets();
  return <View testID="customer-dock" style={{ position: 'absolute', left: 16, right: 16,
    bottom: dockBottom(insets.bottom), borderRadius: 28, boxShadow: colors.elevation2, zIndex: 40 }}>
    <View style={{ minHeight: 72, borderRadius: 28, overflow: 'hidden', borderWidth: 1,
      borderColor: colors.glassLine, padding: 6, flexDirection: 'row', gap: 6, alignItems: 'stretch' }}>
      <Glass target={target} />
      {items.map(item => <CustomerTab key={item.id} item={item} selected={item.id === active}
        onPress={() => onSelect(item.id)} onLongPress={() => onLongPress?.(item.id)} />)}
    </View>
  </View>;
}

function CustomerTab({ item, selected, onPress, onLongPress }: {
  item: DockItem; selected: boolean; onPress: () => void; onLongPress: () => void;
}) {
  useColorTheme();
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    progress.stopAnimation();
    if (reduced) { progress.setValue(selected ? 1 : 0); return; }
    const animation = Animated.timing(progress, { toValue: selected ? 1 : 0,
      duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [selected, reduced, progress]);
  return <Pressable testID={item.testID ?? `tab-${item.id}`} accessibilityRole="tab"
    accessibilityLabel={item.accessibilityLabel ?? item.label} accessibilityState={{ selected }}
    onPress={onPress} onLongPress={onLongPress}
    style={({ pressed }) => ({ flex: 1, minWidth: 48, minHeight: 58, borderRadius: 22,
      alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 5,
      opacity: pressed ? .72 : 1 })}>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, {
      borderRadius: 22, backgroundColor: colors.accentSoft, opacity: progress,
    }]} />
    <V10Icon name={item.icon} size={23} color={selected ? colors.accent : colors.textSecondary} />
    <Text numberOfLines={1} maxFontSizeMultiplier={1.4} style={{ fontSize: 12, lineHeight: 16,
      fontFamily: selected ? font.semibold : font.medium, color: selected ? colors.text : colors.textSecondary }}>{item.label}</Text>
    <Animated.View testID={selected ? `dock-active-${item.id}` : undefined} pointerEvents="none"
      style={{ position: 'absolute', bottom: 0, height: 3, width: 22, borderRadius: 2,
        backgroundColor: colors.accent, opacity: progress,
        transform: [{ scaleX: progress.interpolate({ inputRange: [0, 1], outputRange: [.5, 1] }) }] }} />
  </Pressable>;
}
