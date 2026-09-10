import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon } from '@/src/components/Icon';
import { Loader } from '@/src/components/ui';
import { settingsApi } from '@/src/lib/api';

const TOGGLES: { key: string; label: string; sub: string }[] = [
  { key: 'notifications', label: 'Varsler', sub: 'Push-varsler om turen din' },
  { key: 'trip_updates', label: 'Turoppdateringer', sub: 'Sanntidsstatus når sjåfør er på vei' },
  { key: 'price_alerts', label: 'Prisvarsler', sub: 'Beskjed ved lav pris i ditt område' },
];

export default function Settings() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const router = useRouter();
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    settingsApi.get().then((r) => setSettings(r.settings || r)).catch(() => setSettings({}));
  }, []);

  const toggle = async (key: string) => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    try { await settingsApi.update({ [key]: next[key] }); } catch {}
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={s.back} testID="settings-back">
          <Icon name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text style={s.title}>Innstillinger</Text>
      </View>

      <View style={{ paddingHorizontal: 20 }}>
        {!settings ? (
          <View style={{ paddingTop: 60 }}><Loader /></View>
        ) : (
          <>
            <View style={s.card}>
              {TOGGLES.map((t, i) => (
                <View key={t.key} style={[s.row, i < TOGGLES.length - 1 && s.rowBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowLabel}>{t.label}</Text>
                    <Text style={s.rowSub}>{t.sub}</Text>
                  </View>
                  <Switch
                    testID={`setting-${t.key}`}
                    value={!!settings[t.key]}
                    onValueChange={() => toggle(t.key)}
                    trackColor={{ false: colors.line, true: colors.accent }}
                    thumbColor={colors.text}
                  />
                </View>
              ))}
            </View>

            <View style={[s.card, { marginTop: 16 }]}>
              <View style={s.infoRow}><Text style={s.rowLabel}>Versjon</Text><Text style={s.rowValue}>1.0.0</Text></View>
              <View style={[s.infoRow, { borderTopWidth: 1, borderTopColor: colors.line }]}>
                <Text style={s.rowLabel}>Support</Text><Text style={s.rowValue}>support@kjapp.no</Text>
              </View>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  header: { paddingHorizontal: 20, paddingBottom: 16, gap: 16 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line },
  title: { fontFamily: font.display, fontSize: 26, color: c.text },
  card: { backgroundColor: c.card, borderRadius: 20, borderWidth: 1, borderColor: c.line, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: c.line },
  rowLabel: { color: c.text, fontSize: 15 },
  rowSub: { color: c.textMuted, fontSize: 12, marginTop: 3 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16 },
  rowValue: { color: c.textMuted, fontSize: 14 },
}));
