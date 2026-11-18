import { storage } from '@/src/utils/storage';

export type PaymentChoice = 'card' | 'cash';
export const paymentPreferenceKey = (userId: string) => ['preferred-payment', userId] as const;
const storageKey = (userId: string) => `snar_payment_preference_v1:${encodeURIComponent(userId)}`;

/** Device preference only. Availability and actual payment remain server-controlled. */
export async function readPaymentPreference(userId: string): Promise<PaymentChoice> {
  const value = await storage.getItem(storageKey(userId));
  return value === 'cash' ? 'cash' : 'card';
}

export async function savePaymentPreference(userId: string, choice: PaymentChoice) {
  if (!userId || (choice !== 'card' && choice !== 'cash')) throw new Error('Ugyldig betalingsvalg.');
  await storage.setItem(storageKey(userId), choice);
  return choice;
}
