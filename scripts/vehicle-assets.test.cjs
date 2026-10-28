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
const cache = new Map();
function load(source) {
  if(cache.has(source)) return cache.get(source);
  const module={exports:{}};
  const compiled=ts.transpileModule(fs.readFileSync(source,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  vm.runInNewContext(compiled,{module,exports:module.exports,require:relative=>load(path.resolve(path.dirname(source),relative+'.ts'))});
  cache.set(source,module.exports);return module.exports;
}
const assets=load(path.join(root,'frontend/src/lib/vehicleAssets.ts'));
const {customerVehicleArt:art,customerMapVehicleArt:map}=assets;
assert.equal(art('ai-first'),art('enkelt'));
assert.equal(art('ai-first').label,'SNAR');
assert.equal(art('comfort').label,'Comfort');
assert.equal(art('trygg').visualKind,'xl');
assert.equal(art('suv').label,'SUV');
assert.equal(art('unknown-api-class'),null);
const driver=load(path.join(root,'driver-app/src/lib/snarVehicleMapAssets.ts'));
for(const [type,key] of [['ai-first','snar'],['comfort','comfort'],['premium','premium'],['suv','xl'],['trygg','xl']]) {
  for(const source of [art(type).source,map(type)]) {
    assert.match(source,/^data:image\/png;base64,/);
    const bytes=Buffer.from(source.split(',')[1],'base64');
    assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);
    assert.ok(bytes[25]===6 || bytes.includes(Buffer.from('tRNS')),type+' must retain transparency');
  }
  assert.equal(map(type),driver.DRIVER_SNAR_MAP_ASSETS[key],type+' map must match in both apps');
}
assert.notEqual(map('ai-first'),map('premium'));
console.log('PASS: original uploads preserved, 3D PNGs transparent, API identities preserved, Customer/Driver maps identical.');
