const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withNavigationQueries(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const queries = manifest.queries || (manifest.queries = []);
    const query = queries[0] || (queries[0] = {});
    const intents = query.intent || (query.intent = []);
    for (const scheme of ['waze', 'google.navigation']) {
      if (!queries.some((entry) => (entry.intent || []).some((intent) =>
        (intent.action || []).some((action) => action.$?.['android:name'] === 'android.intent.action.VIEW') &&
        (intent.data || []).some((data) => data.$?.['android:scheme'] === scheme)
      ))) {
        intents.push({
          action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
          data: [{ $: { 'android:scheme': scheme } }],
        });
      }
    }
    return config;
  });
};
