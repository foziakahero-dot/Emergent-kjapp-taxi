import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { FigmaGradient } from '@/src/components/FigmaGradient';
import { V10Entrance } from '@/src/components/V10Entrance';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/src/components/Typography';
import { V10Icon } from '@/src/components/V10Icon';
import { V10Header, v10 } from '@/src/components/V10UI';
import { colors, font, useColorTheme } from '@/src/theme';

export type StudioOption = { id: string; label: string; icon: string; title: string; sub: string; body: string; disabled?: boolean };
type Props = {
  product: 'customer' | 'driver'; value: string; options: StudioOption[]; earnings?: number | null;
  onApply: (value: string) => boolean | Promise<boolean>; onContinue: () => void;
};

/** Native adapter of the supplied ExperienceStudio.tsx and signature.css. */
export function ExperienceStudio({ product, value, options, earnings, onApply, onContinue }: Props) {
  useColorTheme();
  const insets = useSafeAreaInsets();
  const driver = product === 'driver';
  const selected = options.find(item => item.id === value) ?? options[0];
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(selected.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const applyLock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const choice = options.find(item => item.id === draft) ?? selected;
  const goal = Number(value);
  const income = typeof earnings === 'number' && Number.isFinite(earnings) && earnings >= 0 ? earnings : null;
  const progress = income !== null && Number.isFinite(goal) && goal > 0 ? Math.min(100, Math.round(income / goal * 100)) : null;
  const close = () => { if (!applyLock.current) setOpen(false); };
  const apply = async () => {
    if (applyLock.current || choice.disabled) return;
    applyLock.current = true; setBusy(true); setError('');
    try {
      const saved = await onApply(choice.id);
      if (!mounted.current) return;
      if (saved) { setOpen(false); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onContinue(); }
      else setError('Valget kunne ikke lagres. Prøv igjen.');
    } catch { if (mounted.current) setError('Valget kunne ikke lagres. Prøv igjen.'); }
    finally { applyLock.current = false; if (mounted.current) setBusy(false); }
  };
  const eyebrow = { fontFamily: font.semibold, fontSize: 9, lineHeight: 12, letterSpacing: 1.35, color: colors.textSecondary };
  return <View testID={`${product}-experience-studio`} style={{ paddingTop: 8, paddingBottom: 16 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, boxShadow: `0 0 0 4px ${colors.accentSoft}` }} />
      <Text style={eyebrow}>SNAR {driver ? 'DRIVE' : 'PERSONAL'}</Text>
      <Text style={[eyebrow, { marginLeft: 'auto', color: colors.textMuted, letterSpacing: .72 }]}>01 / {driver ? 'DITT SKIFT' : 'DIN REISE'}</Text>
    </View>
    <Text style={{ fontFamily: font.semibold, fontSize: 30, lineHeight: 32.4, letterSpacing: -1.65, marginVertical: 16, color: colors.text }}>
      {driver ? 'Bak rattet.' : 'Byen er din.'}{'\n'}<Text style={{ fontFamily: font.body, fontSize: 30, lineHeight: 32.4, color: colors.textSecondary }}>{driver ? 'Foran dagen.' : 'Reis på din måte.'}</Text>
    </Text>
    <View style={{ borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 18, overflow: 'hidden' }}>
      <FigmaGradient angle={120} colors={[colors.cardSubtle, colors.surface]} style={StyleSheet.absoluteFill} />
      <View style={{ padding: 16 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}><V10Icon name={selected.icon} size={26} color={colors.accent} /></View>
        <View style={{ flex: 1 }}><Text style={{ fontFamily: font.semibold, fontSize: 14, lineHeight: 21, color: colors.text }}>{driver ? selected.sub : `Din reisestil · ${selected.label}`}</Text>
          <Text style={{ fontFamily: font.body, fontSize: 11, lineHeight: 16.5, color: colors.textSecondary }}>{driver ? income !== null ? `${income.toLocaleString('nb-NO')} av ${goal.toLocaleString('nb-NO')} kr · ${progress} % av målet` : 'Dagens inntekt er ikke tilgjengelig' : selected.sub}</Text>
        </View></View>
        <Pressable testID={`${product}-studio-open`} accessibilityRole="button" hitSlop={5} onPress={() => { setDraft(selected.id); setError(''); setOpen(true); }} style={({ pressed }) => ({ height: 34, marginTop: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceInverse, transform: [{ scale: pressed ? .97 : 1 }] })}><Text style={{ fontFamily: font.semibold, fontSize: 12, color: colors.onInverse }}>{driver ? 'Åpne Skiftstudio' : 'Åpne Reisestudio'}</Text></Pressable>
      </View>
    </View>
    <Text style={{ marginTop: 8, fontFamily: font.medium, fontSize: 8, lineHeight: 10, letterSpacing: .96, color: colors.textSecondary }}>{driver ? 'PERSONLIG MÅL' : 'PERSONLIG REISESTIL'}</Text>
    {driver ? <View accessibilityRole="progressbar" accessibilityLabel="Dagens inntekt mot personlig mål" accessibilityValue={progress === null ? { text: 'Inntekt ikke tilgjengelig' } : { min: 0, max: 100, now: progress }} style={{ height: 3, marginTop: 8, borderRadius: 8, backgroundColor: colors.lineStrong, overflow: 'hidden' }}>{progress !== null ? <View style={{ width: `${progress}%`, height: 3, backgroundColor: colors.success }} /> : null}</View> : null}
    <Modal testID={`${product}-studio-modal`} visible={open} animationType="none" presentationStyle="fullScreen" onRequestClose={close}>
      <V10Entrance fade style={{ flex: 1 }}>
      <ScrollView testID={`${product}-studio-dialog`} accessibilityViewIsModal accessibilityLabel={driver ? 'Skiftstudio' : 'Reisestudio'} keyboardShouldPersistTaps="handled" style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingTop: Math.max(56, insets.top + 8), paddingHorizontal: 24, paddingBottom: Math.max(32, insets.bottom) }}>
        <V10Header title={driver ? 'Skiftstudio' : 'Reisestudio'} onBack={close} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><V10Icon name="ai" size={16} color={colors.textSecondary} /><Text style={eyebrow}>DESIGNET RUNDT DEG</Text></View>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height: 120, marginVertical: 8, alignItems: 'center', justifyContent: 'center' }}>
          {[80, 110, 140].map((size, index) => <View key={size} style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: index === 2 ? colors.line : colors.lineStrong, borderStyle: index === 1 ? 'dashed' : 'solid', transform: [{ rotate: index === 1 ? '-20deg' : '0deg' }] }} />)}
          <View style={{ padding: 8, borderRadius: 18, backgroundColor: colors.accentSoft }}><V10Icon name={choice.icon} size={40} color={colors.accent} /></View>
        </View>
        <View accessibilityLiveRegion="polite" style={{ minHeight: 136 }}><Text style={{ fontFamily: font.semibold, fontSize: 32, lineHeight: 38, letterSpacing: -1.44, color: colors.text }}>{choice.title}</Text><Text style={[v10.secondary, { marginTop: 16, lineHeight: 22.4 }]}>{choice.body}</Text></View>
        <View accessibilityRole="tablist" style={{ height: 66, marginVertical: 16, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderRadius: 18, borderWidth: 1, borderColor: colors.glassLine, backgroundColor: colors.surface, boxShadow: colors.elevation2 }}>
          {options.map(item => <Pressable key={item.id} testID={`${product}-studio-choice-${item.id}`} accessibilityRole="tab" aria-selected={item.id === draft} accessibilityLabel={item.label} accessibilityState={{ selected: item.id === draft, disabled: Boolean(item.disabled || busy) }} disabled={item.disabled || busy} onPress={() => setDraft(item.id)} style={({ pressed }) => ({ width: '30%', height: 54, borderRadius: 16, gap: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: item.id === draft ? colors.accentSoft : 'transparent', opacity: item.disabled ? .5 : 1, transform: [{ scale: pressed ? .9 : 1 }] })}><V10Icon name={item.icon} size={22} color={item.id === draft ? colors.accent : colors.textMuted} /><Text style={{ fontFamily: font.medium, fontSize: 10.5, lineHeight: 14, color: item.id === draft ? colors.accent : colors.textMuted }}>{item.label}</Text>{item.id === draft ? <View style={{ position: 'absolute', bottom: 2, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent }} /> : null}</Pressable>)}
        </View>
        <View style={{ padding: 16, gap: 8, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 18 }}><Text style={v10.overline}>{driver ? 'Ditt personlige mål' : 'Ditt neste steg'}</Text><Text style={v10.heading}>{choice.sub}</Text><Text style={[v10.caption, driver && { minHeight: 32 }]}>{driver ? 'Lagres på denne enheten. Du styrer skiftet selv.' : 'Bilvalget følger deg videre. Ingen tur bestilles her.'}</Text></View>
        {error ? <Text accessibilityRole="alert" style={[v10.secondary, { color: colors.danger, marginTop: 16 }]}>{error}</Text> : null}
        <View style={{ marginTop: 24, gap: 4 }}><StudioAction testID={`${product}-studio-apply`} label={driver ? 'Lagre mål og se innsikt' : 'Bruk reisestilen og se ruten'} onPress={() => void apply()} disabled={busy || choice.disabled} /><StudioAction testID={`${product}-studio-cancel`} label="Tilbake uten endringer" onPress={close} disabled={busy} ghost /></View>
      </ScrollView>
      </V10Entrance>
    </Modal>
  </View>;
}
function StudioAction({ label, onPress, disabled, ghost = false, testID }: { label: string; onPress: () => void; disabled?: boolean; ghost?: boolean; testID: string }) {
  return <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ disabled: Boolean(disabled) }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12, opacity: disabled ? .5 : 1, backgroundColor: ghost ? 'transparent' : colors.surfaceInverse, transform: [{ scale: pressed ? .97 : 1 }] })}><Text style={{ fontFamily: font.semibold, fontSize: 14, lineHeight: 20, color: ghost ? colors.textSecondary : colors.onInverse, textAlign: 'center' }}>{label}</Text></Pressable>;
}
