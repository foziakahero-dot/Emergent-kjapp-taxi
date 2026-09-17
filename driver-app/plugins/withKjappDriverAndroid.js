const { withAndroidManifest } = require('@expo/config-plugins');

const LOCATION_SERVICE = 'expo.modules.location.services.LocationTaskService';
const TOOLS_NS = 'http://schemas.android.com/tools';

module.exports = function withKjappDriverAndroid(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    manifest.$ = manifest.$ || {};
    manifest.$['xmlns:tools'] = manifest.$['xmlns:tools'] || TOOLS_NS;

    const application = manifest.application?.[0];
    if (!application) return mod;

    application.service = application.service || [];
    const existing = application.service.find(
      (service) => service?.$?.['android:name'] === LOCATION_SERVICE,
    );

    const attrs = existing?.$ || {
      'android:name': LOCATION_SERVICE,
      'android:exported': 'false',
    };
    attrs['android:foregroundServiceType'] = 'location|dataSync';
    attrs['tools:replace'] = 'android:foregroundServiceType';

    if (existing) existing.$ = attrs;
    else application.service.push({ $: attrs });

    return mod;
  });
};
