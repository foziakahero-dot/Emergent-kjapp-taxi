#!/usr/bin/env node
// Publish only JS/assets compatible with an explicitly identified installed build.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { parseArgs } = require('node:util');
const { assertUpdateBackend } = require('./phase5-qa-build-guard.cjs');

const APPS = { customer: 'frontend', driver: 'driver-app' };
const EAS_CLI = 'eas-cli@27.1.0';

function nativePath(file, dir) {
  if (file === 'scripts/phase5-qa-build-guard.cjs') return true;
  if (!file.startsWith(`${dir}/`)) return false;
  const relative = file.slice(dir.length + 1);
  return /^(android|ios|plugins)\//.test(relative)
    || /^(app\.json|app\.config\.[cm]?js|package(?:-lock)?\.json|eas\.json|babel\.config\.[cm]?js|metro\.config\.[cm]?js)$/.test(relative)
    || /^assets\/(icon\.png|adaptive-icon\.png|android-icon-(?:background|foreground|monochrome)\.png|snar-splash-mark\.png)$/.test(relative);
}

function plan(app, channel, projectRoot) {
  const dir = APPS[app];
  if (!dir || !['qa', 'production'].includes(channel)) throw new Error('Choose --app customer|driver and --channel qa|production.');
  const eas = JSON.parse(fs.readFileSync(path.join(projectRoot, dir, 'eas.json')));
  const profile = eas.build[channel === 'qa' ? 'qa' : 'production'];
  assertUpdateBackend(channel, profile.env.EXPO_PUBLIC_BACKEND_URL);
  if (profile.channel !== channel || profile.environment !== (channel === 'qa' ? 'preview' : 'production')) {
    throw new Error('Build profile, update channel and EAS environment disagree.');
  }
  return { dir, channel, environment: profile.environment, backend: profile.env.EXPO_PUBLIC_BACKEND_URL,
    profile: channel === 'qa' ? 'qa' : 'production' };
}

function main() {
  const { values } = parseArgs({ options: {
    app: { type: 'string' }, channel: { type: 'string' },
    'base-ref': { type: 'string' }, message: { type: 'string' }, 'dry-run': { type: 'boolean' },
  } });
  if (!values['base-ref'] || !values.message?.trim()) throw new Error('Provide --base-ref <installed-build-commit> and --message <release-description>.');
  const root = path.resolve(__dirname, '..');
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const target = plan(values.app, values.channel, root);
  const base = git(['rev-parse', '--verify', '--end-of-options', `${values['base-ref']}^{commit}`]);
  if (git(['status', '--porcelain', '--untracked-files=normal'])) throw new Error('Commit and validate the source before publishing.');
  const changed = git(['diff', '--name-only', base, 'HEAD', '--']).split('\n').filter(Boolean);
  const native = changed.filter(file => nativePath(file, target.dir));
  if (native.length) throw new Error(`A new native build is required; these files differ from the installed build:\n${native.join('\n')}`);
  const args = ['--yes', EAS_CLI, 'update', '--channel', target.channel, '--environment', target.environment,
    '--message', values.message, '--non-interactive'];
  console.log(JSON.stringify({ app: values.app, ...target, base, source: git(['rev-parse', 'HEAD']), dryRun: !!values['dry-run'] }));
  if (values['dry-run']) return;
  const result = spawnSync('npx', args, { cwd: path.join(root, target.dir), stdio: 'inherit', env: {
    ...process.env, CI: '1', EXPO_NO_DOTENV: '1', SNAR_UPDATE_CHANNEL: target.channel,
    EAS_BUILD_PROFILE: target.profile, EXPO_PUBLIC_BACKEND_URL: target.backend,
  } });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

module.exports = { nativePath, plan };
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
