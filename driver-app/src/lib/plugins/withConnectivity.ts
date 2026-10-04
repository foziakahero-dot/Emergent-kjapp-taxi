// Connectivity Monitoring Plugin Configuration
// This plugin configures expo-network for connectivity monitoring

import { ExpoConfig, ConfigPlugin, WarningAggregator } from '@expo/config-plugins';
import { Platform } from 'react-native';

const withConnectivity: ConfigPlugin<{}> = (config) => {
  config = withIosConnectivity(config);
  config = withAndroidConnectivity(config);
  return config;
};

const withIosConnectivity = (
  config: ExpoConfig
): ExpoConfig => {
  if (Platform.OS !== 'ios') {
    return config;
  }

  // iOS doesn't require additional permissions for expo-network beyond what's standard
  // expo-network uses the standard network framework which doesn't need special permissions

  WarningAggregator.addWarningIOS(
    'connectivity',
    'expo-network provides network state monitoring. No additional iOS configuration required.'
  );

  return config;
};

const withAndroidConnectivity = (
  config: ExpoConfig
): ExpoConfig => {
  if (Platform.OS !== 'android') {
    return config;
  }

  // Add access network state permission
  if (!config.android) {
    config.android = {};
  }
  if (!config.android.permissions) {
    config.android.permissions = [];
  }

  const permissions = config.android.permissions as string[];
  if (!permissions.includes('ACCESS_NETWORK_STATE')) {
    permissions.push('ACCESS_NETWORK_STATE');
  }
  if (!permissions.includes('INTERNET')) {
    permissions.push('INTERNET');
  }

  config.android.permissions = [...new Set(permissions)];

  WarningAggregator.addWarningAndroid(
    'connectivity',
    'expo-network on Android requires ACCESS_NETWORK_STATE and INTERNET permissions ' +
      'to monitor network state and check connectivity.'
  );

  return config;
};

export default withConnectivity;