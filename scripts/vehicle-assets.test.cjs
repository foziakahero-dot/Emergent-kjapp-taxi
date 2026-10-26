const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'frontend/assets/vehicles/snar');
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
for (const [file, expected] of Object.entries(manifest.files)) {
  const bytes = fs.readFileSync(path.join(dir, file));
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(bytes.readUInt32BE(16), expected.width);
  assert.equal(bytes.readUInt32BE(20), expected.height);
  assert.equal(bytes[25], 6, `${file} must preserve RGBA`);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), expected.sha256,
    `${file} must be the original user upload`);
}
const ts = require(path.join(root, 'frontend/node_modules/typescript'));
const source = path.join(root, 'frontend/src/lib/vehicleAssets.ts');
const compiled = ts.transpileModule(fs.readFileSync(source, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const context = { exports: {}, require(relative) {
  const resolved = path.resolve(path.dirname(source), relative);
  assert.ok(fs.existsSync(resolved)); return resolved;
} };
vm.runInNewContext(compiled, context);
const { customerVehicleArt: art } = context.exports;
assert.equal(art('ai-first'), art('enkelt'));
assert.equal(art('ai-first').visualKind, 'hatchback');
assert.equal(art('premium').visualKind, 'sedan');
assert.equal(art('suv').visualKind, 'suv');
assert.equal(art('trygg').visualKind, 'xl');
assert.notEqual(art('trygg').source, art('suv').source);
assert.equal(art('unknown-api-class'), null);
console.log('PASS: original PNG bytes/RGBA/dimensions, API aliases and XL/SUV separation.');
