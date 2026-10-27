// Web/static QA only. Never invokes EAS, prebuild, Android, iOS or a store build.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync, execFileSync } = require('node:child_process');
const { APPROVED_QA_BACKEND, assertQaBackend } = require('./phase5-qa-build-guard.cjs');

function inspectExport(root) {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]);
  if (!scripts.length) throw Error('No entry bundle in QA export');
  return scripts.map(script => {
    if (!script.startsWith('/_expo/') || script.includes('..')) throw Error('Unexpected entry bundle path');
    const file = path.join(root, script);
    const content = fs.readFileSync(file, 'utf8');
    if (!content.includes(APPROVED_QA_BACKEND) || content.includes('https://api.kjappapp.no')) {
      throw Error('Exported entry bundle does not exclusively target the approved QA API');
    }
    return { file: script, sha256: crypto.createHash('sha256').update(content).digest('hex'), api: APPROVED_QA_BACKEND };
  });
}

function prepare() {
  const repo = path.resolve(__dirname, '..');
  const out = process.argv[2] ? path.resolve(process.argv[2]) : fs.mkdtempSync(path.join(os.tmpdir(), 'snar-final-qa-'));
  const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
  const results = [];
  assertQaBackend('qa', APPROVED_QA_BACKEND);
  for (const app of ['frontend', 'driver-app']) {
    const output = path.join(out, app);
    if (fs.existsSync(output)) throw Error('Use a fresh output directory; stale bundles must not be reused');
    const cwd = path.join(repo, app);
    const result = spawnSync(process.execPath, [path.join(cwd, 'node_modules/expo/bin/cli'), 'export', '--clear', '--platform', 'web', '--output-dir', output], {
      cwd, stdio: 'inherit', env: { ...process.env, EAS_BUILD_PROFILE: 'qa', EAS_BUILD_PLATFORM: 'web',
        EXPO_PUBLIC_BACKEND_URL: APPROVED_QA_BACKEND, EXPO_PUBLIC_SOURCE_SHA: sourceSha, EXPO_NO_TELEMETRY: '1' },
    });
    if (result.status !== 0) throw Error(`${app} web export failed`);
    results.push({ app, sourceSha, output, bundles: inspectExport(output) });
  }
  fs.writeFileSync(path.join(out, 'environment-proof.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ api: APPROVED_QA_BACKEND, sourceSha, output: out, apps: results.map(x => x.app) }));
}
module.exports = { inspectExport };
if (require.main === module) prepare();
