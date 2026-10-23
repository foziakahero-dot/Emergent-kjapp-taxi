import { Text } from '@/src/components/Typography';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { Icon } from '@/src/components/Icon';
import { colors, font, makeStyles, useColorTheme } from '@/src/theme';
import { aiApi } from '@/src/lib/api';
import { apiError } from '@/src/lib/format';

const MAX_SECONDS = 5;

export function VoiceCommandButton({ top, onCommand }: { top: number; onCommand: (text: string) => string }) {
  useColorTheme();
  const s = useStyles();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState('');
  const session = useRef(false);
  const wasRecording = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      session.current = false;
      void recorder.stop().catch(() => {});
      void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    };
  }, [recorder]);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(''), 4500);
    return () => clearTimeout(timer);
  }, [feedback]);

  const finish = async (stop: boolean) => {
    if (!session.current) return;
    session.current = false;
    setProcessing(true);
    try {
      if (stop) await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error('Fant ikke lydopptaket.');
      const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const lower = uri.toLowerCase();
      const mime = lower.endsWith('.wav') ? 'audio/wav' : lower.endsWith('.webm') ? 'audio/webm' : lower.endsWith('.mp4') ? 'audio/mp4' : 'audio/m4a';
      const { text } = await aiApi.transcribe(b64, mime, 'no');
      if (!alive.current) return;
      const heard = String(text || '').trim();
      setFeedback(heard ? onCommand(heard) : 'Hørte ikke noe tydelig. Prøv igjen.');
    } catch (e) {
      if (alive.current) setFeedback(apiError(e));
    } finally {
      if (alive.current) setProcessing(false);
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    }
  };

  useEffect(() => {
    const ended = wasRecording.current && !state.isRecording;
    wasRecording.current = state.isRecording;
    if (ended && session.current) void finish(false);
  }, [state.isRecording]);

  const toggle = async () => {
    if (processing) return;
    if (state.isRecording) { await finish(true); return; }
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) { setFeedback('Gi SNAR Driver tilgang til mikrofonen for talekommandoer.'); return; }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      session.current = true;
      setFeedback('');
      recorder.record({ forDuration: MAX_SECONDS });
    } catch (e) {
      session.current = false;
      setFeedback(apiError(e));
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    }
  };

  if (Platform.OS === 'web') return null;

  const listening = state.isRecording;
  const label = processing ? 'Tolker talekommando' : listening ? 'Stopp opptak' : 'Talekommando';

  return (
    <View style={[s.wrap, { top }]} pointerEvents="box-none">
      {feedback || listening ? (
        <View style={s.bubble} accessibilityLiveRegion="polite">
          <Text style={s.bubbleText}>{listening ? 'Lytter … si «godta», «avslå», «ring kunden» eller «naviger»' : feedback}</Text>
        </View>
      ) : null}
      <Pressable
        onPress={() => void toggle()}
        accessibilityRole="button"
        accessibilityLabel={label}
        testID="driver-voice-command"
        style={[s.button, listening && s.buttonActive]}
      >
        {processing ? <ActivityIndicator color={colors.accentOn} /> : <Icon name={listening ? 'square' : 'mic'} size={22} color={listening ? colors.accentOn : colors.text} />}
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { position: 'absolute', right: 16, zIndex: 60, flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: '92%' },
  bubble: { flexShrink: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line },
  bubbleText: { color: c.text, fontFamily: font.medium, fontSize: 14, lineHeight: 20 },
  button: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, shadowColor: '#0B0E14', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  buttonActive: { backgroundColor: c.accent, borderColor: c.accent },
}));
