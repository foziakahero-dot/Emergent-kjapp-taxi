import { Alert, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { api } from '@/src/lib/api';
import { storage } from '@/src/utils/storage';

export const DRIVER_LOCATION_TASK = 'kjapp-driver-background-location';
const LAST_BACKGROUND_OFFER_KEY = 'kjapp_last_background_offer';
const BACKGROUND_LOCATION_EXPLAINED_KEY = 'kjapp_background_location_explained';
let backgroundPermissionRequestedThisSession = false;

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
      // Foreground polling will recover on the next active session.
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
    // The app remains usable if FCM/APNs credentials are not provisioned yet.
    // On-shift Driver notifications also have a background-location fallback.
    return false;
  }
}

async function explainBackgroundLocationOnce(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const alreadyExplained = await storage.getItem(BACKGROUND_LOCATION_EXPLAINED_KEY);
  if (alreadyExplained === '1') return true;

  const accepted = await new Promise<boolean>((resolve) => {
    Alert.alert(
      'Tillat posisjon i bakgrunnen',
      'Når du er ONLINE må KJAPP kunne dele posisjonen din mens skjermen er låst eller appen ligger i bakgrunnen. Dette brukes bare mens du er på skift, slik at du kan motta turer og kunden kan få korrekt henteposisjon.',
      [
        { text: 'Ikke nå', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Fortsett', onPress: () => resolve(true) },
      ],
      { cancelable: false },
    );
  });

  if (accepted) await storage.setItem(BACKGROUND_LOCATION_EXPLAINED_KEY, '1');
  return accepted;
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
    const mayContinue = await explainBackgroundLocationOnce();
    if (!mayContinue) return { foreground: true, background: false };
    backgroundPermissionRequestedThisSession = true;
    background = await Location.requestBackgroundPermissionsAsync();
  }
  if (background.status !== 'granted') {
    return { foreground: true, background: false };
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

  return { foreground: true, background: true };
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
