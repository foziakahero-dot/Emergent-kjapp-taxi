const fs = require('fs');
const path = require('path');
const gate = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'customer-build-gate.json'), 'utf8'));
const incomplete = Object.entries(gate.checks).filter(([, status]) => status !== 'PASS');
if (gate.p0.length || gate.p1.length || incomplete.length || gate.customerBuildAuthorized !== true) {
  console.error('SNAR Customer build BLOCKED. See docs/CUSTOMER_PREBUILD_REPORT_20261004.md.');
  for (const [name, status] of incomplete) console.error(`${name}: ${status}`);
  for (const blocker of [...gate.p0, ...gate.p1]) console.error(blocker);
  process.exit(1);
}
console.log('SNAR Customer pre-build gate PASS.');
