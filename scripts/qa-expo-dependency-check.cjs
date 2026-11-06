const { spawnSync } = require('node:child_process');
const { assertQaBackend, QA_BUILD_PROFILES } = require('./phase5-qa-build-guard.cjs');

function dependencyCheckEnvironment(env) {
  if (!QA_BUILD_PROFILES.has(env.EAS_BUILD_PROFILE)) return env;
  assertQaBackend(env.EAS_BUILD_PROFILE, env.EXPO_PUBLIC_BACKEND_URL);
  // Freeze compatibility against the installed Expo SDK's bundled metadata.
  // Keep `expo install --check`; do not skip validation or modify dependencies.
  return { ...env, EXPO_OFFLINE: '1' };
}

function checkDependencies({ env = process.env, spawn = spawnSync } = {}) {
  const result = spawn('npx', ['expo', 'install', '--check'], {
    env: dependencyCheckEnvironment(env), stdio: 'inherit',
  });
  return Number.isInteger(result.status) ? result.status : 1;
}

module.exports = { dependencyCheckEnvironment, checkDependencies };
if (require.main === module) {
  try { process.exitCode = checkDependencies(); }
  catch { console.error('QA Expo dependency validation failed.'); process.exitCode = 1; }
}
