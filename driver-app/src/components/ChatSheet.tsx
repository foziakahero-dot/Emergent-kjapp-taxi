import { Text, TextInput } from '@/src/components/Typography';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon } from '@/src/components/Icon';
import { messagesApi } from '@/src/lib/api';

export function ChatSheet({
  tripId,
  role,
  visible,
  onClose,
  peerName,
}: {
  tripId: string;
  role: 'passenger' | 'driver';
  visible: boolean;
  onClose: () => void;
  peerName?: string;
}) {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!visible) return;
    let mounted = true;
    const load = async () => {
      try {
        const r = await messagesApi.list(tripId);
        if (mounted) setMessages(r.messages || []);
      } catch {}
      finally { if (mounted) setLoading(false); }
    };
    load();
    const i = setInterval(load, 3000);
    return () => { mounted = false; clearInterval(i); };
  }, [visible, tripId]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setSending(true);
    setText('');
    try {
      const msg = await messagesApi.send(tripId, t);
      setMessages((m) => [...m, msg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      setText(t);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[s.sheet, { paddingBottom: insets.bottom + 8 }]}
        >
          <View style={[s.header, { paddingTop: 14 }]}>
            <View style={s.handle} />
            <View style={s.headerRow}>
              <Text style={s.title}>{peerName || (role === 'passenger' ? 'Din sjåfør' : 'Kunde')}</Text>
              <Pressable onPress={onClose} testID="chat-close" style={s.closeBtn}>
                <Icon name="x" size={20} color={colors.text} />
              </Pressable>
            </View>
          </View>

          {loading ? (
            <View style={s.center}><ActivityIndicator color={colors.accent} /></View>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(m, i) => m.id || String(i)}
              contentContainerStyle={{ padding: 16, gap: 10 }}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
              ListEmptyComponent={<Text style={s.empty}>Ingen meldinger ennå. Si hei!</Text>}
              renderItem={({ item }) => {
                const mine = item.from_role === role;
                return (
                  <View style={[s.bubbleRow, mine ? s.bubbleRowMine : s.bubbleRowTheirs]}>
                    <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleTheirs]}>
                      <Text style={[s.bubbleText, mine && { color: colors.accentOn }]}>{item.text}</Text>
                    </View>
                  </View>
                );
              }}
            />
          )}

          <View style={s.inputRow}>
            <TextInput
              testID="chat-input"
              value={text}
              onChangeText={setText}
              placeholder="Skriv en melding…"
              placeholderTextColor={colors.textMuted}
              style={s.input}
              multiline
              onSubmitEditing={send}
            />
            <Pressable onPress={send} disabled={sending || !text.trim()} testID="chat-send" style={[s.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]}>
              {sending ? <ActivityIndicator color={colors.accentOn} /> : <Icon name="navigation" size={18} color={colors.accentOn} />}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.68)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: c.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: c.line, height: '78%' },
  header: { paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: c.line, paddingBottom: 12 },
  handle: { alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: c.lineStrong, marginBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: c.text, fontFamily: font.display, fontSize: 20 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cardSubtle },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: c.textMuted, fontSize: 14, textAlign: 'center', marginTop: 40 },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: c.accent, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line, borderBottomLeftRadius: 4 },
  bubbleText: { color: c.text, fontSize: 15, lineHeight: 20 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.line },
  input: { flex: 1, maxHeight: 110, minHeight: 48, backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line, borderRadius: 16, paddingHorizontal: 14, paddingTop: 12, color: c.text, fontSize: 15 },
  sendBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
}));

