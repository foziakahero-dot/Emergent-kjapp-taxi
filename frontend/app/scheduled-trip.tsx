import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/src/components/Typography';
import { V10Action, V10Sheet, v10 } from '@/src/components/V10UI';
import { V10Icon } from '@/src/components/V10Icon';
import { colors, font, useColorTheme } from '@/src/theme';
import { osloDay } from '@/src/lib/osloCalendar';

/** Source 35 layout. Scheduling remains unavailable until a canonical API exists. */
export default function ScheduledTrip() {
  useColorTheme();
  const router = useRouter();
  const [dates] = useState(() => {
    const today = new Date(`${osloDay(Date.now())}T12:00:00Z`);
    return Array.from({ length: 5 }, (_, index) => { const day = new Date(today); day.setUTCDate(day.getUTCDate() + index + 1); return day; });
  });
  const [day, setDay] = useState(0);
  const [minutes, setMinutes] = useState(() => {
    const parts = new Intl.DateTimeFormat('nb-NO', { timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const value = Number(parts.find(part => part.type === 'hour')?.value) * 60 + Number(parts.find(part => part.type === 'minute')?.value);
    return Math.ceil(value / 5) * 5 % 1440;
  });
  const time = (value: number) => { const normalized = (value + 1440) % 1440; return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`; };
  const adjust = (change: number) => setMinutes(value => (value + change + 1440) % 1440);
  return <View style={{ flex: 1, backgroundColor: colors.bg }} testID="customer-scheduled-screen">
    <V10Sheet><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={v10.caption}>Planlagt tur</Text><Pressable testID="schedule-close" onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Lukk planlagt tur" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><V10Icon name="x" /></Pressable></View>
      <Text style={v10.title}>{dates[day].toLocaleDateString('nb-NO', { timeZone: 'Europe/Oslo', weekday: 'long', day: 'numeric', month: 'short' })}</Text>
      <View style={{ flexDirection: 'row', gap: 6, marginVertical: 18 }} accessibilityRole="radiogroup" accessibilityLabel="Hentedato">{dates.map((date, index) => <Pressable key={date.toISOString()} testID={`schedule-day-${index}`} accessibilityRole="radio" accessibilityState={{ checked: day === index }} accessibilityLabel={date.toLocaleDateString('nb-NO', { timeZone: 'Europe/Oslo', dateStyle: 'full' })} onPress={() => setDay(index)} style={{ flex: 1, paddingVertical: 10, borderRadius: 14, alignItems: 'center', backgroundColor: day === index ? colors.surfaceInverse : colors.cardSubtle }}><Text style={[v10.caption, { color: day === index ? colors.onInverse : colors.text, opacity: .7 }]}>{date.toLocaleDateString('nb-NO', { weekday: 'short', timeZone: 'Europe/Oslo' })}</Text><Text style={[v10.body, { color: day === index ? colors.onInverse : colors.text, fontVariant: ['tabular-nums'] }]}>{date.getUTCDate()}</Text></Pressable>)}</View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, paddingVertical: 8 }}>
        <Pressable testID="schedule-earlier" accessibilityRole="button" accessibilityLabel="Fem minutter tidligere" onPress={() => adjust(-5)} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: colors.textMuted, fontSize: 22, fontVariant: ['tabular-nums'] }}>{time(minutes - 5)}</Text></Pressable>
        <View accessible accessibilityRole="adjustable" accessibilityLabel="Hentetid" accessibilityValue={{ text: time(minutes) }} accessibilityActions={[{ name: 'increment', label: 'Fem minutter senere' }, { name: 'decrement', label: 'Fem minutter tidligere' }]} onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'increment') adjust(5); if (event.nativeEvent.actionName === 'decrement') adjust(-5); }} style={{ paddingHorizontal: 16, borderRadius: 14, backgroundColor: colors.cardSubtle }}><Text testID="schedule-time" style={{ fontFamily: font.semibold, fontSize: 40, lineHeight: 44, letterSpacing: -1.4, fontVariant: ['tabular-nums'] }}>{time(minutes)}</Text></View>
        <Pressable testID="schedule-later" accessibilityRole="button" accessibilityLabel="Fem minutter senere" onPress={() => adjust(5)} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: colors.textMuted, fontSize: 22, fontVariant: ['tabular-nums'] }}>{time(minutes + 5)}</Text></Pressable>
      </View>
      <Text style={[v10.secondary, { textAlign: 'center', marginTop: 8, marginBottom: 18 }]}>Planlagte turer er ikke tilgjengelig i beta ennå. Valgt dato og tid er en forhåndsvisning. Ingen tur blir bestilt.</Text>
      <V10Action label={`Planlegg ${time(minutes)}`} disabled onPress={() => {}} testID="schedule-confirm-unavailable" />
      <V10Action kind="ghost" label="Tilbake til bestilling" onPress={() => router.back()} />
    </V10Sheet>
  </View>;
}
