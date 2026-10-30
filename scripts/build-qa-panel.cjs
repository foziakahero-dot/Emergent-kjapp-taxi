// Export an isolated QA web panel for a Vercel preview, without production config.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const panel = process.argv[2];
if (!['admin-web', 'fleet-web'].includes(panel)) throw new Error('Expected admin-web or fleet-web');
const root = path.resolve(__dirname, '..');
const cwd = path.join(root, panel);
const fleetOrigin = 'https://snar-fleet-git-qa-snar-v10-phase5-staging-e2e-snar1.vercel.app';
const env = { ...process.env, VITE_APP_ENV: 'qa', VITE_API_BASE: '/api', VITE_PUBLIC_SITE_URL: process.env.VITE_PANEL_BASE ? 'https://api-qa.snarapp.no/api/qa-fleet' : fleetOrigin };
execFileSync('npm', ['run', 'build'], { cwd, env, stdio: 'inherit' });
const out = path.join(root, 'artifacts', 'phase5-qa', panel);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.cpSync(path.join(cwd, 'dist'), out, { recursive: true });
// Fleet's public folder contains a production Netlify proxy. Exclude it entirely.
for (const name of ['_redirects', '_headers', 'netlify.toml']) fs.rmSync(path.join(out, name), { force: true });
fs.writeFileSync(path.join(out, 'vercel.json'), JSON.stringify({
  version: 2,
  framework: null,
  buildCommand: '',
  installCommand: '',
  outputDirectory: '.',
  rewrites: [
    { source: '/api/:path*', destination: 'https://api-qa.snarapp.no/api/:path*' },
    { source: '/((?!api/|assets/).*)', destination: '/index.html' },
  ],
  headers: [
    { source: '/(.*)', headers: [
      { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'same-origin' },
    ] },
    { source: '/api/(.*)', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
  ],
}, null, 2) + '\n');
fs.writeFileSync(path.join(out, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
const index = path.join(out, 'index.html');
fs.writeFileSync(index, fs.readFileSync(index, 'utf8').replace(/<title>(.*?)<\/title>/, '<title>$1 · QA</title>'));
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
fs.writeFileSync(path.join(out, 'qa-release.json'), JSON.stringify({ panel, environment: 'qa', api: 'https://api-qa.snarapp.no', commit }, null, 2) + '\n');
console.log('QA panel artifact: ' + out);
