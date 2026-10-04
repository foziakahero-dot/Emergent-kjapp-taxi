// Payment Helper Plugin Configuration
// This plugin is a utility helper and doesn't require native configuration
// but we'll create a config plugin for consistency

import { ExpoConfig, ConfigPlugin } from '@expo/config-plugins';

const withPaymentHelper: ConfigPlugin<{}> = (config) => {
  // Payment helper is a JavaScript/TypeScript utility module
  // It doesn't require any native configuration changes
  return config;
};

export default withPaymentHelper;