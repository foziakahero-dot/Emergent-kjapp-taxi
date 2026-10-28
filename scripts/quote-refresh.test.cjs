const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const ts = require('../frontend/node_modules/typescript');
function setup(fetch) {
  let now = 0, next = 0; const timers = new Map(), quotes = [], errors = [];
  const module = {exports:{}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('frontend/src/lib/quoteRefresh.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,
    {module,exports:module.exports,setTimeout:(fn,delay)=>{timers.set(++next,{fn,at:now+delay});return next;},clearTimeout:id=>timers.delete(id)});
  const state={blocked:false,stale:0};
  const controller=module.exports.startQuoteRefresh({active:true,fetch,publish:q=>quotes.push(q),fail:e=>errors.push(e),stale:()=>state.stale++,blocked:()=>state.blocked});
  return {controller,quotes,errors,state,flush:async()=>{await Promise.resolve();await Promise.resolve();},tick:async ms=>{
    now+=ms; for(const [id,t] of [...timers]) if(t.at<=now){timers.delete(id);t.fn();} await Promise.resolve();await Promise.resolve();
  }};
}
test('refreshes real quotes sequentially, pauses in background and refreshes on resume',async()=>{
  let calls=0,resolve; const h=setup(()=>{calls++;return new Promise(r=>resolve=r);});
  assert.equal(calls,1);await h.tick(60000);assert.equal(calls,1);
  resolve({price:249});await h.flush();assert.equal(h.quotes[0].price,249);
  await h.tick(30000);assert.equal(calls,2);resolve({price:259});await h.flush();
  h.controller.setActive(false);await h.tick(90000);assert.equal(calls,2);
  h.controller.setActive(true);assert.equal(calls,3);resolve({price:269});await h.flush();
  assert.equal(h.quotes.at(-1).price,269);h.controller.stop();
});
test('disposal suppresses a late response from a previous route',async()=>{
  let resolve;const h=setup(()=>new Promise(r=>resolve=r));h.controller.stop();resolve({price:1});await h.flush();assert.equal(h.quotes.length,0);
});
test('failed refresh invalidates quote and retries; a hung refresh expires the old quote',async()=>{
  let calls=0;const h=setup(()=>++calls===1?Promise.resolve({price:249}):calls===2?Promise.reject(Error('offline')):new Promise(()=>{}));
  await h.flush();await h.tick(30000);assert.equal(h.errors.length,1);assert.ok(h.state.stale>0);
  await h.tick(30000);assert.equal(calls,3);assert.ok(h.state.stale>=2);h.controller.stop();
});
test('refresh never replaces a quote while a booking is being submitted',async()=>{
  let resolve;const h=setup(()=>new Promise(r=>resolve=r));h.state.blocked=true;resolve({price:999});await h.flush();assert.equal(h.quotes.length,0);h.controller.stop();
});
