const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..'), ts = require(root + '/node_modules/typescript');
function load(file, stubs) {
  const module = { exports: {} }, code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  vm.runInNewContext('(function(require,module,exports){' + code + '\n})', {})(name => stubs[name], module, module.exports); return module.exports;
}
(async () => {
  let OS = 'android', result = { type: 'success', data: { idToken: 'signed-provider-token' } }, error = null, configured, playChecks = 0;
  const sdk = { GoogleSignin: { configure: c => configured = c, hasPlayServices: async () => { playChecks++; }, signIn: async () => { if (error) throw error; return result; } },
    isSuccessResponse: r => r.type === 'success', isCancelledResponse: r => r.type === 'cancelled', isErrorWithCode: e => typeof e?.code === 'string',
    statusCodes: { SIGN_IN_CANCELLED: 'cancelled', PLAY_SERVICES_NOT_AVAILABLE: 'play-unavailable', IN_PROGRESS: 'in-progress' } };
  const auth = load(root + '/src/lib/socialSignIn.native.ts', { 'react-native': { Platform: { get OS() { return OS; } } }, '@react-native-google-signin/google-signin': sdk, 'expo-apple-authentication': {} });
  assert.equal(await auth.googleIdentity({ google_web_client_id: 'web-client' }), 'signed-provider-token'); assert.equal(playChecks, 1); assert.equal(configured.webClientId, 'web-client');
  OS = 'ios'; await assert.rejects(auth.googleIdentity({ google_web_client_id: 'web-client' }), /iOS-klient/);
  assert.equal(await auth.googleIdentity({ google_web_client_id: 'web-client', google_ios_client_id: 'ios-client' }), 'signed-provider-token'); assert.equal(configured.iosClientId, 'ios-client');
  result = { type: 'cancelled' }; assert.equal(await auth.googleIdentity({ google_web_client_id: 'web-client', google_ios_client_id: 'ios-client' }), null);
  for (const [code, message] of [['cancelled', null], ['play-unavailable', /oppdateres/], ['10', /appkonfigurasjon/], ['7', /Sjekk nettet/]]) {
    error = { code }; const request = auth.googleIdentity({ google_web_client_id: 'web-client', google_ios_client_id: 'ios-client' });
    if (message) await assert.rejects(request, message); else assert.equal(await request, null);
  }
  console.log('PASS: actual Google Android/iOS configuration, token extraction, cancellation and useful SDK errors');
  for (const app of ['frontend', 'driver-app']) {
    const plain = new Map([['kjapp_token', 'legacy-test-session']]), secure = new Map(); let fail = false;
    const storage = load(path.join(root, '..', app, 'src/utils/storage/index.ts'), {
      '@react-native-async-storage/async-storage': { getItem: async k => plain.get(k) || null, setItem: async (k,v) => plain.set(k,v), removeItem: async k => plain.delete(k) },
      'expo-secure-store': { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 4, getItemAsync: async k => secure.get(k) || null,
        setItemAsync: async (k,v) => { if (fail) throw Error('keystore unavailable'); secure.set(k,v); }, deleteItemAsync: async k => secure.delete(k) },
    }).storage;
    assert.equal(await storage.getItem('kjapp_token'), 'legacy-test-session'); assert.equal(plain.has('kjapp_token'), false);
    await storage.setItem('kjapp_token', 'new-test-session'); assert.equal(secure.get('kjapp_token'), 'new-test-session');
    fail = true; await assert.rejects(storage.setItem('kjapp_token', 'rejected-session')); assert.equal(plain.has('kjapp_token'), false);
    await storage.setItem('theme', 'dark'); assert.equal(plain.get('theme'), 'dark');
    await storage.removeItem('kjapp_token'); assert.equal(secure.size, 0); assert.equal(plain.has('kjapp_token'), false);
  }
  console.log('PASS: native JWT secure migration, fail-closed writes, unrelated preferences and logout cleanup in both apps');
})().catch(e => { console.error(e); process.exitCode = 1; });
