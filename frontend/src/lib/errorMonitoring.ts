import Constants from 'expo-constants';
import { Platform } from 'react-native';

const BACKEND = (process.env.EXPO_PUBLIC_BACKEND_URL || 'https://github-app-builder-28.emergent.host').replace(/\/$/, '');
let installed = false;

async function report(error: any, isFatal: boolean) {
  try {
    await fetch(`${BACKEND}/api/client-errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app: 'customer',
        message: String(error?.message || error || 'Unknown customer error').slice(0, 1200),
        stack: String(error?.stack || '').slice(0, 12000),
        is_fatal: !!isFatal,
        platform: Platform.OS,
        version: [Constants.expoConfig?.version || 'unknown', Constants.nativeBuildVersion].filter(Boolean).join(' (' ) + (Constants.nativeBuildVersion ? ')' : ''),
      }),
    });
  } catch {
    // Error reporting must never create a second crash.
  }
}

export function installClientErrorMonitor() {
  if (installed) return () => {};
  const g = globalThis as any;
  const errorUtils = g.ErrorUtils;
  if (!errorUtils?.getGlobalHandler || !errorUtils?.setGlobalHandler) return () => {};

  const previous = errorUtils.getGlobalHandler();
  const handler = (error: any, isFatal?: boolean) => {
    void report(error, !!isFatal);
    if (typeof previous === 'function') previous(error, isFatal);
  };

  errorUtils.setGlobalHandler(handler);
  installed = true;

  return () => {
    if (errorUtils.getGlobalHandler?.() === handler) errorUtils.setGlobalHandler(previous);
    installed = false;
  };
}
