const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { nativePath, plan } = require('./publish-mobile-update.cjs');
const { assertUpdateBackend } = require('./phase5-qa-build-guard.cjs');
const root = path.resolve(__dirname, '..');

test('QA and production updates reject the other environment or an unknown channel', () => {
  assert.doesNotThrow(() => assertUpdateBackend('qa', 'https://api-qa.snarapp.no'));
  assert.doesNotThrow(() => assertUpdateBackend('production', 'https://api.kjappapp.no'));
  assert.throws(() => assertUpdateBackend('qa', 'https://api.kjappapp.no'));
  assert.throws(() => assertUpdateBackend('production', 'https://api-qa.snarapp.no'));
  assert.throws(() => assertUpdateBackend('preview', 'https://api-qa.snarapp.no'));
});

test('native changes require a new build while JS, copy and vehicle art may update', () => {
  for (const dir of ['frontend', 'driver-app']) {
    for (const file of ['app.json', 'app.config.js', 'package.json', 'package-lock.json', 'eas.json', 'android/app/build.gradle', 'ios/App/AppDelegate.swift', 'assets/icon.png']) {
      assert.equal(nativePath(`${dir}/${file}`, dir), true, file);
    }
    for (const file of ['app/login.tsx', 'src/lib/liveCars.ts', 'src/components/DriverCockpitView.tsx', 'assets/vehicles/premium.png']) {
      assert.equal(nativePath(`${dir}/${file}`, dir), false, file);
    }
    assert.equal(nativePath('scripts/phase5-qa-build-guard.cjs', dir), true);
  }
});

test('both apps have isolated project IDs, a native updater and nonblocking automatic downloads', () => {
  const projects = [];
  for (const [app, dir] of [['customer', 'frontend'], ['driver', 'driver-app']]) {
    const config = JSON.parse(fs.readFileSync(path.join(root, dir, 'app.json'))).expo;
    const pkg = JSON.parse(fs.readFileSync(path.join(root, dir, 'package.json')));
    projects.push(config.extra.eas.projectId);
    assert.ok(pkg.dependencies['expo-updates']);
    assert.equal(config.updates.url, `https://u.expo.dev/${config.extra.eas.projectId}`);
    assert.equal(config.updates.enabled, true);
    assert.equal(config.updates.checkAutomatically, 'ON_LOAD');
    assert.equal(config.updates.fallbackToCacheTimeout, 0);
    assert.equal(config.updates.useEmbeddedUpdate, true);
    assert.deepEqual(config.runtimeVersion, { policy: 'appVersion' });
    assert.equal(plan(app, 'qa', root).environment, 'preview');
    assert.equal(plan(app, 'production', root).environment, 'production');
    const eas = JSON.parse(fs.readFileSync(path.join(root, dir, 'eas.json')));
    assert.equal(eas.build['testflight-qa'].channel, 'qa');
    assert.equal(eas.build['testflight-beta'].channel, 'production');
    assert.equal(eas.build.apk.channel, 'production');
  }
  assert.notEqual(projects[0], projects[1]);
  assert.throws(() => plan('other', 'qa', root));
});
