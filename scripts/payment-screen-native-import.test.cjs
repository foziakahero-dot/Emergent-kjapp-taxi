const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const ts = createRequire(path.join(root, 'frontend/package.json'))('typescript');
const source = fs.readFileSync(path.join(root, 'frontend/app/payment-methods.tsx'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
for (const [OS, window] of [['android', {}], ['ios', {}], ['web', { location: { origin: 'https://qa.example.invalid' } }], ['web', undefined]]) {
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, window, process: { env: {} },
    require: name => name === 'react-native' ? { Platform: { OS } } : {},
  });
  assert.equal(typeof module.exports.default, 'function', `${OS}: payment screen must load before any Stripe call`);
}
console.log('PASS: payment screen imports on Android/iOS without browser Location and on web/SSR.');
