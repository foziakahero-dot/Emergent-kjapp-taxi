const fs = require('fs');
const path = require('path');
const gate = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'customer-build-gate.json'), 'utf8'));
const incomplete = Object.entries(gate.checks).filter(([, status]) => status !== 'PASS');
// Explicit user authorization on 4 October permits an internal Android test APK.
// Release readiness remains unchanged and must never be reported as PASS.
const internalApk = process.env.EAS_BUILD_PROFILE === 'apk-internal-20261004'
  && process.env.EAS_BUILD_PLATFORM === 'android'
  && process.env.CUSTOMER_INTERNAL_APK_AUTHORIZATION === '20261004';
if (internalApk) {
  console.warn('SNAR Customer INTERNAL TEST APK authorized by user on 2026-10-04; release gate remains BLOCKED.');
  for (const [name, status] of incomplete) console.warn(`${name}: ${status}`);
  for (const blocker of [...gate.p0, ...gate.p1]) console.warn(blocker);
  require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'customer-config-probe.cjs')], { stdio: 'inherit', timeout: 20000 });
  process.exit(0);
}
if (gate.p0.length || gate.p1.length || incomplete.length || gate.customerBuildAuthorized !== true) {
  console.error('SNAR Customer build BLOCKED. See docs/CUSTOMER_PREBUILD_REPORT_20261004.md.');
  for (const [name, status] of incomplete) console.error(`${name}: ${status}`);
  for (const blocker of [...gate.p0, ...gate.p1]) console.error(blocker);
  process.exit(1);
}
console.log('SNAR Customer pre-build gate PASS.');
