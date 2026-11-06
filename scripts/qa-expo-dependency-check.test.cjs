const test = require('node:test');
const assert = require('node:assert/strict');
const { dependencyCheckEnvironment, checkDependencies } = require('./qa-expo-dependency-check.cjs');
for (const profile of ['qa', 'testflight-qa']) {
  test(`${profile} uses frozen SDK metadata only on the canonical QA backend`, () => {
    const env = { EAS_BUILD_PROFILE: profile, EXPO_PUBLIC_BACKEND_URL: 'https://api-qa.snarapp.no' };
    assert.equal(dependencyCheckEnvironment(env).EXPO_OFFLINE, '1');
    assert.equal(env.EXPO_OFFLINE, undefined);
    assert.throws(() => dependencyCheckEnvironment({ ...env, EXPO_PUBLIC_BACKEND_URL: 'https://api.kjappapp.no' }));
  });
}
test('other profiles retain the existing environment and online validation', () => {
  const env = { EAS_BUILD_PROFILE: 'production' };
  assert.equal(dependencyCheckEnvironment(env), env);
});
for (const status of [0, 1, 17, null]) {
  test(`dependency checker preserves failure status ${status}`, () => {
    const code = checkDependencies({ env: {}, spawn: (command, args) => {
      assert.equal(command, 'npx');
      assert.deepEqual(args, ['expo', 'install', '--check']);
      return { status };
    } });
    assert.equal(code, status === null ? 1 : status);
  });
}
