import { Text, TextInput } from '@/src/components/Typography';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon, IconName } from '@/src/components/Icon';
import { Loader } from '@/src/components/ui';
import { mePlacesApi, placesApi } from '@/src/lib/api';

const LABELS: { label: string; icon: IconName }[] = [
  { label: 'Hjem', icon: 'home' },
  { label: 'Jobb', icon: 'briefcase' },
  { label: 'Annet', icon: 'map-pin' },
];

export default function SavedPlaces() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const router = useRouter();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['me-places'], queryFn: mePlacesApi.list });
  const places = data?.places || [];

  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [chosen, setChosen] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const timer = useRef<any>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    timer.current = setTimeout(() => {
      placesApi.search(query.trim())
        .then((r) => setResults(r.results || []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 350);
    return () => timer.current && clearTimeout(timer.current);
  }, [query]);

  const save = async (label: string, icon: IconName) => {
    if (!chosen) return;
    setSaving(true);
    try {
      await mePlacesApi.add({ label, name: chosen.name, lat: chosen.lat, lng: chosen.lng, icon });
      await qc.invalidateQueries({ queryKey: ['me-places'] });
      setAdding(false);
      setChosen(null);
      setQuery('');
      setResults([]);
    } catch {}
    finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    try {
      await mePlacesApi.remove(id);
      await qc.invalidateQueries({ queryKey: ['me-places'] });
    } catch {}
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={s.back} testID="places-back">
          <Icon name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text style={s.title}>Lagrede steder</Text>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}>
        {isLoading ? (
          <View style={{ paddingTop: 60 }}><Loader /></View>
        ) : (
          <>
            {places.map((p: any) => (
              <View key={p.id} style={s.row} testID={`place-${p.id}`}>
                <View style={s.rowIcon}><Icon name={p.icon as IconName} size={18} color={colors.accent} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowLabel}>{p.label}</Text>
                  <Text style={s.rowName} numberOfLines={1}>{p.name}</Text>
                </View>
                <Pressable onPress={() => remove(p.id)} testID={`place-remove-${p.id}`} style={{ padding: 6 }}>
                  <Icon name="x" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            ))}

            {!places.length && !adding ? (
              <Text style={s.empty}>Lagre stedene du reiser til ofte for bestilling med ett trykk.</Text>
            ) : null}

            {adding ? (
              <View style={s.addBox}>
                {!chosen ? (
                  <>
                    <View style={s.searchField}>
                      <Icon name="search" size={18} color={colors.textMuted} />
                      <TextInput
                        testID="places-search-input"
                        autoFocus
                        placeholder="Søk adresse eller sted"
                        placeholderTextColor={colors.textMuted}
                        style={s.searchInput}
                        value={query}
                        onChangeText={setQuery}
                      />
                      {searching ? <ActivityIndicator color={colors.accent} /> : null}
                    </View>
                    {results.map((r: any, i: number) => (
                      <Pressable key={`${r.name}-${i}`} style={s.resultRow} testID={`places-result-${i}`} onPress={() => setChosen(r)}>
                        <Icon name="map-pin" size={16} color={colors.accent} />
                        <Text style={s.resultText} numberOfLines={1}>{r.name}</Text>
                      </Pressable>
                    ))}
                  </>
                ) : (
                  <>
                    <Text style={s.chosenName} numberOfLines={2}>{chosen.name}</Text>
                    <Text style={s.chooseHint}>Hva vil du kalle dette stedet?</Text>
                    <View style={s.labelRow}>
                      {LABELS.map((l) => (
                        <Pressable key={l.label} style={s.labelChip} onPress={() => save(l.label, l.icon)} disabled={saving} testID={`places-label-${l.label}`}>
                          <Icon name={l.icon} size={16} color={colors.accent} />
                          <Text style={s.labelChipText}>{l.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                    {saving ? <ActivityIndicator color={colors.accent} style={{ marginTop: 12 }} /> : null}
                    <Pressable onPress={() => setChosen(null)} style={{ marginTop: 12, alignItems: 'center' }} testID="places-choose-back">
                      <Text style={{ color: colors.textMuted, fontSize: 13 }}>Velg et annet sted</Text>
                    </Pressable>
                  </>
                )}
              </View>
            ) : (
              <Pressable style={s.addBtn} onPress={() => setAdding(true)} testID="places-add">
                <Icon name="plus" size={18} color={colors.accent} />
                <Text style={s.addText}>Legg til sted</Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  header: { paddingHorizontal: 20, paddingBottom: 16, gap: 16 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line },
  title: { fontFamily: font.display, fontSize: 26, color: c.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 14, marginBottom: 12 },
  rowIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.cardSubtle, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { color: c.text, fontSize: 15, fontWeight: '600' },
  rowName: { color: c.textMuted, fontSize: 13, marginTop: 2 },
  empty: { color: c.textMuted, fontSize: 14, marginVertical: 16, lineHeight: 20 },
  addBox: { backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 16, marginTop: 8 },
  searchField: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingHorizontal: 14, height: 52 },
  searchInput: { flex: 1, color: c.text, fontSize: 16, height: '100%' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.line },
  resultText: { color: c.text, fontSize: 15, flex: 1 },
  chosenName: { color: c.text, fontFamily: font.display, fontSize: 18 },
  chooseHint: { color: c.textMuted, fontSize: 13, marginTop: 6, marginBottom: 14 },
  labelRow: { flexDirection: 'row', gap: 10 },
  labelChip: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: 14, backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line },
  labelChipText: { color: c.text, fontSize: 13 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 16, borderWidth: 1, borderColor: c.line, borderStyle: 'dashed', marginTop: 8 },
  addText: { color: c.accent, fontSize: 15, fontWeight: '600' },
}));

