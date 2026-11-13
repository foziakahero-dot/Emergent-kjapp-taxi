import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { paymentPreferenceKey, readPaymentPreference, savePaymentPreference, type PaymentChoice } from './paymentPreference';

export function usePaymentPreference(userId?: string) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: paymentPreferenceKey(userId || ''),
    queryFn: () => readPaymentPreference(userId!), enabled: !!userId, staleTime: Infinity });
  const save = async (choice: PaymentChoice) => {
    if (!userId) throw new Error('Logg inn for å lagre betalingsvalget.');
    const confirmed = await savePaymentPreference(userId, choice);
    queryClient.setQueryData(paymentPreferenceKey(userId), confirmed);
    return confirmed;
  };
  return { choice: query.data, pending: query.isPending, failed: query.isError, save };
}

/** A deliberate choice for this booking wins over late preference reads and refetches. */
export function useBookingPaymentChoice(userId?: string) {
  const preferred = usePaymentPreference(userId);
  const [override, setOverride] = useState<{ userId?: string; choice: PaymentChoice } | null>(null);
  const manual = override !== null && override.userId === userId;
  return {
    choice: manual ? override.choice : preferred.choice || 'card',
    ready: manual || (!preferred.pending && !preferred.failed),
    select: (choice: PaymentChoice) => setOverride({ userId, choice }),
    reset: () => setOverride(null),
  };
}
