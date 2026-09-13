import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { pushApi } from '@/src/lib/api';

export const TRIP_CHANNEL = 'kjapp_trips';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerDriverNotifications() {
  if (Platform.OS === 'web') return { permission: false, remoteRegistered: false, backendEnabled: false };

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(TRIP_CHANNEL, {
      name: 'Nye KJAPP-turer',
      description: 'Høyprioritetsvarsler når du får tilbud om en ny tur.',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 260, 120, 260, 120, 500],
      lightColor: '#2FE08C',
      sound: 'default',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const permission = current.status === 'granted'
    ? current
    : await Notifications.requestPermissionsAsync();

  if (permission.status !== 'granted') {
    return { permission: false, remoteRegistered: false, backendEnabled: false };
  }

  let backendEnabled = false;
  try {
    const config = await pushApi.nativeConfig();
    backendEnabled = Boolean(config?.enabled);
  } catch {}

  // Current backend sender accepts real FCM registration tokens. On Android,
  // expo-notifications exposes that native FCM token directly.
  let remoteRegistered = false;
  if (Platform.OS === 'android') {
    try {
      const native = await Notifications.getDevicePushTokenAsync();
      const token = typeof native.data === 'string' ? native.data : String(native.data || '');
      if (token) {
        await pushApi.nativeSubscribe('android', token);
        remoteRegistered = true;
      }
    } catch {
      remoteRegistered = false;
    }
  }

  return { permission: true, remoteRegistered, backendEnabled };
}

export async function playIncomingTripAlert(trip: any) {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

  const pickup = trip?.pickup_address || 'Hentested klart';
  const dropoff = trip?.dropoff_address || 'Destinasjon klar';
  const price = Number(trip?.price || 0);
  const body = price > 0
    ? `${pickup} → ${dropoff} · ${Math.round(price)} kr`
    : `${pickup} → ${dropoff}`;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Ny KJAPP-tur',
      body,
      sound: 'default',
      data: { trip_id: trip?.trip_id, kind: 'new_trip' },
      ...(Platform.OS === 'android' ? { priority: Notifications.AndroidNotificationPriority.MAX } : {}),
    },
    trigger: Platform.OS === 'android' ? { channelId: TRIP_CHANNEL } : null,
  }).catch(() => {});
}
