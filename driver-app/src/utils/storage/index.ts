import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const isSession = (key: string) => key === 'kjapp_token' || key === 'kjapp_driver_token';
const options = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
export const storage = {
  async getItem(key: string): Promise<string | null> {
    if (!isSession(key)) return AsyncStorage.getItem(key);
    const secure = await SecureStore.getItemAsync(key, options);
    if (secure) return secure;
    const legacy = await AsyncStorage.getItem(key);
    if (legacy) {
      // Migrate only after a successful protected write; never fall back to
      // storing a new JWT in plaintext if the native keystore is unavailable.
      await SecureStore.setItemAsync(key, legacy, options);
      await AsyncStorage.removeItem(key);
    }
    return legacy;
  },
  async setItem(key: string, value: string) {
    if (!isSession(key)) return AsyncStorage.setItem(key, value);
    await SecureStore.setItemAsync(key, value, options);
    await AsyncStorage.removeItem(key);
  },
  async removeItem(key: string) {
    if (!isSession(key)) return AsyncStorage.removeItem(key);
    await Promise.all([SecureStore.deleteItemAsync(key, options), AsyncStorage.removeItem(key)]);
  },
};
