import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TextInput } from '@/src/components/Typography';
import { FigmaGradient } from '@/src/components/FigmaGradient';
import { Icon } from '@/src/components/Icon';
import { useReducedMotion } from '@/src/components/Motion';
import { useAuth } from '@/src/context/AuthContext';
import { aiApi, api } from '@/src/lib/api';
import { apiError } from '@/src/lib/format';
import { colors, font } from '@/src/theme';

type Message = { role: 'assistant' | 'user'; text: string };
const FAQ = ['Hvordan fungerer fastpris?', 'Jeg glemte noe i bilen', 'Endre destinasjon underveis', 'Refusjon og klage på en tur'];

/** Figma Support layout, with replies and ticket IDs supplied by KJAPP. */
export function CustomerSupport({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const reduced = useReducedMotion();
  const scroll = useRef<ScrollView>(null);
  const active = useRef(true);
  const requestLock = useRef(false);
  const sessionId = useRef(`support_${user?.id || 'customer'}_${Date.now()}`).current;
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', text: 'Hei! Jeg er KJAPP AI-assistent. Spør meg om det meste, eller velg et vanlig tema under. Trenger du et menneske, kan du sende en henvendelse.' }]);
  const [input, setInput] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const append = (message: Message) => setMessages(previous => [...previous, message]);

  const send = async (text = input) => {
    const value = text.trim();
    if (!value || requestLock.current) return;
    requestLock.current = true; setBusy(true); setError(''); setInput('');
    append({ role: 'user', text: value });
    try {
      const result = await aiApi.chat(value, sessionId);
      if (active.current) {
        if (typeof result.reply !== 'string' || !result.reply.trim()) throw new Error('Ingen svar mottatt. Prøv igjen.');
        append({ role: 'assistant', text: result.reply });
      }
    } catch (e) { if (active.current) setError(apiError(e)); }
    finally { requestLock.current = false; if (active.current) setBusy(false); }
  };
  const escalate = async () => {
    if (requestLock.current) return;
    const text = input.trim() || messages.filter(message => message.role === 'user').map(message => message.text).join('\n');
    if (text.length < 10) { setError('Skriv minst 10 tegn om hva du trenger hjelp med.'); return; }
    if (!user?.email && !user?.phone) { setError('Legg til kontaktinformasjon før du sender en henvendelse.'); return; }
    requestLock.current = true; setBusy(true); setError('');
    try {
      const result = await api.post('/support/public', { topic: 'annet', name: user?.fullName, contact: user?.email || user?.phone, message: text.slice(0, 4000) });
      if (active.current) {
        if (!result.data?.ok || !result.data?.ticket_id) throw new Error('Henvendelsen kunne ikke bekreftes.');
        append({ role: 'assistant', text: `Henvendelsen er mottatt. Saksnummer: ${result.data.ticket_id}. Vi kontakter deg på ${user?.email || user?.phone}.` });
        setInput('');
      }
    } catch (e) { if (active.current) setError(apiError(e)); }
    finally { requestLock.current = false; if (active.current) setBusy(false); }
  };

  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <FigmaGradient angle={180} colors={['#FFFFFF', '#F2F5FA']} style={StyleSheet.absoluteFill} />
    <View style={[s.header, { paddingTop: insets.top + 56 }]}>
      <Pressable style={s.back} onPress={onBack} accessibilityRole="button" accessibilityLabel="Tilbake"><Icon name="chevron-left" size={16} /></Pressable>
      <FigmaGradient angle={135} colors={['#FF3B3B', '#FF0000']} style={s.aiIcon}><Icon name="sparkles" size={16} color="#FFFFFF" /></FigmaGradient>
      <View><Text style={s.title}>Kundestøtte</Text><Text style={s.status}>● KJAPP AI{busy ? ' · SVARER NÅ' : ''}</Text></View>
    </View>
    <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: !reduced })}>
      <View style={s.chips}>{FAQ.map(question => <Pressable key={question} onPress={() => void send(question)} disabled={busy} style={({ pressed }) => [s.chip, pressed && { transform: [{ scale: 0.95 }] }]}><Text style={{ fontSize: 12, fontFamily: font.medium, color: colors.textSecondary }}>{question}</Text></Pressable>)}</View>
      <View style={{ gap: 10 }}>
        {messages.map((message, index) => <View key={index} style={{ alignItems: message.role === 'user' ? 'flex-end' : 'flex-start' }}>
          {message.role === 'user' ? <FigmaGradient colors={['#FF3B3B', '#FF0000']} style={[s.message, { borderBottomRightRadius: 6 }]}><Text style={[s.messageText, { color: '#FFFFFF' }]}>{message.text}</Text></FigmaGradient> : <View style={[s.message, s.assistant]}><Text style={s.messageText}>{message.text}</Text></View>}
        </View>)}
        {busy && <ActivityIndicator style={{ alignSelf: 'flex-start', marginLeft: 14 }} color={colors.accent} />}
      </View>
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
      <View style={s.reward}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="gift" size={16} color={colors.accent} /><Text style={{ fontSize: 14, fontFamily: font.semibold }}>Kode eller reward</Text></View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <TextInput value={code} onChangeText={setCode} placeholder="F.eks. VENN50" placeholderTextColor={colors.textMuted} autoCapitalize="characters" style={s.codeInput} />
          <Pressable style={s.redeem} onPress={() => setError('Kodeinnløsning er ikke aktivert ennå. Kontakt kundestøtte for hjelp med en kode.')} accessibilityRole="button"><Text style={{ color: '#FFFFFF', fontFamily: font.semibold, fontSize: 14 }}>Løs inn</Text></Pressable>
        </View>
      </View>
    </ScrollView>
    <View style={[s.composer, { paddingBottom: insets.bottom + 112 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TextInput style={s.input} placeholder="Skriv til oss…" placeholderTextColor={colors.textMuted} value={input} onChangeText={setInput} onSubmitEditing={() => void send()} returnKeyType="send" maxLength={4000} testID="support-message-input" />
        <Pressable onPress={() => void send()} disabled={busy || !input.trim()} accessibilityRole="button" accessibilityLabel="Send til AI-assistent" style={({ pressed }) => [{ opacity: busy || !input.trim() ? 0.55 : 1 }, pressed && { transform: [{ scale: 0.9 }] }]} testID="support-send">
          <FigmaGradient colors={['#FF3B3B', '#FF0000']} style={s.send}><Icon name="send" size={20} color="#FFFFFF" /></FigmaGradient>
        </Pressable>
      </View>
      <Pressable style={s.escalate} disabled={busy} onPress={() => void escalate()} testID="support-escalate"><Icon name="message" size={16} color={colors.textSecondary} /><Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: font.semibold }}>Kontakt oss · send til et menneske</Text></Pressable>
    </View>
  </KeyboardAvoidingView>;
}
const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 28, paddingBottom: 12 },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' },
  aiIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: -4 },
  title: { fontSize: 18, lineHeight: 22.5, fontFamily: font.semibold, letterSpacing: -0.36 },
  status: { fontFamily: font.mono, fontSize: 9, letterSpacing: 0.9, color: colors.online },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong },
  message: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  assistant: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderBottomLeftRadius: 6 },
  messageText: { fontSize: 14, lineHeight: 19.25, color: colors.text },
  reward: { marginTop: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.lineStrong, padding: 16 },
  codeInput: { flex: 1, minWidth: 0, backgroundColor: colors.cardSubtle, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, textTransform: 'uppercase', color: colors.text },
  redeem: { borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: colors.accent },
  composer: { paddingHorizontal: 20, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: 'rgba(255,255,255,0.9)' },
  input: { flex: 1, minWidth: 0, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong, color: colors.text },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  escalate: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, paddingVertical: 10, borderWidth: 1, borderColor: colors.line },
  error: { fontSize: 12, color: colors.danger, marginTop: 12 },
});
