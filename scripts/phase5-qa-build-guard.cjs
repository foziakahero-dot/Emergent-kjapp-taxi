const APPROVED_QA_BACKEND = 'https://api-qa.snarapp.no';

function assertQaBackend(profile, backendUrl) {
  if (profile !== 'qa') return;
  if (backendUrl !== APPROVED_QA_BACKEND) {
    throw new Error(`QA builds must target ${APPROVED_QA_BACKEND}.`);
  }
}

module.exports = { APPROVED_QA_BACKEND, assertQaBackend };
