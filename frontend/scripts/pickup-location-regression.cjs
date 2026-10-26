const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const ts = require(root + '/node_modules/typescript');
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
const { readPickupLocation } = require(root + '/src/lib/pickupLocation.ts');
(async () => {
  let permission='granted', services=true, requests=0, prompts=0;
  const location={
    requestForegroundPermissionsAsync:async()=>{prompts++;return {status:permission}},
    getForegroundPermissionsAsync:async()=>({status:permission}),
    hasServicesEnabledAsync:async()=>services,
    getCurrentPositionAsync:async()=>{requests++;return {coords:{latitude:59.91,longitude:10.75}}},
    Accuracy:{High:4},
  };
  assert.deepEqual(await readPickupLocation(location,false),{point:{lat:59.91,lng:10.75},issue:null});
  assert.equal(prompts,0,'Passive checks never open the OS permission prompt');
  permission='denied';assert.equal((await readPickupLocation(location,true)).issue,'permission');
  assert.equal(prompts,1);assert.equal(requests,1);
  permission='granted';services=false;assert.equal((await readPickupLocation(location,false)).issue,'services');assert.equal(requests,1);
  services=true;
  assert.equal((await readPickupLocation({...location,getCurrentPositionAsync:()=>new Promise(()=>{})},false,5)).issue,'timeout');
  assert.equal((await readPickupLocation({...location,getCurrentPositionAsync:async()=>{throw Error('GPS failure')}},false)).issue,'unavailable');
  assert.equal((await readPickupLocation({...location,getCurrentPositionAsync:async()=>({coords:{latitude:NaN,longitude:10}})},false)).point,null);
  console.log('PASS: permission, disabled GPS, bounded timeout, invalid position, provider failure and explicit permission request');
})().catch(error=>{console.error(error);process.exitCode=1});
