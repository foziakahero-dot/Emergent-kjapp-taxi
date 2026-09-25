import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { api } from '@/src/lib/api';
import { storage } from '@/src/utils/storage';

const DEVICE_ID_KEY = 'kjapp_native_device_id_v1';
const APP_ROLE = 'customer';
const BUNDLE_ID = 'no.kjapp.app';

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  // Native notification initialization must never terminate app startup.
}

async function getNativeDeviceId() {
  let id = await storage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `${Platform.OS}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    await storage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function serializeNativeToken(nativeToken: Notifications.DevicePushToken) {
  return typeof nativeToken.data === 'string'
    ? nativeToken.data
    : JSON.stringify(nativeToken.data);
}

async function syncNativePushToken(nativeToken: Notifications.DevicePushToken) {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return false;
  const token = serializeNativeToken(nativeToken);
  const deviceId = await getNativeDeviceId();

  await api.post('/push/native-subscribe', {
    platform: Platform.OS,
    provider: Platform.OS === 'android' ? 'fcm' : 'apns',
    token,
    device_id: deviceId,
    app_role: APP_ROLE,
    bundle_id: BUNDLE_ID,
    environment: Platform.OS === 'ios'
      ? (process.env.EXPO_PUBLIC_APNS_ENVIRONMENT === 'development' ? 'development' : 'production')
      : undefined,
  });
  return true;
}

export async function registerNativePush() {
  if (Platform.OS === 'web') return false;

  try {
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

    return await syncNativePushToken(await Notifications.getDevicePushTokenAsync());
  } catch {
    // App remains usable while Firebase/APNs credentials are being provisioned.
    return false;
  }
}

export function listenForNativePushTokenChanges() {
  if (Platform.OS === 'web') return { remove: () => {} };
  return Notifications.addPushTokenListener((nativeToken) => {
    void syncNativePushToken(nativeToken).catch(() => {});
  });
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
