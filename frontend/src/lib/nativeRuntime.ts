import { Platform } from 'react-native';
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

  const nativeToken = await Notifications.getDevicePushTokenAsync();
  const token = typeof nativeToken.data === 'string'
    ? nativeToken.data
    : JSON.stringify(nativeToken.data);

  await api.post('/push/native-subscribe', {
    platform: Platform.OS,
    token,
  });
  return true;
}

export function normalizeCustomerNotificationUrl(url: unknown) {
  if (typeof url !== 'string') return null;
  if (url === '/app' || url === '/' || url === '/home') return '/(app)/home';
  if (url.startsWith('/trips/') || url.startsWith('/booking/')) {
    const id = url.split('/').filter(Boolean).pop();
    return id ? `/booking/${id}` : '/(app)/home';
  }
  return url;
}
