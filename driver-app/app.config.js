module.exports = ({ config }) => {
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  const requireFirebase = process.env.KJAPP_REQUIRE_FIREBASE === 'true';

  if (requireFirebase && !googleServicesFile) {
    throw new Error(
      'KJAPP Firebase config missing: configure GOOGLE_SERVICES_JSON as an EAS secret file.'
    );
  }

  return {
    ...config,
    android: {
      ...config.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
  };
};
