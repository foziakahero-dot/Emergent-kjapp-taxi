// Enhanced Notifications Runtime Module
// Provides enhanced notification capabilities for both driver and customer apps

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Request notification permissions
export const requestNotificationPermissions = async (): Promise<boolean> => {
  if (!Device.isDevice) {
    // On web or simulator, we can't register for push notifications
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus === 'granted';
};

// Check if notification permissions are granted
export const hasNotificationPermissions = async (): Promise<boolean> => {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
};

// Get device push token for remote notifications
export const getDevicePushToken = async (): Promise<string | null> => {
  try {
    if (!Device.isDevice) {
      return null;
    }

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'your-project-id', // Replace with actual project ID or make configurable
    });
    return tokenData.data;
  } catch (error) {
    console.error('Failed to get expo push token:', error);
    return null;
  }
};

// Schedule a local notification
export const scheduleNotification = async (
  content: {
    title: string;
    body?: string;
    data?: Record<string, unknown>;
  },
  trigger: Notifications.InputTrigger
): Promise<string> => {
  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: content.title,
        body: content.body,
        data: content.data,
      },
      trigger,
    });
    return identifier;
  } catch (error) {
    console.error('Failed to schedule notification:', error);
    throw error;
  }
};

// Show an immediate notification
export const showNotification = async (
  content: {
    title: string;
    body?: string;
    data?: Record<string, unknown>;
  }
): Promise<string> => {
  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: content.title,
        body: content.body,
        data: content.data,
      },
      trigger: null, // Show immediately
    });
    return identifier;
  } catch (error) {
    console.error('Failed to show notification:', error);
    throw error;
  }
};

// Cancel a scheduled notification
export const cancelNotification = async (identifier: string): Promise<void> => {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch (error) {
    console.error('Failed to cancel notification:', error);
    throw error;
  }
};

// Cancel all scheduled notifications
export const cancelAllNotifications = async (): Promise<void> => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Failed to cancel all notifications:', error);
    throw error;
  }
};

// Create a trip-specific notification
export const createTripNotification = (
  tripData: {
    passengerName?: string;
    driverName?: string;
    pickupLocation?: string;
    dropoffLocation?: string;
    tripId?: string;
    eta?: number; // in seconds
    status?: string; // e.g., 'driver_arriving', 'trip_started', 'trip_completed'
  },
  notificationType: string
): Notifications.NotificationContent => {
  let title = '';
  let body = '';

  switch (notificationType) {
    case 'driver_assigned':
      title = 'Sjåfør tilordnet';
      body = `En sjåfør har blitt tilordnet turen din.`;
      break;
    case 'driver_arriving':
      title = 'Sjåføren nærmer seg';
      body = tripData.passengerName
        ? `Sjåføren ${tripData.driverName} nærmer seg hentepunktet.`
        : 'Sjåføren nærmer seg.';
      break;
    case 'trip_started':
      title = 'Turen har startet';
      body = 'Du er nå på vei til destinasjonen.';
      break;
    case 'trip_completed':
      title = 'Turen er fullført';
      body = 'Takk for at du valgte KJAPP!';
      break;
    case 'payment_received':
      title = 'Betaling mottatt';
      body = 'Betalingen for turen din er behandlet.';
      break;
    case 'trip_cancelled':
      title = 'Turen avbrutt';
      body = tripData.passengerName
        ? 'Turen din har blitt avbrutt av sjåføren.'
        : 'Turen har blitt avbrutt.';
      break;
    case 'new_request':
      title = 'Ny turforespørsel';
      body = 'Du har mottatt en ny turforespørsel.';
      break;
    default:
      title = 'KJAPP Varsel';
      body = 'Du har mottatt et varsel fra KJAPP.';
  }

  return {
    title,
    body: body || '',
    data: tripData,
  };
};

// Format time duration for notifications
export const formatTimeDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}t`);
  if (minutes > 0) parts.push(`${minutes}min`);
  if (remainingSeconds > 0 || parts.length === 0) parts.push(`${remainingSeconds}sek`);

  return parts.join(' ');
};

// Set up notification handler for when app is in foreground
export const setNotificationHandler = (
  callback: (notification: Notifications.Notification) => void
): Notifications.Subscription => {
  return Notifications.addNotificationReceivedListener(callback);
};

// Set up notification response handler (when user taps on notification)
export const setNotificationResponseHandler = (
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription => {
  return Notifications.addNotificationResponseReceivedListener(callback);
};

// Create a notification channel (Android only)
export const createNotificationChannel = async (
  channelId: string,
  name: string,
  description: string,
  importance: Notifications.NotificationImportance = Notifications.NotificationImportance.Default
): Promise<void> => {
  if (Platform.OS === 'android') {
    try {
      await Notifications.createChannelAndroidAsync({
        id: channelId,
        name,
        description,
        importance,
      });
    } catch (error) {
      console.warn('Failed to create notification channel:', error);
    }
  }
};

// Check if device is enabled for notifications
export const isDeviceEnabledForNotifications = async (): Promise<boolean> => {
  const { isEnabled } = await Notifications.isDevicePushNotificationEnabledAsync();
  return isEnabled;
};