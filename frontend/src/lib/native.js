// Native bridge for Capacitor.
// Falls back to web APIs automatically when not running inside a native app.

import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { Geolocation } from "@capacitor/geolocation";
import { PushNotifications } from "@capacitor/push-notifications";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Device } from "@capacitor/device";
import { Preferences } from "@capacitor/preferences";
import { pushApi } from "./api";

export const isNative = () => Capacitor.isNativePlatform();
export const platform = () => Capacitor.getPlatform(); // "ios" | "android" | "web"

/**
 * Configure status bar + hide splash on native boot.
 */
export async function initNativeShell() {
  if (!isNative()) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#0a1220" });
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch (e) { /* ignore */ }
  try {
    await SplashScreen.hide({ fadeOutDuration: 300 });
  } catch (e) { /* ignore */ }
  // Back button handler on Android → mimic browser back
  try {
    App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) window.history.back();
      else App.exitApp();
    });
  } catch (e) { /* ignore */ }
}

/**
 * Ask for location permission (native only).
 */
export async function ensureLocationPermission() {
  if (!isNative()) return true;
  try {
    const cur = await Geolocation.checkPermissions();
    if (cur.location === "granted") return true;
    const req = await Geolocation.requestPermissions({ permissions: ["location", "coarseLocation"] });
    return req.location === "granted";
  } catch (e) {
    return false;
  }
}

/**
 * Isomorf watchPosition. Returns a { clear } handle.
 * On native, uses Capacitor Geolocation (works in background on iOS with Background Modes / on Android with foreground service).
 * On web, uses navigator.geolocation.watchPosition.
 */
export async function watchLocation(onPosition, onError) {
  if (isNative()) {
    const granted = await ensureLocationPermission();
    if (!granted) {
      onError?.({ message: "Lokasjon avslått" });
      return { clear: () => {} };
    }
    let watchId = null;
    try {
      watchId = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 },
        (pos, err) => {
          if (err) { onError?.(err); return; }
          if (!pos) return;
          onPosition({
            coords: {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              heading: pos.coords.heading || 0,
              speed: pos.coords.speed || 0,
              accuracy: pos.coords.accuracy || 0,
            },
          });
        },
      );
    } catch (e) {
      onError?.(e);
    }
    return {
      clear: async () => {
        if (watchId) { try { await Geolocation.clearWatch({ id: watchId }); } catch { /* ignore */ } }
      },
    };
  }

  // Web fallback
  if (!navigator.geolocation) {
    onError?.({ message: "Nettleseren støtter ikke GPS" });
    return { clear: () => {} };
  }
  const id = navigator.geolocation.watchPosition(
    onPosition,
    onError,
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 },
  );
  return { clear: () => navigator.geolocation.clearWatch(id) };
}

/**
 * Register for native push notifications and send token to backend.
 */
export async function registerNativePush() {
  if (!isNative()) return { ok: false, reason: "not-native" };
  try {
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive !== "granted") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") return { ok: false, reason: "denied" };

    // High-importance channel so ride requests wake the screen and ring on Android 8+
    if (platform() === "android") {
      try {
        await PushNotifications.createChannel({
          id: "kjapp_trips",
          name: "Turforespørsler",
          description: "Nye turer og oppdateringer for sjåfører",
          importance: 5,
          visibility: 1,
          sound: "default",
          vibration: true,
          lights: true,
        });
      } catch { /* channel already exists */ }
    }

    return await new Promise((resolve) => {
      const onReg = PushNotifications.addListener("registration", async (token) => {
        try {
          const info = await Device.getId();
          await pushApi.nativeSubscribe(platform(), token.value, info?.identifier);
          resolve({ ok: true, token: token.value });
        } catch (e) {
          resolve({ ok: false, reason: String(e) });
        } finally {
          onReg.then((h) => h.remove?.());
        }
      });
      PushNotifications.addListener("registrationError", (err) => {
        resolve({ ok: false, reason: err?.error || "reg-error" });
      });
      PushNotifications.register();
    });
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
}

export async function pushListenForeground(onNotification) {
  if (!isNative()) return;
  try {
    await PushNotifications.addListener("pushNotificationReceived", onNotification);
    await PushNotifications.addListener("pushNotificationActionPerformed", (act) => {
      // Nav to URL if present
      const url = act?.notification?.data?.url;
      if (url) window.location.href = url;
    });
  } catch (e) { /* ignore */ }
}

/**
 * Small haptic feedback (button press, trip accepted, etc).
 */
export async function haptic(kind = "light") {
  if (!isNative()) return;
  try {
    const style = kind === "heavy" ? ImpactStyle.Heavy : kind === "medium" ? ImpactStyle.Medium : ImpactStyle.Light;
    await Haptics.impact({ style });
  } catch (e) { /* ignore */ }
}

/**
 * Native-safe preferences (falls back to localStorage on web).
 */
export const nativeStore = {
  async get(key) {
    if (isNative()) {
      const r = await Preferences.get({ key });
      return r.value;
    }
    return localStorage.getItem(key);
  },
  async set(key, value) {
    if (isNative()) return Preferences.set({ key, value: String(value) });
    localStorage.setItem(key, String(value));
  },
  async remove(key) {
    if (isNative()) return Preferences.remove({ key });
    localStorage.removeItem(key);
  },
};

export async function getDeviceInfo() {
  try {
    const info = await Device.getInfo();
    const id = await Device.getId();
    return { ...info, id: id.identifier };
  } catch (e) {
    return { platform: "web" };
  }
}
