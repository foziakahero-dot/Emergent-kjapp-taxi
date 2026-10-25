import React, { useMemo, useState, type ReactNode } from 'react';
import { Keyboard, PanResponder, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Text } from './Typography';
import { colors, font, useColorTheme } from '@/src/theme';

/** Collapse only the presentation: route, search and payment state stay with the caller. */
export function CollapsibleMapPanel({ id, title, summary, children, bottomOffset = 0,
  bottomInset = 0, heightFraction = .7, onHeight }: {
  id: string; title: string; summary?: string; children: ReactNode;
  bottomOffset?: number; bottomInset?: number; heightFraction?: number; onHeight?: (height: number) => void;
}) {
  useColorTheme();
  const { height } = useWindowDimensions();
  const [collapsed, setCollapsed] = useState(false);
  const gestures = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 10 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy > 24) { Keyboard.dismiss(); setCollapsed(true); }
      else if (gesture.dy < -24) setCollapsed(false);
    },
  }), []);
  const toggle = () => {
    if (!collapsed) Keyboard.dismiss();
    setCollapsed(value => !value);
  };
  return <View testID={id} onLayout={event => onHeight?.(event.nativeEvent.layout.height + bottomOffset)}
    style={{ position: 'absolute', left: 0, right: 0, bottom: bottomOffset,
      maxHeight: Math.floor(height * heightFraction), borderTopLeftRadius: 26, borderTopRightRadius: 26,
      backgroundColor: colors.surface, boxShadow: colors.elevation3, overflow: 'hidden', paddingBottom: collapsed ? Math.max(8, bottomInset) : 0 }}>
    <View testID={`${id}-handle`} {...gestures.panHandlers}>
      <Pressable testID={`${id}-toggle`} accessibilityRole="button" accessibilityLabel={`${collapsed ? 'Vis' : 'Minimer'} ${title.toLowerCase()}`}
        accessibilityState={{ expanded: !collapsed }} aria-expanded={!collapsed} onPress={toggle}
        style={{ minHeight: 56, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10 }}>
        <View style={{ height: 4, width: 36, borderRadius: 4, backgroundColor: colors.lineStrong, alignSelf: 'center', marginBottom: 9 }} />
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ fontFamily: font.semibold, fontSize: 13, color: colors.text }}>{title}</Text>
            {collapsed && summary ? <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12, marginTop: 3 }}>{summary}</Text> : null}</View>
          <Text style={{ color: colors.textSecondary, fontFamily: font.medium, fontSize: 12 }}>{collapsed ? 'Vis' : 'Minimer'}</Text>
        </View>
      </Pressable>
    </View>
    {!collapsed ? <ScrollView testID={`${id}-content`} style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Math.max(16, bottomInset + 8) }}>{children}</ScrollView> : null}
  </View>;
}
