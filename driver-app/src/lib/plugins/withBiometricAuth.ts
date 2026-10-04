// Biometric Authentication Plugin Configuration
// This plugin configures expo-local-authentication, expo-crypto, and expo-secure-store

import { ExpoConfig, ConfigPlugin, WarningAggregator } from '@expo/config-plugins';
import { Platform } from 'react-native';

const withBiometricAuth: ConfigPlugin<{
  faceIDPermission?: string;
  touchIdPermission?: string;
}> = (config, {
  faceIDPermission = 'La KJAPP Driver bruke Face ID for sikker pålogging',
  touchIdPermission = 'La KJAPP Driver bruke Touch ID for sikker pålogging',
} = {}) => {
  config = withIosBiometricAuth(config, {
    faceIDPermission,
    touchIdPermission,
  });
  config = withAndroidBiometricAuth(config, {});
  return config;
};

const withIosBiometricAuth = (
  config: ExpoConfig,
  {
    faceIDPermission,
    touchIdPermission,
  }: {
    faceIDPermission: string;
    touchIdPermission: string;
  }
): ExpoConfig => {
  if (Platform.OS !== 'ios') {
    return config;
  }

  // Add Face ID/Touch ID usage description
  if (!config.ios) {
    config.ios = {};
  }
  if (!config.ios.infoPlist) {
    config.ios.infoPlist = {};
  }

  // For iOS, we use NSFaceIDUsageDescription or NSTouchIDUsageDescription
  // Depending on what biometric types we want to support
  config.ios.infoPlist.NSFaceIDUsageDescription = faceIDPermission;
  config.ios.infoPlist.NSTouchIDUsageDescription = touchIdPermission;

  WarningAggregator.addWarningIOS(
    'biometric-auth',
    'Biometric authentication requires proper configuration of Face ID/Touch ID usage descriptions.'
  );

  return config;
};

const withAndroidBiometricAuth = (
  config: ExpoConfig,
  {}: {}
): ExpoConfig => {
  if (Platform.OS !== 'android') {
    return config;
  }

  // Add biometric permission
  if (!config.android) {
    config.android = {};
  }
  if (!config.android.permissions) {
    config.android.permissions = [];
  }

  const permissions = config.android.permissions as string[];
  if (!permissions.includes('USE_BIOMETRIC')) {
    permissions.push('USE_BIOMETRIC');
  }
  if (!permissions.includes('USE_FINGERPRINT')) {
    permissions.push('USE_FINGERPRINT');
  }

  config.android.permissions = [...new Set(permissions)];

  WarningAggregator.addWarningAndroid(
    'biometric-auth',
    'Biometric authentication on Android requires USE_BIOMETRIC permission. ' +
      'Make sure to handle biometric authentication properly in your app code.'
  );

  return config;
};

export default withBiometricAuth;