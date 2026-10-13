import React from 'react';
import { useRouter } from 'expo-router';
import { CustomerProfileDetails } from '@/src/components/CustomerProfileDetails';
export default function CustomerAccessibility() {
  const router = useRouter();
  return <CustomerProfileDetails view="language" onBack={() => router.back()} onDelete={() => router.push('/customer-account')} onSupport={() => router.push('/support')} />;
}
