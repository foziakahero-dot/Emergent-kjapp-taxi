const fs = require('fs');
const path = require('path');

const gatePath = path.join(__dirname, '..', 'customer-build-gate.json');
const gate = JSON.parse(fs.readFileSync(gatePath, 'utf8'));
const incomplete = Object.entries(gate.checks || {}).filter(([, status]) => status !== 'PASS');

console.log('SNAR Customer EAS native compile gate.');
if (incomplete.length || (gate.p0 || []).length || (gate.p1 || []).length || gate.customerBuildAuthorized !== true) {
  console.warn('Release readiness is NOT fully green. Native compilation will continue so Android/iOS binaries can be produced and physically tested.');
  for (const [name, status] of incomplete) console.warn(`readiness: ${name} = ${status}`);
  for (const blocker of [...(gate.p0 || []), ...(gate.p1 || [])]) console.warn(`readiness blocker: ${blocker}`);
} else {
  console.log('Release readiness gate is fully green.');
}
console.log('EAS native compile authorized; this does not imply production-release approval.');
