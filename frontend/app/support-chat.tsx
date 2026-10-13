import React from 'react';
import { useRouter } from 'expo-router';
import { CustomerSupport } from '@/src/components/CustomerSupport';
export default function CustomerSupportChat() {
  const router = useRouter();
  return <CustomerSupport onBack={() => router.back()} />;
}
