import { Text, TextInput } from '@/src/components/Typography';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FigmaGradient } from '@/src/components/FigmaGradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon, IconName } from '@/src/components/Icon';
import { Loader } from '@/src/components/ui';
import { mePlacesApi, placesApi } from '@/src/lib/api';
import { apiError } from '@/src/lib/format';

const LABELS: { label: string; icon: IconName }[] = [
  { label: 'Hjem', icon: 'home' },
  { label: 'Jobb', icon: 'briefcase' },
  { label: 'Annet', icon: 'map-pin' },
];

export default function SavedPlaces() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const router = useRouter();
  const { label: initialLabel } = useLocalSearchParams<{ label?: string }>();
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['me-places'], queryFn: mePlacesApi.list });
  const places = data?.places || [];

  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [chosen, setChosen] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [targetLabel, setTargetLabel] = useState('');
  const [error, setError] = useState('');
  const initialized = useRef(false);
  const searchRevision = useRef(0);
  const saveLock = useRef(false);
  const timer = useRef<any>(null);

  useEffect(() => {
    if (initialized.current || isLoading || isError || !data || !['Hjem', 'Jobb'].includes(initialLabel || '')) return;
    initialized.current = true;
    const place = places.find((item: any) => item.label === initialLabel);
    setEditingId(place?.id || ''); setTargetLabel(initialLabel || ''); setAdding(true); setChosen(null); setQuery('');
  }, [isLoading, isError, initialLabel, data]);

  useEffect(() => {
    const revision = ++searchRevision.current;
    if (timer.current) clearTimeout(timer.current);
    if (query.trim().length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    timer.current = setTimeout(() => {
      placesApi.search(query.trim())
        .then((r) => { if (searchRevision.current === revision) setResults(r.results || []); })
        .catch(() => { if (searchRevision.current === revision) setResults([]); })
        .finally(() => { if (searchRevision.current === revision) setSearching(false); });
    }, 350);
    return () => { searchRevision.current++; if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  const save = async (label: string, icon: IconName) => {
    if (!chosen || saveLock.current) return;
    saveLock.current = true; setError('');
    setSaving(true);
    try {
      const value = { label, name: chosen.name, lat: chosen.lat, lng: chosen.lng, icon };
      if (editingId) await mePlacesApi.update(editingId, value);
      else await mePlacesApi.add(value);
      await qc.invalidateQueries({ queryKey: ['me-places'] });
      setAdding(false);
      setChosen(null);
      setQuery('');
      setResults([]);
      setEditingId('');
      setTargetLabel('');
    } catch (e) { setError(apiError(e)); }
    finally { saveLock.current = false; setSaving(false); }
  };

  const remove = async (id: string) => {
    try {
      await mePlacesApi.remove(id);
      await qc.invalidateQueries({ queryKey: ['me-places'] });
    } catch (e) { setError(apiError(e)); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FigmaGradient angle={180} colors={['#FFFFFF', '#F2F5FA']} style={StyleSheet.absoluteFill} />
      <View style={[s.header, { paddingTop: insets.top + 56 }]}>
        <Pressable onPress={() => router.back()} style={s.back} testID="places-back">
          <Icon name="chevron-left" size={16} color={colors.text} />
        </Pressable>
        <Text style={s.title}>Favorittadresser</Text>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: insets.bottom + 112 }}>
        {error ? <Text style={{ color: colors.danger, fontSize: 12, marginBottom: 12 }} accessibilityRole="alert">{error}</Text> : null}
        {isError ? <View style={{ gap: 12 }}><Text style={{ color: colors.danger }} accessibilityRole="alert">Kunne ikke hente adressene dine.</Text><Pressable onPress={() => void refetch()} accessibilityRole="button" testID="places-retry"><Text style={{ color: colors.accent }}>Prøv igjen</Text></Pressable></View> : isLoading ? (
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
                <Pressable onPress={() => { setEditingId(p.id); setTargetLabel(p.label); setAdding(true); setChosen(null); setQuery(''); }} testID={`place-edit-${p.id}`}><Text style={{ fontFamily: font.mono, fontSize: 10, letterSpacing: 1, color: colors.accent }}>ENDRE</Text></Pressable>
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
                      {LABELS.filter(l => !targetLabel || l.label === targetLabel).map((l) => (
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
              <Pressable style={s.addBtn} onPress={() => { setEditingId(''); setTargetLabel(''); setAdding(true); }} testID="places-add">
                <Icon name="plus" size={18} color={colors.accent} />
                <Text style={s.addText}>Legg til adresse</Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 28, paddingBottom: 24, gap: 12 },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.lineStrong },
  title: { flex: 1, fontFamily: font.semibold, fontSize: 24, letterSpacing: -0.48, color: c.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 16, marginBottom: 12 },
  rowIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.cardSubtle, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { color: c.text, fontSize: 14, fontWeight: '600' },
  rowName: { color: c.textSecondary, fontSize: 12 },
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
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: c.lineStrong, borderStyle: 'dashed' },
  addText: { color: c.accent, fontSize: 14, fontWeight: '600' },
}));
