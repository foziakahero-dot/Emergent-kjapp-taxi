const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertSource, assertBackendRelease } = require('./qa-release-lock.cjs');
const sha = 'a'.repeat(40);
const qaBranch = 'qa/snar-v10-phase5-staging-e2e';
const good = {
  QA_APK_AUTHORIZATION: 'BUILD_QA_APK',
  EXPECTED_SOURCE_SHA: sha,
  GITHUB_SHA: sha,
  GITHUB_REF: `refs/heads/${qaBranch}`,
  GITHUB_EVENT_NAME: 'workflow_dispatch',
  GITHUB_BASE_REF: '',
  QA_APP_DIRECTORY: 'frontend',
  QA_ANDROID_CERT_SHA1: 'b'.repeat(40),
};

test('reviewed direct QA source and workflow are locked together', () => assert.doesNotThrow(() => assertSource(good, sha)));

const goodQaPr = {
  ...good,
  GITHUB_SHA: 'c'.repeat(40),
  GITHUB_REF: 'refs/pull/107/merge',
  GITHUB_EVENT_NAME: 'pull_request',
  GITHUB_BASE_REF: qaBranch,
};
test('reviewed same-repo QA PR event may validate checked-out QA base SHA', () => assert.doesNotThrow(() => assertSource(goodQaPr, sha)));

for (const [name, change, actual] of [
  ['missing authorization', { QA_APK_AUTHORIZATION: '' }],
  ['short SHA', { EXPECTED_SOURCE_SHA: 'aaa' }],
  ['wrong workflow branch', { GITHUB_REF: 'refs/heads/main' }],
  ['changed direct workflow commit', { GITHUB_SHA: 'c'.repeat(40) }],
  ['changed checkout', {}, 'c'.repeat(40)],
  ['wrong app', { QA_APP_DIRECTORY: 'admin-web' }],
  ['missing Google signing fingerprint', { QA_ANDROID_CERT_SHA1: '' }],
]) test(name + ' blocks builds', () => assert.throws(() => assertSource({ ...good, ...change }, actual || sha)));

test('PR event targeting a non-QA base blocks builds', () => assert.throws(() => assertSource({ ...goodQaPr, GITHUB_BASE_REF: 'main' }, sha)));
test('Driver Google sign-in also requires a registered signing fingerprint', () => assert.throws(() => assertSource({ ...good, QA_APP_DIRECTORY: 'driver-app', QA_ANDROID_CERT_SHA1: '' }, sha)));
test('backend must report the exact reviewed QA commit', () => {
  assert.doesNotThrow(() => assertBackendRelease({ release: { commit: sha, environment: 'qa' } }, sha));
  for (const release of [undefined, { commit: 'c'.repeat(40), environment: 'qa' }, { commit: sha, environment: 'production' }]) {
    assert.throws(() => assertBackendRelease({ release }, sha));
  }
});
