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
