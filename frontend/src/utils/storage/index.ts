import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SECURE_KEYS = new Set(['kjapp_token']);

async function getSecureItem(key: string) {
  if (Platform.OS === 'web') return AsyncStorage.getItem(key);

  const secure = await SecureStore.getItemAsync(key);
  if (secure != null) return secure;

  // One-time migration for existing beta installs.
  const legacy = await AsyncStorage.getItem(key);
  if (legacy != null) {
    await SecureStore.setItemAsync(key, legacy, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    await AsyncStorage.removeItem(key);
  }
  return legacy;
}

async function setSecureItem(key: string, value: string) {
  if (Platform.OS === 'web') return AsyncStorage.setItem(key, value);
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  // Remove any legacy plaintext copy.
  await AsyncStorage.removeItem(key);
}

async function removeSecureItem(key: string) {
  if (Platform.OS === 'web') return AsyncStorage.removeItem(key);
  await SecureStore.deleteItemAsync(key);
  await AsyncStorage.removeItem(key);
}

export const storage = {
  getItem: (key: string) => SECURE_KEYS.has(key) ? getSecureItem(key) : AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => SECURE_KEYS.has(key) ? setSecureItem(key, value) : AsyncStorage.setItem(key, value),
  removeItem: (key: string) => SECURE_KEYS.has(key) ? removeSecureItem(key) : AsyncStorage.removeItem(key),
};
