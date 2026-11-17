import { useSyncExternalStore } from 'react';
import { storage } from '@/src/utils/storage';

export type CustomerLanguage = 'nb' | 'en';
export const CUSTOMER_LANGUAGE_KEY = 'snar_customer_language_v1';
let snapshot: { language: CustomerLanguage; ready: boolean } = { language: 'nb', ready: false };
let loading: Promise<void> | undefined;
let saving = false;
const listeners = new Set<() => void>();
function publish(next: typeof snapshot) { snapshot = next; listeners.forEach(listener => listener()); }
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!loading) loading = storage.getItem(CUSTOMER_LANGUAGE_KEY)
    .then(value => publish({ language: value === 'en' ? 'en' : 'nb', ready: true }))
    .catch(() => publish({ language: 'nb', ready: true }));
  return () => { listeners.delete(listener); };
}
export function useCustomerLanguage() { return useSyncExternalStore(subscribe, () => snapshot, () => snapshot); }
export async function saveCustomerLanguage(language: CustomerLanguage) {
  if (!snapshot.ready || saving || !['nb', 'en'].includes(language)) return false;
  saving = true;
  try {
    await storage.setItem(CUSTOMER_LANGUAGE_KEY, language);
    publish({ language, ready: true });
    return true;
  } finally { saving = false; }
}

// Explicit UI copy only: user names, addresses, messages and API payloads are
// never looked up or translated by the shared Typography component.
import { customerEnglish } from './customerEnglish';
export function useTranslation() {
  const { language, ready } = useCustomerLanguage();
  const t = (norwegian: string) => language === 'en' ? customerEnglish[norwegian] ?? norwegian : norwegian;
  return { language, ready, t };
}
