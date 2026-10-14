import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/src/context/AuthContext';
import { customerProfileApi } from '@/src/lib/api';
import { apiError } from '@/src/lib/format';
import { colors, useColorTheme } from '@/src/theme';
import { Text } from './Typography';
import { FigmaGradient } from './FigmaGradient';

export function CustomerPhoto({ initials, size = 56, shape = 'circle', showLabel = true }: { initials: string; size?: number; shape?: 'circle' | 'v10'; showLabel?: boolean }) {
  useColorTheme();
  const { user, refresh } = useAuth();
  const photoKey = `${user?.id || ''}:${user?.customer_photo_version || ''}`;
  const [photo, setPhoto] = useState<{ key: string; source: any } | null>(null);
  const source = photo?.key === photoKey ? photo.source : null;
  const setSource = (value: any) => setPhoto(value ? { key: photoKey, source: value } : null);
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; void refresh(); return () => { mounted.current = false; }; }, [refresh]);
  useEffect(() => {
    let active = true;
    if (!user?.customer_photo_version) { setSource(null); return; }
    setSource(null);
    customerProfileApi.photoSource(user.customer_photo_version).then(value => { if (active) setSource(value); }).catch(() => { if (active) setSource(null); });
    return () => { active = false; };
  }, [photoKey]);
  const change = async (camera: boolean) => {
    if (lock.current) return;
    lock.current = true; setChoosing(false); setError('');
    try {
      if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) throw new Error('Tillat kamera i innstillingene for å ta et bilde.');
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const asset = result.assets[0];
      if ((asset.fileSize || 0) > 5 * 1024 * 1024) throw new Error('Bildet kan være maks 5 MB.');
      setBusy(true); setProgress(0);
      const form = new FormData();
      if (Platform.OS === 'web') form.append('file', await (await fetch(asset.uri)).blob(), asset.fileName || 'profile.jpg');
      else form.append('file', { uri: asset.uri, name: asset.fileName || 'profile.jpg', type: asset.mimeType || 'image/jpeg' } as any);
      await customerProfileApi.uploadPhoto(form, value => { if (mounted.current) setProgress(value); });
      await refresh();
    } catch (e) { if (mounted.current) setError(apiError(e)); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  const remove = async () => {
    if (lock.current) return;
    lock.current = true; setChoosing(false); setBusy(true); setError('');
    try { await customerProfileApi.deletePhoto(); setSource(null); await refresh(); }
    catch (e) { if (mounted.current) setError(apiError(e)); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  const avatarStyle = { width: size, height: size, borderRadius: shape === 'v10' ? size * .34 : size / 2 };
  return <View style={{ alignItems: 'center', maxWidth: size + 8, gap: 4 }}>
    <Pressable accessibilityRole="button" accessibilityLabel="Endre profilbilde" testID="profile-photo-edit" disabled={busy} onPress={() => setChoosing(true)}>
      {source ? <Image source={source} style={avatarStyle} onError={() => setSource(null)} /> : shape === 'v10' ? <View style={[avatarStyle, { backgroundColor: colors.cardSubtle, alignItems: 'center', justifyContent: 'center' }]}><Text style={{ color: colors.text, fontSize: size * .36, fontWeight: '600' }}>{initials}</Text></View> : <FigmaGradient colors={['#FF3B3B', '#FF0000']} style={[avatarStyle, { alignItems: 'center', justifyContent: 'center' }]}><Text style={{ color: '#FFFFFF', fontSize: 20 }}>{initials}</Text></FigmaGradient>}
    </Pressable>
    {busy ? <><ActivityIndicator color={colors.accent} /><Text>{progress}%</Text></> : showLabel ? <Text style={{ fontSize: 10, color: colors.textSecondary }}>Endre bilde</Text> : null}
    {error ? <Text testID="profile-photo-error" accessibilityRole="alert" style={{ fontSize: 11, color: colors.danger }}>{error}</Text> : null}
    <Modal visible={choosing} transparent animationType="fade" onRequestClose={() => setChoosing(false)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,31,63,0.4)', justifyContent: 'center', padding: 28 }}>
        <View style={{ padding: 20, borderRadius: 24, backgroundColor: colors.surface, gap: 16 }}>
          <Text>Profilbilde</Text>
          <Pressable testID="profile-photo-camera" onPress={() => void change(true)}><Text>Ta bilde</Text></Pressable>
          <Pressable testID="profile-photo-gallery" onPress={() => void change(false)}><Text>Velg fra galleri</Text></Pressable>
          {user?.customer_photo_version ? <Pressable testID="profile-photo-delete" onPress={() => void remove()}><Text style={{ color: colors.danger }}>Slett bilde</Text></Pressable> : null}
          <Pressable testID="profile-photo-cancel" onPress={() => setChoosing(false)}><Text>Avbryt</Text></Pressable>
        </View>
      </View>
    </Modal>
  </View>;
}
