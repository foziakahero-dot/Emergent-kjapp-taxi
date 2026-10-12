const APPROVED_QA_BACKEND = 'https://api-qa.snarapp.no';

function assertQaBackend(profile, backendUrl) {
  if (profile !== 'qa') return;
  if (backendUrl !== APPROVED_QA_BACKEND) {
    throw new Error(`QA builds must target ${APPROVED_QA_BACKEND}.`);
  }
}

module.exports = { APPROVED_QA_BACKEND, assertQaBackend };

if (require.main === module) {
  try {
    if (process.env.EAS_BUILD_PROFILE !== 'qa') {
      throw new Error('QA build guard requires EAS_BUILD_PROFILE=qa.');
    }
    assertQaBackend(process.env.EAS_BUILD_PROFILE, process.env.EXPO_PUBLIC_BACKEND_URL);
    console.log('QA backend URL guard: PASS');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

