import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { api } from '@/src/lib/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function getExpoPushTokenData() {
  const projectId =
    (Constants as any)?.expoConfig?.extra?.eas?.projectId ||
    (Constants as any)?.easConfig?.projectId;
  if (!projectId) return null;
  const expoToken = await Notifications.getExpoPushTokenAsync({ projectId });
  return expoToken.data || null;
}

export async function registerNativePush() {
  if (Platform.OS === 'web') return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('kjapp_trips', {
      name: 'KJAPP turer',
      description: 'Oppdateringer om bestilling, sjåfør og tur.',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 220, 160, 220],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return false;

  try {
    const token = await getExpoPushTokenData();
    if (!token) return false;
    await api.post('/push/native-subscribe', {
      platform: Platform.OS,
      provider: 'expo',
      token,
    });
    return true;
  } catch {
    return false;
  }
}

export async function unregisterNativePush() {
  if (Platform.OS === 'web') return false;
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (permission.status !== 'granted') return false;
    const token = await getExpoPushTokenData();
    if (!token) return false;
    await api.post('/push/native-unsubscribe', {
      platform: Platform.OS,
      provider: 'expo',
      token,
    });
    return true;
  } catch {
    return false;
  }
}

export function normalizeCustomerNotificationUrl(url: unknown) {
  if (typeof url !== 'string') return null;
  const normalized = url.startsWith('/app/') ? url.slice(4) : url;
  if (normalized === '/app' || normalized === '/' || normalized === '/home') return '/(app)/home';
  if (normalized.startsWith('/trips/') || normalized.startsWith('/booking/')) {
    const id = normalized.split('/').filter(Boolean).pop();
    return id ? `/booking/${id}` : '/(app)/home';
  }
  if (normalized.startsWith('/receipt/')) {
    const id = normalized.split('/').filter(Boolean).pop();
    return id ? `/receipt/${id}` : '/(app)/home';
  }
  return normalized;
}
