// Biometric Authentication Runtime Module
// Provides biometric authentication (Face ID/Touch ID/fingerprint) for driver app

import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Check if biometric authentication is available on device
export const isBiometricAuthenticationAvailable = async (): Promise<boolean> => {
  try {
    const { biometricOnly, biometricSet } = await LocalAuthentication.isEnrolledAsync();
    // Return true if any biometric is available (Touch ID, Face ID, or fingerprint)
    return biometricSet || (Platform.OS === 'ios' && biometricOnly);
  } catch (error) {
    console.error('Failed to check biometric availability:', error);
    return false;
  }
};

// Check if biometric authentication is enrolled (user has set up biometrics)
export const isBiometricAuthenticationEnrolled = async (): Promise<boolean> => {
  try {
    const { biometricSet } = await LocalAuthentication.isEnrolledAsync();
    return biometricSet;
  } catch (error) {
    console.error('Failed to check biometric enrollment:', error);
    return false;
  }
};

// Authenticate using biometrics
export const authenticateWithBiometrics = async (options: {
  promptMessage?: string;
  cancelLabel?: string;
  disableFallback?: boolean;
}): Promise<boolean> => {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: options.promptMessage ?? 'Godkjenn med biometri for å få tilgang til KJAPP Driver',
      cancelLabel: options.cancelLabel ?? 'Avbryt',
      disableFallback: options.disableFallback ?? false,
    });
    return result.success;
  } catch (error) {
    console.error('Biometric authentication failed:', error);
    return false;
  }
};

// Generate a secure random token for authentication
export const generateAuthToken = async (length: number = 32): Promise<string> => {
  try {
    const randomBytes = await Crypto.getRandomBytesAsync(length);
    // Convert to hex string
    return Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch (error) {
    console.error('Failed to generate auth token:', error);
    throw error;
  }
};

// Secure token storage helpers
export const storeAuthTokenSecurely = async (token: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync('kjapp_auth_token', token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch (error) {
    console.error('Failed to store auth token securely:', error);
    throw error;
  }
};

export const getAuthTokenSecurely = async (): Promise<string | null> => {
  try {
    const token = await SecureStore.getItemAsync('kjapp_auth_token', {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return token;
  } catch (error) {
    console.error('Failed to get auth token securely:', error);
    return null;
  }
};

export const deleteAuthTokenSecurely = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync('kjapp_auth_token', {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch (error) {
    console.error('Failed to delete auth token securely:', error);
    throw error;
  }
};

// Biometric authentication flow helpers
export const createBiometricAuthFlow = (options: {
  onSuccess: () => void;
  onError: (error: Error) => void;
  onFallback: () => void;
}) => {
  return async () => {
    try {
      const isAvailable = await isBiometricAuthenticationAvailable();
      if (!isAvailable) {
        throw new Error('Biometric authentication not available on this device');
      }

      const isEnrolled = await isBiometricAuthenticationEnrolled();
      if (!isEnrolled) {
        throw new Error('Biometric authentication not enrolled');
      }

      const success = await authenticateWithBiometrics({
        promptMessage: 'Godkjenn med biometri for å få tilgang til KJAPP Driver',
        cancelLabel: 'Avbryt',
      });

      if (success) {
        options.onSuccess();
      } else {
        // User canceled or failed biometric auth
        options.onFallback();
      }
    } catch (error) {
      console.error('Biometric auth flow error:', error);
      options.onError(error);
    }
  };
};

// Check if device supports biometric authentication (hardware level)
export const isBiometricSensorSupported = async (): Promise<boolean> => {
  try {
    // This is a simplified check - in practice, you might want to check specific hardware
    const isAvailable = await isBiometricAuthenticationAvailable();
    return isAvailable;
  } catch (error) {
    console.error('Failed to check biometric sensor support:', error);
    return false;
  }
};