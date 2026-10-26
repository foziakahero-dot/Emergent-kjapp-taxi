const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const projectIds = { frontend: '3631002e-5b25-4847-b5d8-05ec2ef304b5', 'driver-app': '1dec8949-0423-4fbf-a080-0703f93519d7' };
function validateBuild(build, env) {
  if (!build || build.status !== 'FINISHED' || build.platform !== 'ANDROID' || build.distribution !== 'INTERNAL'
      || build.gitCommitHash !== env.EXPECTED_SOURCE_SHA || build.buildProfile !== 'qa'
      || build.project?.id !== projectIds[env.QA_APP_DIRECTORY]) throw new Error('EAS build identity, signing profile or status does not match the reviewed QA release.');
  const url = new URL(build.artifacts?.buildUrl || '');
  if (url.protocol !== 'https:') throw new Error('EAS did not return a secure APK artifact.');
  return url.href;
}
async function main() {
  const env = process.env;
  const builds = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  if (!Array.isArray(builds) || builds.length !== 1) throw new Error('Expected one EAS Android build.');
  const url = validateBuild(builds[0], env);
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error('Could not download the completed QA APK.');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1024 || bytes.readUInt32LE(0) !== 0x04034b50) throw new Error('Artifact is not an Android APK ZIP.');
  const directory = path.resolve('qa-artifacts'); fs.mkdirSync(directory, { recursive: true });
  const name = `SNAR-${env.QA_APP_DIRECTORY === 'frontend' ? 'Customer' : 'Driver'}-QA-${env.EXPECTED_SOURCE_SHA.slice(0, 8)}.apk`;
  fs.writeFileSync(path.join(directory, name), bytes);
  fs.writeFileSync(path.join(directory, name + '.sha256'), crypto.createHash('sha256').update(bytes).digest('hex') + '  ' + name + '\n');
  fs.writeFileSync(path.join(directory, 'release.json'), JSON.stringify({ app: env.QA_APP_DIRECTORY,
    sourceSha: env.EXPECTED_SOURCE_SHA, backendSha: env.EXPECTED_SOURCE_SHA, api: env.EXPO_PUBLIC_BACKEND_URL,
    buildId: builds[0].id, profile: 'qa', projectId: builds[0].project.id }, null, 2) + '\n');
  console.log('Verified EAS identity and downloaded QA APK; raw EAS output is not published.');
}
module.exports = { validateBuild };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
