// Enhanced Notifications Plugin Configuration
// This plugin configures expo-notifications for both driver and customer apps

import { ExpoConfig, ConfigPlugin, WarningAggregator } from '@expo/config-plugins';
import { Platform } from 'react-native';

const withEnhancedNotifications: ConfigPlugin<{
  defaultChannel?: string;
  channelName?: string;
  channelDescription?: string;
  androidColor?: string;
  enableBackgroundRemoteNotifications?: boolean;
}> = (config, {
  defaultChannel = 'kjapp_trips',
  channelName = 'KJAPP Varsler',
  channelDescription = 'Varsler om turer, sjåfører og betalinger',
  androidColor = '#00E5F5', // Cyan color matching KJAPP theme
  enableBackgroundRemoteNotifications = true,
} = {}) => {
  config = withIosNotifications(config, {
    enableBackgroundRemoteNotifications,
  });
  config = withAndroidNotifications(config, {
    defaultChannel,
    channelName,
    channelDescription,
    androidColor,
    enableBackgroundRemoteNotifications,
  });
  return config;
};

const withIosNotifications = (
  config: ExpoConfig,
  {
    enableBackgroundRemoteNotifications,
  }: {
    enableBackgroundRemoteNotifications: boolean;
  }
): ExpoConfig => {
  if (Platform.OS !== 'ios') {
    return config;
  }

  // iOS doesn't require additional configuration in Info.plist for basic notifications
  // but we need to ensure background modes are set if using remote notifications
  if (enableBackgroundRemoteNotifications) {
    if (!config.ios) {
      config.ios = {};
    }
    if (!config.ios.infoPlist) {
      config.ios.infoPlist = {};
    }

    // Add remote-notification to background modes if not present
    const backgroundModes = config.ios.infoPlist.UIBackgroundModes || [];
    if (!backgroundModes.includes('remote-notification')) {
      config.ios.infoPlist.UIBackgroundModes = [
        ...backgroundModes,
        'remote-notification',
      ];
    }
  }

  WarningAggregator.addWarningIOS(
    'notifications',
    'Remote notifications require configuring your APNs credentials with Expo. ' +
      'Make sure to set up push notifications correctly for production builds.'
  );

  return config;
};

const withAndroidNotifications = (
  config: ExpoConfig,
  {
    defaultChannel,
    channelName,
    channelDescription,
    androidColor,
    enableBackgroundRemoteNotifications,
  }: {
    defaultChannel: string;
    channelName: string;
    channelDescription: string;
    androidColor: string;
    enableBackgroundRemoteNotifications: boolean;
  }
): ExpoConfig => {
  if (Platform.OS !== 'android') {
    return config;
  }

  // Add notification permission
  if (!config.android) {
    config.android = {};
  }
  if (!config.android.permissions) {
    config.android.permissions = [];
  }

  const permissions = config.android.permissions as string[];
  if (!permissions.includes('POST_NOTIFICATIONS')) {
    permissions.push('POST_NOTIFICATIONS');
  }

  config.android.permissions = [...new Set(permissions)];

  // Configure default notification channel
  // Note: In newer versions of expo-notifications, channel configuration
  // is done programmatically rather than in config plugins
  // This is maintained for compatibility with older versions
  if (!config.android) {
    config.android = {};
  }
  config.android.package = config.android.package || '';

  WarningAggregator.addWarningAndroid(
    'notifications',
    'Notification channels are created programmatically in the app initialization. ' +
      'Make sure to call createNotificationChannel() during app startup for Android.'
  );

  return config;
};

export default withEnhancedNotifications;