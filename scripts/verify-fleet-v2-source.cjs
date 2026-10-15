/** Verify the actual supplied design files before accepting a design source. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const manifest = require('../docs/snar-v10/reference/fleet-v2-20261014/manifest.json');
const source = process.argv[2];
if (!source) { console.error('Usage: node scripts/verify-fleet-v2-source.cjs <extracted-design-directory>'); process.exitCode = 2; }
else {
  const mismatches=[];
  for(const [file,expected] of Object.entries(manifest.files)) {
    try { const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(path.resolve(source),file))).digest('hex');if(actual!==expected)mismatches.push(file); }
    catch {mismatches.push(file);}
  }
  if(mismatches.length){console.error('Design source mismatch:',mismatches.join(', '));process.exitCode=1;}
  else console.log(`Verified supplied source: ${Object.keys(manifest.files).length} files, ${manifest.customer.length} Customer states and ${manifest.driver.length} Driver states (08–09 combined). Native parity requires separate evidence.`);
}
