const APPROVED_QA_BACKEND = 'https://api-qa.snarapp.no';

function assertQaBackend(profile, backendUrl) {
  if (profile !== 'qa') return;
  if (backendUrl !== APPROVED_QA_BACKEND) {
    throw new Error(`QA builds must target ${APPROVED_QA_BACKEND}.`);
  }
}

function assertMapboxToken(token) {
  const value = String(token || '').trim();
  if (!value) {
    throw new Error(
      'EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN is missing. The APK would ship the raster fallback map. '
      + 'Add the public pk.* token as a GitHub repository secret with the same name.',
    );
  }
  if (!value.startsWith('pk.')) {
    throw new Error('EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN must be a public Mapbox token (pk.*), never a secret sk.* token.');
  }
}

module.exports = { APPROVED_QA_BACKEND, assertQaBackend, assertMapboxToken };

if (require.main === module) {
  try {
    if (process.env.EAS_BUILD_PROFILE !== 'qa') {
      throw new Error('QA build guard requires EAS_BUILD_PROFILE=qa.');
    }
    assertQaBackend(process.env.EAS_BUILD_PROFILE, process.env.EXPO_PUBLIC_BACKEND_URL);
    assertMapboxToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN);
    console.log('QA backend URL guard: PASS');
    console.log('Mapbox public token guard: PASS');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

