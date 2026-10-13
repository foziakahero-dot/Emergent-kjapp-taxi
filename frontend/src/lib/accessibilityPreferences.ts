import { useSyncExternalStore } from 'react';
import { storage } from '@/src/utils/storage';

export type AccessibilityPreferences = { largeText: boolean; reduceMotion: boolean };
export const ACCESSIBILITY_KEY = 'snar_customer_accessibility_v1';
const defaults: AccessibilityPreferences = { largeText: false, reduceMotion: false };
let snapshot = { ...defaults, ready: false }, loading: Promise<void> | undefined, saving = false;
const listeners = new Set<() => void>();
function publish(next: typeof snapshot) { snapshot = next; listeners.forEach(listener => listener()); }
async function initialize() {
  try {
    const stored = JSON.parse(await storage.getItem(ACCESSIBILITY_KEY) || '{}');
    publish({ largeText: stored.largeText === true, reduceMotion: stored.reduceMotion === true, ready: true });
  } catch { publish({ ...defaults, ready: true }); }
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!loading) loading = initialize();
  return () => { listeners.delete(listener); };
}
export function useAccessibilityPreferences() { return useSyncExternalStore(subscribe, () => snapshot, () => snapshot); }
export async function saveAccessibilityPreference(key: keyof AccessibilityPreferences, value: boolean) {
  if (!snapshot.ready || saving) return false;
  saving = true;
  try {
    const next = { ...snapshot, [key]: value };
    await storage.setItem(ACCESSIBILITY_KEY, JSON.stringify({ largeText: next.largeText, reduceMotion: next.reduceMotion }));
    publish(next);
    return true;
  } finally { saving = false; }
}
