const { execFileSync } = require('node:child_process');
const { verifyQaBackend, fetchQaJson } = require('./phase5-qa-backend-preflight.cjs');

const QA_BRANCH = 'qa/snar-v10-phase5-staging-e2e';
const QA_REF = `refs/heads/${QA_BRANCH}`;

function assertSource(env, actualSha) {
  if (env.QA_APK_AUTHORIZATION !== 'BUILD_QA_APK') throw new Error('Explicit QA APK authorization is required.');
  if (!/^[a-f0-9]{40}$/.test(env.EXPECTED_SOURCE_SHA || '')) throw new Error('Supply a full reviewed commit SHA.');

  const directQaRun = env.GITHUB_REF === QA_REF;
  const sameBaseQaPrRun = env.GITHUB_EVENT_NAME === 'pull_request' && env.GITHUB_BASE_REF === QA_BRANCH;
  if (!directQaRun && !sameBaseQaPrRun) throw new Error('Select the approved QA workflow branch/base.');

  if (actualSha !== env.EXPECTED_SOURCE_SHA) throw new Error('Checked-out QA source and reviewed SHA must match.');
  if (directQaRun && env.GITHUB_SHA !== actualSha) throw new Error('Workflow event SHA, checked-out source and reviewed SHA must match.');

  if (!['frontend', 'driver-app'].includes(env.QA_APP_DIRECTORY)) throw new Error('Unknown QA app.');
  if (!/^[a-f0-9]{40}$/i.test((env.QA_ANDROID_CERT_SHA1 || '').replace(/:/g, ''))) {
    throw new Error('Configure the registered app Android signing SHA-1 before building Google sign-in.');
  }
}

function assertBackendRelease(body, expectedSha) {
  if (body?.release?.commit !== expectedSha || body?.release?.environment !== 'qa') {
    throw new Error('The deployed QA backend must run the reviewed source SHA.');
  }
}

async function main() {
  const env = process.env;
  assertSource(env, execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim());
  await verifyQaBackend({ env });
  for (const path of ['/api/health', '/api/ready']) {
    assertBackendRelease(await fetchQaJson(path, { fetchImpl: globalThis.fetch }), env.EXPECTED_SOURCE_SHA);
  }
  console.log('Reviewed workflow/source SHA and live isolated Render QA release match.');
}
module.exports = { assertSource, assertBackendRelease };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
