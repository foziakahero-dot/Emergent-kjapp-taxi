import React from 'react';
import { ScrollView, StyleSheet, View, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FigmaGradient } from '@/src/components/FigmaGradient';
import { V10Entrance } from '@/src/components/V10Entrance';
import { colors, useColorTheme } from '@/src/theme';
import { sheet } from '@/src/theme/snar10';

export function SheetFrame({ style, children, ...props }: ViewProps) {
  useColorTheme();
  return <V10Entrance {...props} sheet style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '82%',
    borderTopLeftRadius: sheet.radius, borderTopRightRadius: sheet.radius, backgroundColor: colors.surface,
    boxShadow: colors.elevation3, overflow: 'hidden' }, style]}>
    <FigmaGradient angle={165} colors={[colors.surfaceRaised, colors.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" />
    {children}
  </V10Entrance>;
}
export function SheetHandle() {
  useColorTheme();
  return <View pointerEvents="none" style={{ width: sheet.handleWidth, height: sheet.handleHeight, borderRadius: 3,
    backgroundColor: colors.lineStrong, alignSelf: 'center', marginBottom: sheet.handleGap }} />;
}
export function Sheet({ children, paddingBottom = sheet.bottom, testID, onLayout, accessory }: {
  children: React.ReactNode; paddingBottom?: number; testID?: string; onLayout?: ViewProps['onLayout']; accessory?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return <SheetFrame testID={testID} onLayout={onLayout} style={{ paddingTop: sheet.top }}>
    <SheetHandle />{accessory}
    <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }}
      contentContainerStyle={{ paddingHorizontal: sheet.horizontal, paddingBottom: Math.max(paddingBottom, insets.bottom) }}>{children}</ScrollView>
  </SheetFrame>;
}
