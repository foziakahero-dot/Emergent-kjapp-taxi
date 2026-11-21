import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TextInput } from '@/src/components/Typography';
import { V10Action, V10Header, v10 } from '@/src/components/V10UI';
import { Icon } from '@/src/components/Icon';
import { useReducedMotion } from '@/src/components/Motion';
import { useAuth } from '@/src/context/AuthContext';
import { aiApi, customerSupportApi } from '@/src/lib/api';
import { apiError } from '@/src/lib/format';
import { font, makeStyles, useTheme } from '@/src/theme';
import { useTranslation } from '@/src/lib/customerLanguage';

type Message = { role: 'assistant' | 'user'; text: string };
const FAQ = ['Hvordan fungerer fastpris?', 'Jeg glemte noe i bilen', 'Endre destinasjon underveis', 'Refusjon og klage på en tur'];

/** Figma Support layout, with replies and ticket IDs supplied by SNAR. */
export function CustomerSupport({ onBack, initialMessage = '', tripId }: {
  onBack: () => void; initialMessage?: string; tripId?: string;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const reduced = useReducedMotion();
  const scroll = useRef<ScrollView>(null);
  const active = useRef(true);
  const requestLock = useRef(false);
  const sessionId = useRef(`support_${user?.id || 'customer'}_${Date.now()}`).current;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(initialMessage);
  const [failed, setFailed] = useState('');
  const fullySent = useRef(0);
  const lastTicket = useRef<{ message: string; ticket: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [aiUnavailable, setAiUnavailable] = useState(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const append = (message: Message) => setMessages(previous => [...previous, message]);

  const send = async (text = input, retry = false) => {
    const value = text.trim();
    if (!value || requestLock.current) return;
    requestLock.current = true; setBusy(true); setError(''); setFailed(''); setInput('');
    if (!retry) append({ role: 'user', text: value });
    try {
      const result = await aiApi.chat(value, sessionId, tripId);
      if (active.current) {
        setAiUnavailable(false);
        if (typeof result.reply !== 'string' || !result.reply.trim()) throw new Error(t('Ingen svar mottatt. Prøv igjen.'));
        append({ role: 'assistant', text: result.reply });
        if (result.ticket_id) {
          lastTicket.current = { message: value, ticket: result.ticket_id };
          fullySent.current = messages.length + (retry ? 1 : 2);
        }
      }
    } catch (e: any) { if (active.current) {
      const unavailable = e?.response?.status === 503;
      setAiUnavailable(unavailable); setError(unavailable ? '' : apiError(e));
      setFailed(value); setInput(current => current || value);
    } }
    finally { requestLock.current = false; if (active.current) setBusy(false); }
  };
  const escalate = async () => {
    if (requestLock.current) return;
    const unsent = messages.slice(fullySent.current);
    const topic = fullySent.current ? '' : initialMessage;
    const text = [...new Set([topic, ...unsent.filter(message => message.role === 'user').map(message => message.text), input].map(value => value.trim()).filter(Boolean))].join('\n\n');
    if (!text && lastTicket.current) {
      setError(`Henvendelsen er allerede mottatt. Saksnummer: ${lastTicket.current.ticket}.`);
      return;
    }
    if (text.length < 10) { setError(t("Skriv minst 10 tegn om hva du trenger hjelp med.")); return; }
    if (!user) { setError(t('Logg inn før du sender en henvendelse.')); return; }
    if (lastTicket.current?.message === text) { setError(`Denne henvendelsen er allerede mottatt. Saksnummer: ${lastTicket.current.ticket}.`); return; }
    requestLock.current = true; setBusy(true); setError('');
    try {
      const result = await customerSupportApi.createCase(text.slice(0, 4000), sessionId, tripId);
      if (active.current) {
        if (result?.ok !== true || !result?.ticket_id) throw new Error(t('Henvendelsen kunne ikke bekreftes.'));
        lastTicket.current = { message: text, ticket: result.ticket_id };
        fullySent.current = messages.length + 1;
        append({ role: 'assistant', text: `${t('Henvendelsen er mottatt. Saksnummer:')} ${result.ticket_id}.` });
        setInput(''); setFailed('');
      }
    } catch (e) { if (active.current) setError(apiError(e)); }
    finally { requestLock.current = false; if (active.current) setBusy(false); }
  };

  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={{ paddingHorizontal: 20, paddingTop: Math.max(60, insets.top + 12) }}><V10Header title={t("Kundestøtte")} onBack={onBack} /><Text style={[v10.caption, { marginBottom: 16 }]}>{t(aiUnavailable ? 'Send en henvendelse til kundestøtte' : 'Chat med assistenten eller skriv til kundestøtte')}</Text></View>
    <ScrollView ref={scroll} style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: !reduced })}>
      <View style={s.chips}>{FAQ.map(question => <Pressable testID="customer-src-components-CustomerSupport-72" key={question} onPress={() => aiUnavailable ? setInput(t(question)) : void send(t(question))} disabled={busy} style={({ pressed }) => [s.chip, pressed && { transform: [{ scale: 0.95 }] }]}><Text style={{ fontSize: 12, fontFamily: font.medium, color: colors.textSecondary }}>{t(question)}</Text></Pressable>)}</View>
      <View style={[s.message, s.assistant, { marginBottom: 12 }]}><Text style={s.messageText}>{t('Hva trenger du hjelp med? Spør assistenten her, eller skriv til kundestøtte.')}</Text></View>
      <View style={{ gap: 10 }}>
        {messages.map((message, index) => <View key={index} style={{ alignItems: message.role === 'user' ? 'flex-end' : 'flex-start' }}>
          {message.role === 'user' ? <View style={[s.message, { borderBottomRightRadius: 6, backgroundColor: colors.surfaceInverse }]}><Text style={[s.messageText, { color: colors.onInverse }]}>{message.text}</Text></View> : <View style={[s.message, s.assistant]}><Text style={s.messageText}>{message.text}</Text></View>}
        </View>)}
        {busy && <ActivityIndicator style={{ alignSelf: 'flex-start', marginLeft: 14 }} color={colors.accent} />}
      </View>
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
      {aiUnavailable && failed ? <View testID="support-human-fallback" style={{ gap: 12, marginTop: 16 }}><Text accessibilityLiveRegion="polite" style={v10.secondary}>{t('Assistenten svarer ikke akkurat nå. Du kan sende meldingen videre til kundestøtte.')}</Text><V10Action label={t('Send til kundestøtte')} disabled={busy} busy={busy} onPress={() => void escalate()} testID="support-human-send" /></View> : failed ? <View style={{ gap: 8, marginTop: 12 }}><Text style={v10.secondary}>{t("Meldingen din er fortsatt her. Prøv igjen, eller send den til kundestøtte.")}</Text><V10Action testID="support-retry" kind="soft" small label={t("Spør assistenten på nytt")} disabled={busy} onPress={() => void send(failed, true)} /></View> : null}
    </ScrollView>
    <View style={[s.composer, { paddingBottom: insets.bottom + 112 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TextInput style={s.input} placeholder={t('Skriv til oss…')} placeholderTextColor={colors.textMuted} value={input} editable={!busy} onChangeText={setInput} onSubmitEditing={() => aiUnavailable ? void escalate() : void send()} returnKeyType="send" maxLength={4000} testID="support-message-input" />
        <Pressable onPress={() => aiUnavailable ? void escalate() : void send()} disabled={busy || !input.trim()} accessibilityRole="button" accessibilityLabel={t(aiUnavailable ? 'Send til kundestøtte' : 'Send til AI-assistent')} style={({ pressed }) => [{ opacity: busy || !input.trim() ? 0.55 : 1 }, pressed && { transform: [{ scale: 0.9 }] }]} testID="support-send">
          <View style={s.send}><Icon name="send" size={20} color={colors.accentOn} /></View>
        </Pressable>
      </View>
      <Pressable style={s.escalate} disabled={busy} onPress={() => void escalate()} testID="support-escalate"><Icon name="message" size={16} color={colors.textSecondary} /><Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: font.semibold }}>{t("Skriv til kundestøtte")}</Text></Pressable>
    </View>
  </KeyboardAvoidingView>;
}
const useStyles = makeStyles(colors => ({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong },
  message: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  assistant: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderBottomLeftRadius: 6 },
  messageText: { fontSize: 14, lineHeight: 19.25, color: colors.text },
  composer: { paddingHorizontal: 20, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface },
  input: { flex: 1, minWidth: 0, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong, color: colors.text },
  send: { backgroundColor: colors.accent, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  escalate: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, paddingVertical: 10, borderWidth: 1, borderColor: colors.line },
  error: { fontSize: 12, color: colors.danger, marginTop: 12 },
}));
