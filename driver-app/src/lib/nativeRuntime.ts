import { AppState, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { api } from '@/src/lib/api';
import { storage } from '@/src/utils/storage';

export const DRIVER_LOCATION_TASK = 'kjapp-driver-background-location';
const LAST_BACKGROUND_OFFER_KEY = 'kjapp_last_background_offer';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function notifyPendingTripFromBackground() {
  try {
    const response = await api.get('/driver/pending');
    const payload = response.data;
    const pending = payload?.trips || payload?.pending || (Array.isArray(payload) ? payload : []);
    const offer = pending?.[0];

    if (!offer?.trip_id) {
      await storage.removeItem(LAST_BACKGROUND_OFFER_KEY);
      return;
    }

    const previous = await storage.getItem(LAST_BACKGROUND_OFFER_KEY);
    if (previous === String(offer.trip_id)) return;

    const price = Number.isFinite(Number(offer.price)) ? `${Math.round(Number(offer.price))} kr` : 'Ny tur';
    const pickup = offer.pickup_address || 'Henting';
    const dropoff = offer.dropoff_address || 'destinasjon';

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Ny tur · ${price}`,
        body: `${pickup} → ${dropoff}`,
        sound: true,
        data: { url: '/driver', trip_id: offer.trip_id, source: 'background-poll' },
      },
      trigger: null,
    });
    await storage.setItem(LAST_BACKGROUND_OFFER_KEY, String(offer.trip_id));
  } catch {
    // Native FCM/APNs remains the primary channel. This is an on-shift fallback.
  }
}

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
      // Foreground/SSE recovery handles the next active session.
    }
    await notifyPendingTripFromBackground();
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

  try {
    const nativeToken = await Notifications.getDevicePushTokenAsync();
    const token = typeof nativeToken.data === 'string'
      ? nativeToken.data
      : JSON.stringify(nativeToken.data);

    await api.post('/push/native-subscribe', {
      platform: Platform.OS,
      token,
    });
    return true;
  } catch {
    // Appen skal fungere selv om FCM/APNs-credentials ikke er provisionert ennå.
    return false;
  }
}

export async function getDriverLocationPermissionState() {
  if (Platform.OS === 'web') return { foreground: false, background: false };
  const [foreground, background] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
  ]);
  return {
    foreground: foreground.status === 'granted',
    background: background.status === 'granted',
  };
}

export async function requestDriverForegroundLocationPermission() {
  if (Platform.OS === 'web') return false;
  const current = await Location.getForegroundPermissionsAsync();
  if (current.status === 'granted') return true;
  const result = await Location.requestForegroundPermissionsAsync();
  return result.status === 'granted';
}

export async function requestDriverBackgroundLocationPermission() {
  if (Platform.OS === 'web') return false;
  const foreground = await Location.getForegroundPermissionsAsync();
  if (foreground.status !== 'granted') return false;
  const current = await Location.getBackgroundPermissionsAsync();
  if (current.status === 'granted') return true;
  const result = await Location.requestBackgroundPermissionsAsync();
  return result.status === 'granted';
}

export async function startDriverBackgroundLocation() {
  if (Platform.OS === 'web') return { foreground: false, background: false, started: false };

  const permissions = await getDriverLocationPermissionState();
  if (!permissions.foreground || !permissions.background) {
    return { ...permissions, started: false };
  }

  // Android kan kaste fatal SecurityException hvis en location FGS bindes akkurat idet
  // appen mister foreground eligibility. Start derfor bare fra aktiv app-prosess.
  if (Platform.OS === 'android' && AppState.currentState !== 'active') {
    return { ...permissions, started: false };
  }

  const running = await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK);
  if (!running) {
    await Location.startLocationUpdatesAsync(DRIVER_LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      activityType: Location.ActivityType.AutomotiveNavigation,
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

  return { ...permissions, started: true };
}

export async function stopDriverBackgroundLocation() {
  if (Platform.OS === 'web') return;
  const running = await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK);
  if (running) await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
  await storage.removeItem(LAST_BACKGROUND_OFFER_KEY);
}

export function normalizeDriverNotificationUrl(url: unknown) {
  if (typeof url !== 'string') return null;
  if (url === '/driver' || url === '/app' || url === '/') return '/(driver)/home';
  if (url.startsWith('/driver/trips')) return '/driver-trips';
  if (url.startsWith('/driver/settings')) return '/driver-settings';
  return url;
}
