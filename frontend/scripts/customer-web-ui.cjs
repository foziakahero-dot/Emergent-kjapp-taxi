// Local browser fixture test of the exported app; every API response is intercepted.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const runtime = process.env.CUSTOMER_SCREENSHOT_DIR;
const preview = process.env.CUSTOMER_WEB_EXPORT_DIR || path.resolve(__dirname, '../dist');
if(runtime)fs.mkdirSync(runtime,{recursive:true});
const screenshot = (page,name) => runtime ? page.screenshot({path:path.join(runtime,name)}) : Promise.resolve();
(async () => {
 const server=http.createServer((req,res)=>{
  let file=path.join(preview,decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!fs.existsSync(file)||!fs.statSync(file).isFile())file=path.join(preview,'index.html');
  const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.ttf':'font/ttf','.woff2':'font/woff2'};
  res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
 });
 await new Promise(resolve=>server.listen(8765,'127.0.0.1',resolve));
 const browser = await chromium.launch({headless:true, ...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-software-rasterizer','--no-zygote']});
 try {
  const context = await browser.newContext({ viewport:{width:390,height:844},permissions:['geolocation'],geolocation:{latitude:59.9139,longitude:10.7522},reducedMotion:'reduce' });
  await context.addInitScript(() => localStorage.setItem('kjapp_token','local-fixture-only'));
  let fareIncrement=0, noCars=false, offlineCars=false;
  const errors=[];const page=await context.newPage();await page.clock.install();page.on('pageerror',error=>errors.push(error.stack));
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname.startsWith('/api/')){
    if(url.pathname==='/api/cars/nearby'&&offlineCars)return route.fulfill({status:503,body:'unavailable'});
    const now=new Date().toISOString();
    let data={};
    if(url.pathname==='/api/auth/me')data={id:'local-customer',email:'fixture@example.invalid',role:'user',fullName:'SNAR Test',legal_accepted:true};
    else if(url.pathname==='/api/trips/active')data=null;
    else if(url.pathname==='/api/trips')data=[];
    else if(url.pathname==='/api/me/places')data={places:[{id:'saved-test',label:'Oslo S',name:'Oslo S',lat:59.9108,lng:10.7535}]};
    else if(url.pathname==='/api/places')data={places:[]};
    else if(url.pathname==='/api/payment-methods')data=[];
    else if(url.pathname==='/api/places/reverse')data={label:'Testhentested'};
    else if(url.pathname==='/api/places/search')data={results:[{name:'Oslo S',lat:59.9108,lng:10.7535}]};
    else if(url.pathname==='/api/cars/nearby')data={server_time:now,gps_fresh_seconds:60,cars:noCars?[]:[
     {id:'fixture-driver-1',type:'ai-first',lat:59.917,lng:10.760,eta_min:3,updated_at:now},
     {id:'fixture-driver-2',type:'premium',lat:59.91,lng:10.749,eta_min:4,updated_at:now}]};
    else if(url.pathname==='/api/trips/estimate')data={duration_min:11,distance_km:3,pricing_version:1,geometry:{coordinates:[[10.7522,59.9139],[10.7535,59.9108]]},options:['ai-first','enkelt','trygg','premium'].map((vehicle_type,i)=>({vehicle_type,price:150+i*50+fareIncrement,waiting_policy:{token:'fixture',free_minutes:2,per_minute:4,max_fee:50}}))};
    return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});
   }
   return url.origin==='http://127.0.0.1:8765'?route.continue():route.abort();
  });
  await page.goto('http://127.0.0.1:8765/home');
  await page.getByTestId('home-driver-status').getByText('2 ledige sjåfører · Live').waitFor({timeout:10000}).catch(async error=>{
   console.log(JSON.stringify({body:await page.locator('body').innerText(),errors}));
   await screenshot(page,'customer-web-failure.png');throw error;
  });
  await screenshot(page,'customer-home-after.png');
  await page.getByTestId('home-browse-sheet-toggle').click();
  await page.getByTestId('home-browse-sheet-toggle').getByText('Vis',{exact:true}).waitFor();
  await page.getByTestId('home-browse-sheet-toggle').click();
  await page.getByTestId('home-where-to').click();
  await page.getByTestId('search-input').fill('Oslo');
  await page.getByTestId('search-sheet-toggle').click();
  await page.getByTestId('search-sheet-toggle').click();
  assert.equal(await page.getByTestId('search-input').inputValue(),'Oslo');
  await page.getByTestId('search-close').click();
  await page.getByTestId('quick-Oslo S').click();
  await page.getByTestId('route-choose-vehicle').click();
  await page.getByTestId('vehicle-enkelt').waitFor();
  await page.locator('[data-testid^="vehicle-"] img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
  fareIncrement=25;
  await page.clock.fastForward(31000);
  await page.getByTestId('vehicle-ai-first').getByText('175 kr',{exact:true}).waitFor();
  await page.getByTestId('vehicle-ai-first').getByTestId('price-updated').waitFor();
  noCars=true;await page.clock.fastForward(2500);
  await page.getByTestId('vehicle-availability').getByText('Ingen biler tilgjengelig nær hentestedet akkurat nå.').waitFor();
  offlineCars=true;await page.clock.fastForward(2500);
  await page.getByTestId('vehicle-availability').getByText('Kan ikke oppdatere ledige biler. Sjekk forbindelsen.').waitFor();
  offlineCars=false;noCars=false;await page.clock.fastForward(2500);
  await screenshot(page,'customer-vehicles-after.png');
  await page.getByTestId('vehicle-enkelt').click();
  await page.getByTestId('home-ride-sheet-toggle').click();
  await screenshot(page,'customer-minimized-after.png');
  await page.getByTestId('home-ride-sheet-toggle').click();
  assert.equal(await page.getByTestId('vehicle-enkelt').getAttribute('aria-checked'),'true');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.setViewportSize({width:360,height:640});
  assert((await page.getByTestId('home-ride-sheet').boundingBox()).height<=449);
  await page.getByTestId('home-ride-sheet-toggle').click();
  await page.getByTestId('home-ride-sheet-toggle').getByText('Vis',{exact:true}).waitFor();
  await page.setViewportSize({width:844,height:390});
  await page.goto('http://127.0.0.1:8765/home');
  await page.getByTestId('home-driver-status').getByText('2 ledige sjåfører · Live').waitFor();
  const badge=await page.getByTestId('home-driver-status').boundingBox();
  const tools=await page.getByTestId('home-nearby-drivers').boundingBox();
  assert(tools.x>=badge.x+badge.width||tools.y>=badge.y+badge.height,'Tools must not cover driver status');
  assert((await page.getByTestId('home-browse-sheet').boundingBox()).height<=118);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);
  console.log('PASS exported app at 390px, 360px and landscape: live driver badge, Home/search/vehicle minimize, preserved typed query and category, bundled 3D art; no browser runtime errors. All API data are local fixtures.');
  await context.close();
 } finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
