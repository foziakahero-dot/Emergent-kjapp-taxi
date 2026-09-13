import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { api } from '@/src/lib/api';

export const DRIVER_LOCATION_TASK = 'kjapp-driver-background-location';
let backgroundPermissionRequestedThisSession = false;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

if (!TaskManager.isTaskDefined(DRIVER_LOCATION_TASK)) {
  TaskManager.defineTask(DRIVER_LOCATION_TASK, async ({ data, error }: any) => {
    if (error || !data?.locations?.length) return;
    const pos = data.locations[data.locations.length - 1];
    try {
      await api.post('/driver/location', {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        heading: pos.coords.heading || 0,
        speed: pos.coords.speed || 0,
      });
    } catch {
      // Foreground polling will recover on the next active session.
    }
  });
}

export async function registerNativePush() {
  if (Platform.OS === 'web') return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('kjapp_trips', {
      name: 'KJAPP turer',
      description: 'Nye turer og viktige oppdateringer mens du er på skift.',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 180, 250],
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

export async function startDriverBackgroundLocation() {
  if (Platform.OS === 'web') return { foreground: false, background: false };

  const foregroundCurrent = await Location.getForegroundPermissionsAsync();
  const foreground = foregroundCurrent.status === 'granted'
    ? foregroundCurrent
    : await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    return { foreground: false, background: false };
  }

  let background = await Location.getBackgroundPermissionsAsync();
  if (background.status !== 'granted' && !backgroundPermissionRequestedThisSession) {
    backgroundPermissionRequestedThisSession = true;
    background = await Location.requestBackgroundPermissionsAsync();
  }
  if (background.status !== 'granted') {
    return { foreground: true, background: false };
  }

  const running = await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK);
  if (!running) {
    await Location.startLocationUpdatesAsync(DRIVER_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      distanceInterval: 15,
      timeInterval: 6000,
      deferredUpdatesDistance: 30,
      deferredUpdatesInterval: 12000,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'KJAPP Driver er på skift',
        notificationBody: 'Posisjonen deles for å motta og gjennomføre turer.',
        notificationColor: '#00E5F5',
        killServiceOnDestroy: false,
      },
    });
  }

  return { foreground: true, background: true };
}

export async function stopDriverBackgroundLocation() {
  if (Platform.OS === 'web') return;
  const running = await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK);
  if (running) await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
}

export function normalizeDriverNotificationUrl(url: unknown) {
  if (typeof url !== 'string') return null;
  if (url === '/driver' || url === '/app' || url === '/') return '/(driver)/home';
  if (url.startsWith('/driver/trips')) return '/driver-trips';
  if (url.startsWith('/driver/settings')) return '/driver-settings';
  return url;
}
