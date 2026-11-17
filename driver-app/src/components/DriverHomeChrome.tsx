import React, { type RefObject } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { Text } from './Typography';
import { V10Icon } from './V10Icon';
import { Glass } from './snar10/Glass';
import { colors, font, useColorTheme } from '@/src/theme';
import { kr } from '@/src/lib/format';

export const DRIVER_DOCK_HEIGHT = 76;
export const driverDockBottom = (safeBottom: number) => Math.max(14, safeBottom + 8);
const valid = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;

export function DriverOnlineHeader({ summary, ready, busy, onOffline, onEarnings, target }: {
  summary: any; ready: boolean; busy: boolean; onOffline: () => void; onEarnings: () => void;
  target?: RefObject<View | null>;
}) {
  useColorTheme();
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 370 || fontScale > 1.2;
  const time = valid(summary?.online_minutes) ? Math.floor(summary.online_minutes) : null;
  const metrics = [
    { label: 'Inntekt i dag', value: valid(summary?.income) ? kr(summary.income) : '—', onPress: onEarnings },
    { label: 'Betalte turer', value: valid(summary?.trips) ? String(summary.trips) : '—' },
    { label: 'Online i dag', value: time === null ? '—' : `${Math.floor(time / 60)} t ${time % 60} min` },
  ];
  return <View testID="driver-online-header" style={{ gap: 10 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <View accessible accessibilityLabel="SNAR Driver" style={{ flexDirection: compact ? 'column' : 'row', alignItems: compact ? 'flex-start' : 'baseline', gap: compact ? 0 : 7, flexShrink: 1 }}>
        <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: font.extraBold, fontSize: 24, letterSpacing: -.8, color: colors.text }}>SNAR</Text>
        <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: font.medium, fontSize: 11, letterSpacing: 1.6, color: colors.textSecondary }}>DRIVER</Text>
      </View>
      <Pressable testID="driver-go-offline" accessibilityRole="button" accessibilityLabel={ready ? 'Online. Gå offline' : 'Forbindelsen kontrolleres. Gå offline'}
        accessibilityHint="Avslutter mottak av nye turforespørsler" accessibilityState={{ disabled: busy }} disabled={busy} onPress={onOffline}
        style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 14, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 8,
          backgroundColor: ready ? colors.positiveSoft : colors.warningSoft, opacity: busy || pressed ? .65 : 1 })}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ready ? colors.success : colors.warning }} />
        <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: font.semibold, fontSize: 15, color: ready ? colors.success : colors.warning }}>{ready ? 'Online' : 'Avventer'}</Text>
        <V10Icon name="power" size={17} color={ready ? colors.success : colors.warning} />
      </Pressable>
    </View>
    <View style={{ borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: colors.glassLine, boxShadow: colors.elevation2 }}>
      <Glass target={target} />
      <View style={{ flexDirection: 'row', alignItems: 'stretch', paddingVertical: 14, paddingHorizontal: 4 }}>
        {metrics.map((metric, index) => {
          const content = <><Text maxFontSizeMultiplier={1.4} style={{ fontFamily: font.medium, fontSize: 11, lineHeight: 16, color: colors.textSecondary }}>{metric.label}</Text>
            <Text testID={`driver-kpi-${index}`} adjustsFontSizeToFit minimumFontScale={.75} numberOfLines={1} maxFontSizeMultiplier={1.5}
              style={{ fontFamily: font.semibold, fontSize: 21, lineHeight: 29, letterSpacing: -.5, color: colors.text, fontVariant: ['tabular-nums'] }}>{metric.value}</Text></>;
          const style = { flex: 1, minWidth: 0, paddingHorizontal: 10, gap: 5, borderLeftWidth: index ? 1 : 0, borderLeftColor: colors.lineStrong };
          return metric.onPress ? <Pressable key={metric.label} testID="driver-today-earnings" accessibilityRole="button" accessibilityLabel={`${metric.label}: ${metric.value}. Åpne inntekt`} onPress={metric.onPress} style={style}>{content}</Pressable>
            : <View key={metric.label} accessible accessibilityLabel={`${metric.label}: ${metric.value}`} style={style}>{content}</View>;
        })}
      </View>
    </View>
  </View>;
}

export function DriverWaitingCard({ connected, gpsReady, plate, target, onHeight }: {
  connected: boolean; gpsReady: boolean; plate?: string; target?: RefObject<View | null>; onHeight?: (height: number) => void;
}) {
  useColorTheme();
  const ready = connected && gpsReady;
  return <View testID="driver-online-status" onLayout={event => onHeight?.(event.nativeEvent.layout.height)}
    style={{ borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: colors.glassLine, boxShadow: colors.elevation2 }}>
    <Glass target={target} />
    <View style={{ padding: 16, gap: 6 }}>
      <Text accessibilityLiveRegion="polite" style={{ fontFamily: font.semibold, color: colors.text, fontSize: 21, lineHeight: 27 }}>
        {ready ? 'Venter på neste tur' : connected ? 'Finner GPS-posisjonen…' : 'Kobler til SNAR…'}
      </Text>
      <Text style={{ fontFamily: font.body, fontSize: 14, lineHeight: 20, color: colors.textSecondary }}>
        {ready ? 'Vi varsler deg når en tur er klar.' : 'Turforespørsler krever oppdatert forbindelse og posisjon.'}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingTop: 12, marginTop: 6, borderTopWidth: 1, borderTopColor: colors.lineStrong }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><V10Icon name="locate" size={19} color={gpsReady ? colors.success : colors.warning} />
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{gpsReady ? 'GPS aktiv' : 'GPS avventer'}</Text></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 }}><V10Icon name="vehicle" size={19} color={colors.textSecondary} />
          <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 13, flexShrink: 1 }}>{plate || 'Bil ikke tilordnet'}</Text></View>
      </View>
    </View>
  </View>;
}
