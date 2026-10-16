const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateBuild } = require('./qa-eas-artifact.cjs');
const env = { EXPECTED_SOURCE_SHA: 'a'.repeat(40), QA_APP_DIRECTORY: 'frontend' };
const build = { status: 'FINISHED', platform: 'ANDROID', distribution: 'INTERNAL', buildProfile: 'qa',
  gitCommitHash: env.EXPECTED_SOURCE_SHA, project: { id: '3631002e-5b25-4847-b5d8-05ec2ef304b5' },
  artifacts: { buildUrl: 'https://expo.dev/artifacts/eas/test.apk' } };
test('only the selected completed EAS QA build can be downloaded', () => {
  assert.equal(validateBuild(build, env), build.artifacts.buildUrl);
  for (const changed of [{ status: 'ERRORED' }, { platform: 'IOS' }, { distribution: 'STORE' },
    { buildProfile: 'production' }, { gitCommitHash: 'b'.repeat(40) }, { project: { id: 'wrong-app' } },
    { artifacts: { buildUrl: 'http://expo.dev/test.apk' } }]) {
    assert.throws(() => validateBuild({ ...build, ...changed }, env));
  }
});
