const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyFirebaseSigning } = require('./qa-firebase-signing.cjs');
const fingerprint = 'AA'.repeat(20);
const options = { packageName: 'no.kjapp.app', expectedSha1: fingerprint, requireGoogle: true };
const fixture = () => ({ client: [{ client_info: { android_client_info: { package_name: options.packageName } },
  oauth_client: [{ client_type: 1, android_info: { package_name: options.packageName, certificate_hash: fingerprint } }] }] });
test('Customer package and Google certificate match', () => assert.deepEqual(verifyFirebaseSigning(fixture(), options), { packageVerified: true, googleSigningVerified: true }));
test('certificate comparison accepts colon-separated lowercase fingerprints', () => {
  const config = fixture(); config.client[0].oauth_client[0].android_info.certificate_hash = fingerprint.toLowerCase().match(/../g).join(':');
  assert.equal(verifyFirebaseSigning(config, options).googleSigningVerified, true);
});
for (const [name, mutate] of [
  ['missing package', config => { config.client = []; }],
  ['wrong package', config => { config.client[0].client_info.android_client_info.package_name = 'no.other.app'; }],
  ['duplicate package', config => { config.client.push(config.client[0]); }],
  ['missing OAuth certificate', config => { config.client[0].oauth_client = []; }],
  ['wrong certificate', config => { config.client[0].oauth_client[0].android_info.certificate_hash = 'BB'.repeat(20); }],
  ['wrong OAuth package', config => { config.client[0].oauth_client[0].android_info.package_name = 'no.other.app'; }],
]) test(`rejects ${name}`, () => { const config = fixture(); mutate(config); assert.throws(() => verifyFirebaseSigning(config, options)); });
test('Driver package validation does not introduce a Google-login requirement', () => {
  const config = fixture(); config.client[0].oauth_client = [];
  assert.deepEqual(verifyFirebaseSigning(config, { ...options, requireGoogle: false }), { packageVerified: true, googleSigningVerified: false });
});
test('missing expected fingerprint fails closed', () => assert.throws(() => verifyFirebaseSigning(fixture(), { ...options, expectedSha1: '' })));
test('CLI diagnostic stages distinguish parse, package and signing without logging file values', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const { spawnSync } = require('node:child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snar-firebase-test-'));
  const file = path.join(dir, 'fixture.json');
  const config = fixture();
  config.client[0].oauth_client = [];
  config.synthetic_private_marker = 'must-never-be-printed';
  const run = stage => spawnSync(process.execPath, [path.join(__dirname, 'qa-firebase-signing.cjs'), stage], {
    encoding: 'utf8', env: { ...process.env, QA_GOOGLE_SERVICES_JSON: file,
      QA_ANDROID_PACKAGE: options.packageName, QA_ANDROID_CERT_SHA1: fingerprint, QA_REQUIRE_GOOGLE_OAUTH: 'true' },
  });
  try {
    fs.writeFileSync(file, JSON.stringify(config), { mode: 0o600 });
    for (const [stage, expectedStatus] of [['file', 0], ['package', 0], ['signing', 1], ['unknown', 1]]) {
      const result = run(stage);
      assert.equal(result.status, expectedStatus, stage);
      assert.ok(!(result.stdout + result.stderr).includes(config.synthetic_private_marker));
      assert.ok(!(result.stdout + result.stderr).includes(file));
    }
    fs.writeFileSync(file, '{ "synthetic_private_marker": "must-never-be-printed" INVALID }');
    const invalid = run('file');
    assert.equal(invalid.status, 1);
    assert.ok(!(invalid.stdout + invalid.stderr).includes('must-never-be-printed'));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
