import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';

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
      data: { url: '/driver', trip_id: trip?.trip_id, kind: 'new_trip' },
      ...(Platform.OS === 'android' ? { priority: Notifications.AndroidNotificationPriority.MAX } : {}),
    },
    trigger: Platform.OS === 'android' ? { channelId: 'kjapp_trips' } : null,
  }).catch(() => {});
}
