const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { APPROVED_QA_BACKEND, assertQaBackend } = require('./phase5-qa-build-guard.cjs');

const repositoryRoot = path.resolve(__dirname, '..');

test('QA profile accepts only the approved HTTPS backend target', () => {
  assert.doesNotThrow(() => assertQaBackend('qa', APPROVED_QA_BACKEND));
});

test('QA profile rejects production and unapproved targets', () => {
  for (const backendUrl of [
    'https://api.kjappapp.no',
    'http://api-qa.snarapp.no',
    'https://api-qa.snarapp.no/',
    'https://api-qa.snarapp.no.evil.example',
    '',
  ]) {
    assert.throws(() => assertQaBackend('qa', backendUrl), /must target/);
  }
});

test('non-QA profiles preserve their existing backend configuration', () => {
  assert.doesNotThrow(() => assertQaBackend('apk', 'https://api.kjappapp.no'));
  assert.doesNotThrow(() => assertQaBackend('production', 'https://api.kjappapp.no'));
});

test('Customer and Driver QA EAS profiles use only the approved QA backend', () => {
  for (const appDirectory of ['frontend', 'driver-app']) {
    const easConfig = JSON.parse(
      fs.readFileSync(path.join(repositoryRoot, appDirectory, 'eas.json'), 'utf8')
    );
    const profile = easConfig.build.qa;
    assert.ok(profile, `${appDirectory} has a QA build profile`);
    assert.equal(profile.distribution, 'internal');
    assert.equal(profile.android.buildType, 'apk');
    assert.equal(profile.env.EXPO_PUBLIC_BACKEND_URL, APPROVED_QA_BACKEND);
    assert.doesNotThrow(() =>
      assertQaBackend('qa', profile.env.EXPO_PUBLIC_BACKEND_URL)
    );
  }
});

test('QA app configs do not embed shared Firebase service files', () => {
  for (const appDirectory of ['frontend', 'driver-app']) {
    const appPath = path.join(repositoryRoot, appDirectory);
    const result = spawnSync(
      process.execPath,
      [
        '-e',
        "const fs=require('node:fs');const app=require('./app.config');const base=JSON.parse(fs.readFileSync('./app.json','utf8')).expo;const config=app({config:base});console.log(JSON.stringify({name:config.name,package:config.android.package,googleServicesFile:config.android.googleServicesFile||null}));",
      ],
      {
        cwd: appPath,
        encoding: 'utf8',
        env: {
          ...process.env,
          EAS_BUILD_PROFILE: 'qa',
          EAS_BUILD_PLATFORM: 'android',
          EXPO_PUBLIC_BACKEND_URL: APPROVED_QA_BACKEND,
          GOOGLE_SERVICES_JSON: 'shared-provider-config.json',
          KJAPP_REQUIRE_FIREBASE: '',
        },
      }
    );
    assert.equal(result.status, 0, result.stderr);
    const config = JSON.parse(result.stdout.trim());
    assert.equal(config.googleServicesFile, null);
    assert.ok(config.package);
    assert.match(config.name, /QA BACKEND/);
  }
});
