const APPROVED_QA_BACKEND = 'https://api-qa.snarapp.no';
const QA_BUILD_PROFILES = new Set(['qa', 'testflight-qa']);

function assertQaBackend(profile, backendUrl) {
  if (!QA_BUILD_PROFILES.has(profile)) return;
  if (backendUrl !== APPROVED_QA_BACKEND) {
    throw new Error(`QA builds must target ${APPROVED_QA_BACKEND}.`);
  }
}

function assertUpdateBackend(channel, backendUrl) {
  if (!channel) return;
  const expected = { qa: APPROVED_QA_BACKEND, production: 'https://api.kjappapp.no' }[channel];
  if (!expected || backendUrl !== expected) {
    throw new Error(`Update channel ${channel} does not match its approved backend.`);
  }
}

module.exports = { APPROVED_QA_BACKEND, QA_BUILD_PROFILES, assertQaBackend, assertUpdateBackend };

if (require.main === module) {
  try {
    if (!QA_BUILD_PROFILES.has(process.env.EAS_BUILD_PROFILE)) {
      throw new Error('QA build guard requires EAS_BUILD_PROFILE=qa or testflight-qa.');
    }
    assertQaBackend(process.env.EAS_BUILD_PROFILE, process.env.EXPO_PUBLIC_BACKEND_URL);
    console.log('QA backend URL guard: PASS');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
