import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { api } from '@/src/lib/api';
import { storage } from '@/src/utils/storage';

export const DRIVER_LOCATION_TASK = 'kjapp-driver-background-location';
const LAST_BACKGROUND_OFFER_KEY = 'kjapp_last_background_offer';
const LAST_FOREGROUND_OFFER_KEY = 'kjapp_last_foreground_offer';
const LAST_BACKGROUND_PENDING_CHECK_KEY = 'kjapp_last_background_pending_check_at';
export const DRIVER_NATIVE_PUSH_REGISTERED_KEY = 'kjapp_driver_native_push_registered_v1';
let backgroundPermissionRequestedThisSession = false;
let backgroundLocationMode: 'idle' | 'active' | null = null;

try {

Notifications.setNotificationHandler({
  handleNotification: async () => {
    const requestsEnabled = (await storage.getItem('driver_notif_requests')) !== 'false';
    const soundEnabled = (await storage.getItem('driver_req_sound')) !== 'false';
    return {
      shouldPlaySound: requestsEnabled && soundEnabled,
      shouldSetBadge: false,
      shouldShowBanner: requestsEnabled,
      shouldShowList: requestsEnabled,
    };
  },
});
} catch {
  // A notification module error must not crash Driver startup.
}

async function driverNotificationPrefs() {
  const [requests, sound, vibrate] = await Promise.all([
    storage.getItem('driver_notif_requests'),
    storage.getItem('driver_req_sound'),
    storage.getItem('driver_req_vibrate'),
  ]);
  return {
    requests: requests !== 'false',
    sound: sound !== 'false',
    vibrate: vibrate !== 'false',
  };
}

async function ensureDriverNotificationChannels() {
  if (Platform.OS !== 'android') return;
  const common = {
    name: 'SNAR turer',
    description: 'Nye turer og viktige oppdateringer mens du er på skift.',
    importance: Notifications.AndroidImportance.MAX,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  };
  await Promise.all([
    Notifications.setNotificationChannelAsync('kjapp_trips', {
      ...common,
      sound: 'default',
      enableVibrate: true,
      vibrationPattern: [0, 250, 180, 250],
    }),
    Notifications.setNotificationChannelAsync('kjapp_trips_sound', {
      ...common,
      sound: 'default',
      enableVibrate: false,
    }),
    Notifications.setNotificationChannelAsync('kjapp_trips_vibrate', {
      ...common,
      sound: null,
      enableVibrate: true,
      vibrationPattern: [0, 250, 180, 250],
    }),
    Notifications.setNotificationChannelAsync('kjapp_trips_quiet', {
      ...common,
      sound: null,
      enableVibrate: false,
    }),
  ]);
}

function channelForPrefs(sound: boolean, vibrate: boolean) {
  if (sound && vibrate) return 'kjapp_trips';
  if (sound) return 'kjapp_trips_sound';
  if (vibrate) return 'kjapp_trips_vibrate';
  return 'kjapp_trips_quiet';
}

async function scheduleDriverOfferNotification(offer: any, source: 'foreground-poll' | 'background-poll') {
  const prefs = await driverNotificationPrefs();
  if (!prefs.requests || !offer?.trip_id) return false;

  await ensureDriverNotificationChannels();
  const price = Number.isFinite(Number(offer.price)) ? `${Math.round(Number(offer.price))} kr` : 'Ny tur';
  const pickup = offer.pickup_address || 'Henting';
  const dropoff = offer.dropoff_address || 'destinasjon';

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Ny tur · ${price}`,
      body: `${pickup} → ${dropoff}`,
      sound: prefs.sound ? 'default' : undefined,
      ...(Platform.OS === 'android' ? { vibrate: prefs.vibrate ? [0, 250, 180, 250] : [] } : {}),
      data: { url: '/driver', trip_id: offer.trip_id, source },
    },
    trigger: Platform.OS === 'android'
      ? { channelId: channelForPrefs(prefs.sound, prefs.vibrate) }
      : null,
  });
  return true;
}

export async function notifyPendingTripFromForeground(offer: any) {
  if (!offer?.trip_id || Platform.OS === 'web') return false;
  const nativePushRegistered = await storage.getItem(DRIVER_NATIVE_PUSH_REGISTERED_KEY);
  if (nativePushRegistered === 'true') return false;

  const previous = await storage.getItem(LAST_FOREGROUND_OFFER_KEY);
  if (previous === String(offer.trip_id)) return false;

  try {
    const delivered = await scheduleDriverOfferNotification(offer, 'foreground-poll');
    if (delivered) await storage.setItem(LAST_FOREGROUND_OFFER_KEY, String(offer.trip_id));
    return delivered;
  } catch {
    return false;
  }
}

async function notifyPendingTripFromBackground() {
  try {
    const now = Date.now();
    const previousCheck = Number(await storage.getItem(LAST_BACKGROUND_PENDING_CHECK_KEY) || 0);
    if (Number.isFinite(previousCheck) && now - previousCheck < 8000) return;
    await storage.setItem(LAST_BACKGROUND_PENDING_CHECK_KEY, String(now));

    const response = await api.get('/driver/pending');
    const payload = response.data;
    const pending = payload?.trips || payload?.pending || (Array.isArray(payload) ? payload : []);
    const offer = pending?.[0];

    if (!offer?.trip_id) {
      await storage.removeItem(LAST_BACKGROUND_OFFER_KEY);
      return;
    }

    const nativePushRegistered = await storage.getItem(DRIVER_NATIVE_PUSH_REGISTERED_KEY);
    if (nativePushRegistered === 'true') return;

    const previous = await storage.getItem(LAST_BACKGROUND_OFFER_KEY);
    if (previous === String(offer.trip_id)) return;

    const delivered = await scheduleDriverOfferNotification(offer, 'background-poll');
    if (delivered) await storage.setItem(LAST_BACKGROUND_OFFER_KEY, String(offer.trip_id));
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
        speed: Math.max(0, pos.coords.speed || 0),
        recorded_at: new Date(pos.timestamp).toISOString(),
      });
    } catch {
      // Foreground polling will recover on the next active session.
    }
    await notifyPendingTripFromBackground();
  });
}

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

  await ensureDriverNotificationChannels();

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') {
    await storage.setItem(DRIVER_NATIVE_PUSH_REGISTERED_KEY, 'false').catch(() => {});
    return false;
  }

  try {
    const token = await getExpoPushTokenData();
    if (!token) {
      await storage.setItem(DRIVER_NATIVE_PUSH_REGISTERED_KEY, 'false').catch(() => {});
      return false;
    }
    await api.post('/push/native-subscribe', {
      platform: Platform.OS,
      provider: 'expo',
      token,
    });
    await storage.setItem(DRIVER_NATIVE_PUSH_REGISTERED_KEY, 'true').catch(() => {});
    return true;
  } catch {
    await storage.setItem(DRIVER_NATIVE_PUSH_REGISTERED_KEY, 'false').catch(() => {});
    // The app remains usable if push credentials are not provisioned yet.
    // On-shift Driver notifications also have a background-location fallback.
    return false;
  }
}

export async function unregisterNativePush() {
  if (Platform.OS === 'web') return false;
  await storage.setItem(DRIVER_NATIVE_PUSH_REGISTERED_KEY, 'false').catch(() => {});
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

export async function startDriverBackgroundLocation(mode: 'idle' | 'active' = 'idle') {
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

  let running = await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK);
  if (running && backgroundLocationMode !== mode) {
    await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
    running = false;
  }

  if (!running) {
    const activeTrip = mode === 'active';
    await Location.startLocationUpdatesAsync(DRIVER_LOCATION_TASK, {
      accuracy: activeTrip ? Location.Accuracy.BestForNavigation : Location.Accuracy.High,
      activityType: Location.ActivityType.AutomotiveNavigation,
      distanceInterval: activeTrip ? 5 : 50,
      timeInterval: activeTrip ? 3000 : 15000,
      deferredUpdatesDistance: activeTrip ? 10 : 100,
      deferredUpdatesInterval: activeTrip ? 5000 : 30000,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: activeTrip ? 'SNAR Driver · aktiv tur' : 'SNAR Driver er på skift',
        notificationBody: activeTrip
          ? 'Posisjonen deles live under den aktive turen.'
          : 'Posisjonen deles for å motta turer i nærheten.',
        notificationColor: '#00E5F5',
        killServiceOnDestroy: false,
      },
    });
  }
  backgroundLocationMode = mode;

  return { foreground: true, background: true, mode };
}

export async function stopDriverBackgroundLocation() {
  if (Platform.OS === 'web') return;
  const running = await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK);
  if (running) await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
  backgroundLocationMode = null;
  await storage.removeItem(LAST_BACKGROUND_OFFER_KEY);
  await storage.removeItem(LAST_FOREGROUND_OFFER_KEY);
  await storage.removeItem(LAST_BACKGROUND_PENDING_CHECK_KEY);
}

export function normalizeDriverNotificationUrl(url: unknown) {
  if (typeof url !== 'string') return null;
  if (url === '/driver' || url === '/app' || url === '/' || url.startsWith('/driver/trip/')) {
    return '/(driver)/home';
  }
  if (url === '/driver/trip') return '/(driver)/home';
  if (url.startsWith('/driver/trips')) return '/driver-trips';
  if (url.startsWith('/driver/settings')) return '/driver-settings';
  return url;
}
