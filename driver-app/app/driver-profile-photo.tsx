import React, { useRef, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon } from '@/src/components/Icon';
import { Button } from '@/src/components/ui';
import { driverApi, apiError } from '@/src/lib/api';
import { useAuth } from '@/src/context/AuthContext';

export default function DriverProfilePhoto() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const camera = useRef<any>(null);
  const queryClient = useQueryClient();
  const { refresh } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [photo, setPhoto] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const openCamera = async () => {
    setErr('');
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setErr('Kameratilgang må være aktivert for å ta profilbilde.');
        return;
      }
    }
    setPhoto('');
    setCameraOpen(true);
  };

  const capture = async () => {
    if (!camera.current || busy) return;
    setBusy(true);
    setErr('');
    try {
      const picture = await camera.current.takePictureAsync({ quality: 0.82, skipProcessing: false, exif: false });
      if (!picture?.uri) throw new Error('Kameraet returnerte ikke et bilde');
      setPhoto(picture.uri);
      setCameraOpen(false);
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!photo || busy) return;
    setBusy(true);
    setErr('');
    try {
      await driverApi.updateProfilePhoto(photo);
      await refresh();
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      await queryClient.invalidateQueries({ queryKey: ['driver-profile-photo-source'] });
      router.back();
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.driverBg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32, paddingHorizontal: 20 }}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.back}>
            <Icon name="arrow-left" size={20} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Profilbilde</Text>
            <Text style={s.subtitle}>Bildet vises på din KJAPP-sjåførprofil</Text>
          </View>
        </View>

        <View style={s.note}>
          <Icon name="user" size={20} color={colors.online} />
          <Text style={s.noteText}>Bruk et tydelig bilde av ansiktet ditt. Profilbildet lagres privat og hentes kun når du er autentisert.</Text>
        </View>

        {cameraOpen ? (
          <View style={s.cameraCard}>
            <CameraView ref={camera} style={s.camera} facing="front">
              <View style={s.faceGuide} />
            </CameraView>
            <Button label={busy ? 'Tar bilde…' : 'Ta bilde'} onPress={() => void capture()} disabled={busy} />
            <Pressable style={s.cancel} onPress={() => setCameraOpen(false)}><Text style={s.cancelText}>Avbryt</Text></Pressable>
          </View>
        ) : photo ? (
          <View style={s.cameraCard}>
            <Image source={{ uri: photo }} style={s.preview} resizeMode="cover" />
            <Button label={busy ? 'Lagrer…' : 'Bruk dette profilbildet'} onPress={() => void save()} disabled={busy} />
            <Pressable style={s.cancel} onPress={() => void openCamera()}><Text style={s.cancelText}>Ta nytt bilde</Text></Pressable>
          </View>
        ) : (
          <Button label="Åpne frontkamera" onPress={() => void openCamera()} testID="driver-profile-photo-camera" />
        )}

        {err ? <Text style={s.error}>{err}</Text> : null}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 22 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line },
  title: { color: c.text, fontFamily: font.display, fontSize: 26 },
  subtitle: { color: c.textMuted, fontSize: 12, marginTop: 3 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 18, backgroundColor: c.onlineSoft, borderWidth: 1, borderColor: c.line, marginBottom: 18 },
  noteText: { flex: 1, color: c.textSecondary, fontSize: 13, lineHeight: 19 },
  cameraCard: { gap: 12 },
  camera: { height: 440, borderRadius: 24, overflow: 'hidden', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  faceGuide: { width: 235, height: 305, borderRadius: 118, borderWidth: 2, borderColor: 'rgba(255,255,255,0.72)' },
  preview: { width: '100%', height: 440, borderRadius: 24, backgroundColor: '#000' },
  cancel: { alignItems: 'center', paddingVertical: 10 },
  cancelText: { color: c.textMuted, fontSize: 14 },
  error: { color: c.danger, fontSize: 13, lineHeight: 19, marginTop: 14, textAlign: 'center' },
}));
