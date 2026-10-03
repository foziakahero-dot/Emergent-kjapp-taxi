/** Rasterize the original Make SVG paths; no generated or approximated glyphs. */
const { createRequire } = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const projectRequire = createRequire(path.join(root, 'frontend/package.json'));
const React = projectRequire('react');
const { renderToStaticMarkup } = projectRequire('react-dom/server');
const ts = projectRequire('typescript');
const sharp = projectRequire('sharp');
const source = fs.readFileSync(path.join(root, 'design/figma-make-20260930/src/components/AppIcons.tsx'), 'utf8');
const moduleResult = { exports: {} };
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
vm.runInNewContext(compiled, { module: moduleResult, exports: moduleResult.exports, require: projectRequire });
const { CustomerAppIcon, DriverAppIcon } = moduleResult.exports;
(async () => {
  for (const [app, Icon, background] of [['frontend', CustomerAppIcon, '#FF0000'], ['driver-app', DriverAppIcon, '#001F3F']]) {
    const asset = name => path.join(root, app, 'assets', name);
    const svg = renderToStaticMarkup(React.createElement(Icon));
    fs.writeFileSync(asset('figma-store-icon.svg'), svg + '\n');
    // Stores apply their own icon masks. Fill corner transparency for valid opaque iOS assets.
    await sharp(Buffer.from(svg)).flatten({ background }).resize(1024, 1024).png().toFile(asset('icon.png'));
    await sharp(Buffer.from(svg)).flatten({ background }).resize(64, 64).png().toFile(asset('favicon.png'));
    const ribbon = svg.match(/<path[^>]+>(?:<\/path>)?/)[0];
    const defs = svg.match(/<defs>.*?<\/defs>/)[0];
    // Android adaptive foreground keeps the exact source path inside the OS safe zone.
    const foreground = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${defs}${ribbon}</svg>`;
    fs.writeFileSync(asset('figma-adaptive-foreground.svg'), foreground + '\n');
    await sharp(Buffer.from(foreground)).resize(1024, 1024).png().toFile(asset('adaptive-icon.png'));
    const mono = foreground.replace(/stroke="url\(#[^)]+\)"/, 'stroke="#FFFFFF"');
    await sharp(Buffer.from(mono)).resize(1024, 1024).png().toFile(asset('android-icon-monochrome.png'));
    // Native launch screen uses the same 104 px squircle as the animated splash.
    const dx = Math.sin(145 * Math.PI / 180), dy = -Math.cos(145 * Math.PI / 180), length = dx + dy;
    const badge = `<svg xmlns="http://www.w3.org/2000/svg" width="104" height="104" viewBox="0 0 104 104"><defs><linearGradient id="badge" x1="${(0.5 - dx * length / 2) * 100}%" y1="${(0.5 - dy * length / 2) * 100}%" x2="${(0.5 + dx * length / 2) * 100}%" y2="${(0.5 + dy * length / 2) * 100}%"><stop offset="0" stop-color="#FF3B3B"/><stop offset=".55" stop-color="#FF0000"/><stop offset="1" stop-color="#B30000"/></linearGradient></defs><rect width="104" height="104" rx="29.12" fill="url(#badge)"/><g transform="translate(24.96 24.96) scale(2.2533333333333334)" fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5l7 7-7 7" stroke="rgba(255,255,255,0.55)"/><path d="M12 5l7 7-7 7" stroke="#FFFFFF"/></g></svg>`;
    fs.writeFileSync(asset('figma-splash-mark.svg'), badge + '\n');
    await sharp(Buffer.from(badge)).resize(416, 416).png().toFile(asset('splash-icon.png'));
    const configPath = path.join(root, app, 'app.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    config.expo.android.adaptiveIcon.backgroundColor = background;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  }
  console.log('Exported original Customer/Driver icons, adaptive and monochrome foregrounds, favicons and launch marks.');
})().catch(error => { console.error(error); process.exitCode = 1; });
