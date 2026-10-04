// Background Location Tracking Plugin Configuration
// This plugin configures expo-location for background tracking

import { ExpoConfig, ConfigPlugin, WarningAggregator } from '@expo/config-plugins';
import { Platform } from 'react-native';

const withBackgroundLocation: ConfigPlugin<{
  locationWhenInUsePermission?: string;
  locationAlwaysPermission?: string;
  iosBackgroundModes?: Array<'location' | 'audio' | 'location'>;
  androidForegroundServiceLocationType?: 'location' | 'mediaProjection' | 'mediaPlayback';
}> = (config, {
  locationWhenInUsePermission = 'KJAPP Driver bruker posisjonen din for å finne turer i nærheten.',
  locationAlwaysPermission = 'KJAPP Driver bruker posisjonen din under aktive skift og turer.',
  iosBackgroundModes = ['location'],
  androidForegroundServiceLocationType = 'location',
} = {}) => {
  config = withIosBackgroundLocation(config, {
    locationWhenInUsePermission,
    locationAlwaysPermission,
    iosBackgroundModes,
  });
  config = withAndroidBackgroundLocation(config, {
    androidForegroundServiceLocationType,
  });
  return config;
};

const withIosBackgroundLocation = (
  config: ExpoConfig,
  {
    locationWhenInUsePermission,
    locationAlwaysPermission,
    iosBackgroundModes,
  }: {
    locationWhenInUsePermission: string;
    locationAlwaysPermission: string;
    iosBackgroundModes: Array<'location' | 'audio' | 'location'>;
  }
): ExpoConfig => {
  if (Platform.OS !== 'ios') {
    return config;
  }

  // Add background location permissions
  if (!config.ios) {
    config.ios = {};
  }
  if (!config.ios.infoPlist) {
    config.ios.infoPlist = {};
  }

  config.ios.infoPlist.NSLocationWhenInUseUsageDescription =
    locationWhenInUsePermission;
  config.ios.infoPlist.NSLocationAlwaysAndWhenInUseUsageDescription =
    locationAlwaysPermission;

  // Configure background modes
  config.ios.infoPlist.UIBackgroundModes = [
    ...(config.ios.infoPlist.UIBackgroundModes || []),
    ...iosBackgroundModes,
  ];

  WarningAggregator.addWarningIOS(
    'background-location',
    'Background location usage requires handling location updates in background tasks. ' +
      'Make sure to implement a background task handler using expo-task-manager.'
  );

  return config;
};

const withAndroidBackgroundLocation = (
  config: ExpoConfig,
  {
    androidForegroundServiceLocationType,
  }: {
    androidForegroundServiceLocationType: 'location' | 'mediaProjection' | 'mediaPlayback';
  }
): ExpoConfig => {
  if (Platform.OS !== 'android') {
    return config;
  }

  // Add background location permission
  if (!config.android) {
    config.android = {};
  }
  if (!config.android.permissions) {
    config.android.permissions = [];
  }

  const permissions = config.android.permissions as string[];
  if (!permissions.includes('ACCESS_BACKGROUND_LOCATION')) {
    permissions.push('ACCESS_BACKGROUND_LOCATION');
  }
  if (!permissions.includes('FOREGROUND_SERVICE')) {
    permissions.push('FOREGROUND_SERVICE');
  }
  if (!permissions.includes('FOREGROUND_SERVICE_LOCATION')) {
    permissions.push('FOREGROUND_SERVICE_LOCATION');
  }

  config.android.permissions = [...new Set(permissions)];

  // Configure foreground service type for location
  if (!config.android.package) {
    config.android.package = '';
  }

  // Note: For Expo SDK 47+, foreground service type is configured differently
  // This is a simplified version - in practice, you might need to adjust based on SDK version
  WarningAggregator.addWarningAndroid(
    'background-location',
    'Background location on Android requires ACCESS_BACKGROUND_LOCATION and FOREGROUND_SERVICE permissions. ' +
      'Make sure to handle battery optimization exemptions for production apps.'
  );

  return config;
};

export default withBackgroundLocation;