import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CustomerSupport } from '@/src/components/CustomerSupport';
export default function CustomerSupportChat() {
  const router = useRouter();
  const params = useLocalSearchParams<{ topic?: string; tripId?: string }>();
  const topic = typeof params.topic === 'string' ? params.topic.slice(0, 200) : '';
  const tripId = typeof params.tripId === 'string' ? params.tripId.slice(0, 100) : '';
  const initialMessage = [topic, tripId ? `Turreferanse: ${tripId}` : ''].filter(Boolean).join('\n');
  return <CustomerSupport initialMessage={initialMessage} onBack={() => router.back()} />;
}
