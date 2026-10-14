import { useSyncExternalStore } from 'react';
import { storage } from '@/src/utils/storage';

export type AccessibilityPreferences = { largeText: boolean; reduceMotion: boolean; highContrast: boolean; voiceSupport: boolean };
export const ACCESSIBILITY_KEY = 'snar_customer_accessibility_v1';
const defaults: AccessibilityPreferences = { largeText: false, reduceMotion: false, highContrast: false, voiceSupport: false };
let snapshot = { ...defaults, ready: false }, loading: Promise<void> | undefined, saving = false;
const listeners = new Set<() => void>();
function publish(next: typeof snapshot) { snapshot = next; listeners.forEach(listener => listener()); }
async function initialize() {
  try {
    const stored = JSON.parse(await storage.getItem(ACCESSIBILITY_KEY) || '{}');
    publish({ largeText: stored.largeText === true, reduceMotion: stored.reduceMotion === true, highContrast: stored.highContrast === true, voiceSupport: stored.voiceSupport === true, ready: true });
  } catch { publish({ ...defaults, ready: true }); }
}
export function subscribeAccessibilityPreferences(listener: () => void) {
  listeners.add(listener);
  if (!loading) loading = initialize();
  return () => { listeners.delete(listener); };
}
export function getAccessibilityPreferences() { return snapshot; }
export function useAccessibilityPreferences() { return useSyncExternalStore(subscribeAccessibilityPreferences, () => snapshot, () => snapshot); }
export async function saveAccessibilityPreference(key: keyof AccessibilityPreferences, value: boolean) {
  if (!snapshot.ready || saving) return false;
  saving = true;
  try {
    const next = { ...snapshot, [key]: value };
    await storage.setItem(ACCESSIBILITY_KEY, JSON.stringify({ largeText: next.largeText, reduceMotion: next.reduceMotion, highContrast: next.highContrast, voiceSupport: next.voiceSupport }));
    publish(next);
    return true;
  } finally { saving = false; }
}
