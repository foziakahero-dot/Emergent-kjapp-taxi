const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + '/playwright' : 'playwright');
const root = path.resolve(process.env.QA_DIST || path.join(__dirname, '../../marketing-web/dist'));
const screenshotDir = path.resolve(process.env.QA_OUTPUT_DIR || path.join(__dirname, 'screenshots'));
fs.mkdirSync(screenshotDir, { recursive: true });
const server = http.createServer((req, res) => {
  let filename = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(filename) || fs.statSync(filename).isDirectory()) filename = path.join(root, 'index.html');
  res.setHeader('Content-Type', ({ '.html':'text/html', '.css':'text/css', '.js':'application/javascript', '.svg':'image/svg+xml', '.png':'image/png', '.woff2':'font/woff2' })[path.extname(filename)] || 'application/octet-stream');
  res.end(fs.readFileSync(filename));
});
const results = { responsive: [], routes: [], checks: [], screenshots: [], pageErrors: [], assetErrors: [], accessibility: [] };
function check(name, pass, detail) { results.checks.push({ name, pass:!!pass, detail }); if (!pass) console.log('FAIL', name, detail); }
async function screenshot(page, name) {
  await page.screenshot({ path:path.join(screenshotDir, name+'.png') });
  results.screenshots.push(name+'.png');
}
async function fillForm(page) {
  await page.getByLabel('Navn', {exact:true}).fill('SNAR QA');
  await page.getByLabel('Telefon', {exact:true}).fill('00000000');
  await page.getByLabel(/E-post/).fill('qa@example.invalid');
  await page.getByLabel('By', {exact:true}).fill('Oslo');
}
(async () => {
  await new Promise(resolve => server.listen(8877, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath:process.env.QA_CHROME || chromium.executablePath(), headless:true, args:['--no-sandbox', ...(process.env.QA_PROXY_SPKI ? ['--ignore-certificate-errors-spki-list='+process.env.QA_PROXY_SPKI] : [])], ...(process.env.QA_BROWSER_PROXY ? {proxy:{server:process.env.QA_BROWSER_PROXY}} : {}) });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('pageerror', error => results.pageErrors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && !response.url().includes('/api/')) results.assetErrors.push({url:response.url(),status:response.status()}); });
  const base = process.env.QA_BASE_URL || 'http://127.0.0.1:8877';
  await page.goto(base);
  await page.getByRole('button', {name:'Avvis',exact:true}).click().catch(()=>{});
  await page.evaluate(()=>document.fonts.ready);
  for (const width of [320,375,390,430,768,1024,1280,1440,1920,2560]) {
    await page.setViewportSize({width,height:900});
    await page.goto(base);
    await page.evaluate(()=>document.fonts.ready);
    await page.locator('.snar-product-preview').evaluate(node=>Promise.all(node.getAnimations().map(x=>x.finished.catch(()=>{}))));
    const metrics = await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,font:getComputedStyle(document.body).fontFamily,brokenImages:[...document.images].filter(x=>x.complete&&!x.naturalWidth).map(x=>x.src),visibleCtas:[...document.querySelectorAll('.snar-header button')].filter(x=>x.getClientRects().length).map(x=>x.textContent)}));
    results.responsive.push(metrics);
    check('No overflow '+width,metrics.scrollWidth === width,metrics);
    check('No missing images '+width,metrics.brokenImages.length===0,metrics.brokenImages);
    const cta=page.getByRole('button',{name:/Få tilgang til beta/}).filter({visible:true}).first();
    const focusedTrigger = await cta.elementHandle();
    await cta.click();
    const bounds = await page.getByRole('dialog').boundingBox();
    check('Modal fits '+width,bounds&&bounds.x>=0&&bounds.x+bounds.width<=width+1&&bounds.y>=0&&bounds.y+bounds.height<=901,bounds);
    await page.keyboard.press('Escape');
    await page.waitForFunction(el => el === document.activeElement, focusedTrigger, {timeout:1000}).catch(()=>{});
    check('Focus return '+width,await focusedTrigger.evaluate(x=>x===document.activeElement),await page.evaluate(()=>document.activeElement.outerHTML));
    if(width===1440){await page.locator('h1').click();await screenshot(page,'desktop-hero');await page.locator('#vehicles').scrollIntoViewIfNeeded();await screenshot(page,'desktop-mid-page');await page.locator('footer').scrollIntoViewIfNeeded();await screenshot(page,'desktop-footer');}
    if(width===390){await page.evaluate(()=>window.scrollTo(0,0));await screenshot(page,'mobile-hero');await page.locator('.snar-product-preview').scrollIntoViewIfNeeded();await screenshot(page,'mobile-product');await cta.click();await screenshot(page,'mobile-waitlist');await page.keyboard.press('Escape');}
  }
  await page.setViewportSize({width:390,height:900});
  await page.goto(base);
  await page.getByRole('button',{name:'Meny',exact:true}).click();
  check('Mobile menu expanded',await page.getByRole('button',{name:'Lukk',exact:true}).getAttribute('aria-expanded')==='true');
  await page.keyboard.press('Escape');
  check('Menu closes with Escape',await page.getByRole('button',{name:'Meny',exact:true}).getAttribute('aria-expanded')==='false');
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(base);
  await page.getByRole('navigation',{name:'Hovedmeny'}).getByRole('link',{name:'Bilvalg',exact:true}).click();
  check('Hash navigation',await page.evaluate(()=>location.hash==='#vehicles'&&document.getElementById('vehicles').getBoundingClientRect().top>=0));
  for(const route of ['/loyvehaver','/loyvehaver/soknad','/help','/personvern','/vilkar']){
    for(const width of [320,1440]){
      await page.setViewportSize({width,height:900});await page.goto(base+route);
      results.routes.push({route,width,heading:await page.locator('h1').innerText(),scrollWidth:await page.evaluate(()=>document.documentElement.scrollWidth),canonical:await page.locator('link[rel=canonical]').getAttribute('href')});
      check(route+' no overflow '+width,await page.evaluate(()=>innerWidth===document.documentElement.scrollWidth));
      await page.addScriptTag({path:process.env.QA_AXE_SCRIPT || require.resolve('axe-core/axe.min.js')});
      const scan=await page.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));});
      results.accessibility.push({route,width,violations:scan});
    }
  }
  await page.goto(base);await page.setViewportSize({width:390,height:900});
  let submissions=[];
  await page.route('**/api/waitlist',async route=>{submissions.push(route.request().postDataJSON());await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({detail:'Test: midlertidig serverfeil'})});});
  await page.getByRole('button',{name:/Få tilgang til beta/}).filter({visible:true}).first().click();
  await page.getByRole('button',{name:'Meld interesse',exact:true}).click();
  check('Empty form blocked',submissions.length===0);
  await page.addScriptTag({path:process.env.QA_AXE_SCRIPT || require.resolve('axe-core/axe.min.js')});
  results.accessibility.push({route:'waitlist-modal',width:390,violations:await page.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));})});
  await fillForm(page);await page.getByRole('button',{name:'Meld interesse',exact:true}).click();
  check('Consent required',submissions.length===0&&(await page.getByRole('alert').innerText()).includes('Bekreft'));
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Meld interesse',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'Test: midlertidig serverfeil'}).waitFor();
  check('Server detail shown',await page.getByRole('alert').innerText()==='Test: midlertidig serverfeil');
  check('Payload unchanged',JSON.stringify(Object.keys(submissions[0]).sort())===JSON.stringify(['name','phone','email','city','role','website'].sort()));
  await page.unroute('**/api/waitlist');
  await page.route('**/api/waitlist',route=>route.fulfill({status:200,contentType:'text/html',body:'<html>SPA fallback</html>'}));
  await page.getByRole('button',{name:'Meld interesse',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'Registreringen ble ikke bekreftet'}).waitFor();
  check('HTML cannot fake success',await page.getByRole('status').count()===0);
  await page.unroute('**/api/waitlist');
  await page.route('**/api/waitlist',async route=>{await new Promise(resolve=>setTimeout(resolve,350));await route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({ok:true,status:'registered'})});});
  await page.getByRole('button',{name:'Meld interesse',exact:true}).click();
  await page.getByRole('status').waitFor();
  check('Confirmed success focus',await page.getByRole('button',{name:'Ferdig',exact:true}).evaluate(x=>x===document.activeElement));
  await page.getByRole('button',{name:'Ferdig',exact:true}).click();
  check('Dialog dismissed',await page.getByRole('dialog').count()===0);
  await page.addScriptTag({path:process.env.QA_AXE_SCRIPT || require.resolve('axe-core/axe.min.js')});
  results.accessibility.push({route:'/',width:390,violations:await page.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));})});
  await page.emulateMedia({reducedMotion:'reduce'});
  check('Reduced motion',await page.locator('.snar-product-preview').evaluate(x=>getComputedStyle(x).animationName)==='none');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto(base);
  check('Cookie preference retained',await page.evaluate(()=>localStorage.getItem('kjapp_marketing_consent_v1')==='rejected')&&await page.locator('.mk-cookie-banner').count()===0);
  const anchors=await page.locator('a[href]').evaluateAll(nodes=>nodes.map(n=>({text:n.textContent.trim(),href:n.getAttribute('href')})));
  const linksValid=await page.evaluate(()=>[...document.querySelectorAll('a[href]')].every(a=>{const u=new URL(a.href);if(u.origin!==location.origin)return ['mailto:','http:','https:'].includes(u.protocol);return ['/', '/loyvehaver','/loyvehaver/soknad','/help','/personvern','/vilkar'].includes(u.pathname)&&(!u.hash||!!document.querySelector(u.hash));}));
  check('Homepage and footer links have valid targets',linksValid,anchors);
  await page.getByRole('button',{name:/Få tilgang til beta/}).filter({visible:true}).first().click();
  await page.getByLabel('Navn',{exact:true}).waitFor();
  await page.waitForFunction(()=>document.activeElement?.getAttribute('autocomplete')==='name');
  const focusables=page.getByRole('dialog').locator('button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href]').filter({visible:true});
  const last=focusables.last(),first=focusables.first();
  await last.focus();await page.keyboard.press('Tab');
  check('Tab wraps inside dialog',await first.evaluate(x=>x===document.activeElement));
  await page.keyboard.press('Shift+Tab');
  check('Reverse Tab wraps inside dialog',await last.evaluate(x=>x===document.activeElement),await page.evaluate(()=>document.activeElement.outerHTML));
  await page.keyboard.press('Escape');
  for(const width of [320,1440]){
    await page.setViewportSize({width,height:900});
    await page.route('**/api/trips/share/**',route=>route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({detail:'Delingslenken er utløpt eller ugyldig'})}));
    await page.goto(base+'/tur/qa-invalid-token');
    await page.getByRole('heading',{name:'Lenken er ikke tilgjengelig'}).waitFor();
    check('Shared trip unavailable state '+width,await page.evaluate(()=>innerWidth===document.documentElement.scrollWidth));
    await page.addScriptTag({path:process.env.QA_AXE_SCRIPT || require.resolve('axe-core/axe.min.js')});
    const scan=await page.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));});
    results.accessibility.push({route:'/tur/qa-invalid-token',width,violations:scan});
    await page.unroute('**/api/trips/share/**');
  }
  check('No runtime JS errors',results.pageErrors.length===0,results.pageErrors);
  check('No failed assets',results.assetErrors.length===0,results.assetErrors);
  await browser.close();server.close();
  fs.writeFileSync(path.join(__dirname,'qa-results.json'),JSON.stringify(results,null,2));
  if (results.checks.some(check => !check.pass) || results.accessibility.some(scan => scan.violations.length)) process.exitCode = 1;
  console.log(JSON.stringify({checks:results.checks.length,failed:results.checks.filter(x=>!x.pass),accessibility:results.accessibility.map(x=>({route:x.route,width:x.width,violations:x.violations.map(v=>v.id)})),screenshots:results.screenshots},null,2));
})().catch(error=>{fs.writeFileSync(path.join(__dirname,'qa-error.txt'),error.stack);console.error(error);server.close();process.exit(1)});
