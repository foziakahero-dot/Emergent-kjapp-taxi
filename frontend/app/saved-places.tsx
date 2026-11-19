import { Text, TextInput } from '@/src/components/Typography';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FigmaGradient } from '@/src/components/FigmaGradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, font, makeStyles, useColorTheme } from '@/src/theme';
import { Icon, IconName } from '@/src/components/Icon';
import { Loader } from '@/src/components/ui';
import { mePlacesApi, placesApi } from '@/src/lib/api';
import { apiError } from '@/src/lib/format';
import { useAuth } from '@/src/context/AuthContext';
import { validPosition } from '@/src/lib/carAvailability';

const LABELS: { label: string; icon: IconName }[] = [
  { label: 'Hjem', icon: 'home' },
  { label: 'Jobb', icon: 'briefcase' },
  { label: 'Annet', icon: 'map-pin' },
];

export default function SavedPlaces() {
  useColorTheme();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const router = useRouter();
  const { user } = useAuth();
  const { label: initialLabel } = useLocalSearchParams<{ label?: string }>();
  const qc = useQueryClient();
  const placesKey = ['me-places', user?.id];
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: placesKey, queryFn: mePlacesApi.list, enabled: !!user?.id });
  const places = Array.isArray(data?.places) ? data.places : [];

  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [chosen, setChosen] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [targetLabel, setTargetLabel] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [error, setError] = useState('');
  const [searchError, setSearchError] = useState(false);
  const initialized = useRef(false);
  const searchRevision = useRef(0);
  const saveLock = useRef(false);
  const timer = useRef<any>(null);
  const isHomeOrWork = (label: string) => label === 'Hjem' || label === 'Jobb';
  const customName = customLabel.trim();
  const reservedName = ['hjem', 'jobb'].includes(customName.toLocaleLowerCase('nb-NO'));

  const openEditor = (label = '', place?: any) => {
    setEditingId(place?.id || '');
    setTargetLabel(label);
    setCustomLabel(label === 'Annet' || isHomeOrWork(label) ? '' : label);
    setAdding(true);
    setChosen(null);
    setQuery('');
    setResults([]);
    setError('');
  };
  const closeEditor = () => {
    setAdding(false);
    setChosen(null);
    setQuery('');
    setResults([]);
    setEditingId('');
    setTargetLabel('');
    setCustomLabel('');
  };

  useEffect(() => {
    if (initialized.current || isLoading || isError || !data || !['Hjem', 'Jobb'].includes(initialLabel || '')) return;
    initialized.current = true;
    const place = places.find((item: any) => item.label === initialLabel);
    openEditor(initialLabel, place);
  }, [isLoading, isError, initialLabel, data]);

  useEffect(() => {
    const revision = ++searchRevision.current;
    if (timer.current) clearTimeout(timer.current);
    setSearchError(false);
    setResults([]);
    if (query.trim().length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    timer.current = setTimeout(() => {
      placesApi.search(query.trim())
        .then((r) => { if (searchRevision.current === revision) setResults((r.results || []).filter((result: any) => typeof result.name === 'string' && result.name.trim() && validPosition(result))); })
        .catch(() => { if (searchRevision.current === revision) setSearchError(true); })
        .finally(() => { if (searchRevision.current === revision) setSearching(false); });
    }, 350);
    return () => { searchRevision.current++; if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  const save = async (label: string, icon: IconName) => {
    if (!chosen || !label || saveLock.current) return;
    saveLock.current = true; setError('');
    setSaving(true);
    try {
      const value = { label, name: chosen.name, lat: chosen.lat, lng: chosen.lng, icon };
      const existingId = editingId || (isHomeOrWork(label) ? places.find((place: any) => place.label === label)?.id : undefined);
      if (existingId) await mePlacesApi.update(existingId, value);
      else await mePlacesApi.add(value);
      await qc.invalidateQueries({ queryKey: placesKey });
      closeEditor();
    } catch (e) { setError(apiError(e)); }
    finally { saveLock.current = false; setSaving(false); }
  };

  const remove = async (id: string) => {
    if (saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    setError('');
    try {
      await mePlacesApi.remove(id);
      await qc.invalidateQueries({ queryKey: placesKey });
      if (editingId === id) closeEditor();
    } catch (e) { setError(apiError(e)); }
    finally { saveLock.current = false; setSaving(false); }
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
                <Pressable accessibilityRole="button" accessibilityLabel={`Endre ${p.label}`} disabled={saving} onPress={() => openEditor(p.label, p)} testID={`place-edit-${p.id}`}><Text style={{ fontFamily: font.mono, fontSize: 10, letterSpacing: 1, color: colors.accent }}>ENDRE</Text></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Fjern ${p.label}`} disabled={saving} onPress={() => void remove(p.id)} testID={`place-remove-${p.id}`} style={{ padding: 6 }}>
                  <Icon name="x" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            ))}

            {!places.length && !adding ? (
              <Text style={s.empty}>Lagre adresser du bruker ofte, så slipper du å søke neste gang.</Text>
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
                    {searchError ? <Text accessibilityRole="alert" style={s.chooseHint}>Kunne ikke søke etter adresser. Prøv igjen.</Text> : null}
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
                    {!targetLabel || isHomeOrWork(targetLabel) ? <Text style={s.chooseHint}>Hva vil du kalle dette stedet?</Text> : null}
                    <View style={s.labelRow}>
                      {LABELS.filter(l => targetLabel ? l.label === targetLabel : l.label !== 'Annet').map((l) => (
                        <Pressable key={l.label} style={s.labelChip} onPress={() => void save(l.label, l.icon)} disabled={saving} testID={`places-label-${l.label}`} accessibilityRole="button">
                          <Icon name={l.icon} size={16} color={colors.accent} />
                          <Text style={s.labelChipText}>{l.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                    {!isHomeOrWork(targetLabel) ? <>
                      <Text style={s.chooseHint}>Gi favoritten et navn</Text>
                      <View style={s.searchField}><TextInput testID="places-custom-name" accessibilityLabel="Navn på favoritt" placeholder="F.eks. Trening eller barnehage" placeholderTextColor={colors.textMuted} maxLength={40} value={customLabel} onChangeText={setCustomLabel} editable={!saving} style={s.searchInput} /></View>
                      {reservedName ? <Text accessibilityRole="alert" style={s.chooseHint}>Bruk snarveien for Hjem eller Jobb.</Text> : null}
                      <Pressable accessibilityRole="button" testID="places-save-favorite" style={[s.addBtn, { marginTop: 12, opacity: customName && !reservedName ? 1 : .5 }]} disabled={!customName || reservedName || saving} onPress={() => void save(customName, 'map-pin')}><Text style={s.addText}>Lagre favoritt</Text></Pressable>
                    </> : null}
                    {saving ? <ActivityIndicator color={colors.accent} style={{ marginTop: 12 }} /> : null}
                    <Pressable disabled={saving} onPress={() => setChosen(null)} style={{ marginTop: 12, alignItems: 'center' }} testID="places-choose-back">
                      <Text style={{ color: colors.textMuted, fontSize: 13 }}>Velg et annet sted</Text>
                    </Pressable>
                  </>
                )}
                <Pressable accessibilityRole="button" disabled={saving} onPress={closeEditor} style={{ paddingTop: 12, minHeight: 44, alignItems: 'center' }} testID="places-cancel-edit"><Text style={s.chooseHint}>Avbryt</Text></Pressable>
              </View>
            ) : (
              <Pressable style={s.addBtn} disabled={saving} onPress={() => openEditor()} testID="places-add" accessibilityRole="button">
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
