const fs = require('node:fs');

function verifyFirebaseSigning(config, { packageName, expectedSha1, requireGoogle = false }) {
  const expected = String(expectedSha1 || '').replace(/:/g, '').toUpperCase();
  if (!/^[A-F0-9]{40}$/.test(expected)) throw new Error('Expected Android certificate fingerprint is required.');
  const clients = (config?.client || []).filter(client => client?.client_info?.android_client_info?.package_name === packageName);
  if (clients.length !== 1) throw new Error('Dedicated QA Firebase Android package is not uniquely configured.');
  if (requireGoogle && !(clients[0].oauth_client || []).some(client => client.client_type === 1
      && client.android_info?.package_name === packageName
      && String(client.android_info?.certificate_hash || '').replace(/:/g, '').toUpperCase() === expected)) {
    throw new Error('QA Firebase Google OAuth certificate does not match the existing EAS signing certificate.');
  }
  return { packageVerified: true, googleSigningVerified: requireGoogle };
}

module.exports = { verifyFirebaseSigning };
if (require.main === module) {
  try {
    const config = JSON.parse(fs.readFileSync(process.env.QA_GOOGLE_SERVICES_JSON_V2 || process.env.QA_GOOGLE_SERVICES_JSON, 'utf8'));
    const stage = process.argv[2] || 'signing';
    if (!['file', 'package', 'signing'].includes(stage)) throw new Error('Invalid QA Firebase validation stage.');
    if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Invalid QA Firebase file.');
    if (stage === 'file') {
      console.log('Dedicated QA Firebase file parsed. No provider values are logged.');
      process.exit(0);
    }
    const result = verifyFirebaseSigning(config, {
      packageName: process.env.QA_ANDROID_PACKAGE,
      expectedSha1: process.env.QA_ANDROID_CERT_SHA1,
      requireGoogle: stage === 'signing' && process.env.QA_REQUIRE_GOOGLE_OAUTH === 'true',
    });
    console.log(JSON.stringify(result));
  } catch (error) {
    // Never print file contents, file paths, provider keys or parse-error snippets.
    const known = [
      'Expected Android certificate fingerprint is required.',
      'Dedicated QA Firebase Android package is not uniquely configured.',
      'QA Firebase Google OAuth certificate does not match the existing EAS signing certificate.',
    ];
    console.error(known.includes(error?.message) ? error.message : 'QA Firebase file is unavailable or invalid JSON. No provider values are logged.');
    process.exitCode = 1;
  }
}
