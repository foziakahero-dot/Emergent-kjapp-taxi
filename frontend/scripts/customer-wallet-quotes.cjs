const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),ts=require(root+'/node_modules/typescript'),React=require(root+'/node_modules/react'),renderer=require(root+'/node_modules/react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {act}=renderer;
function load(file,stubs={}){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:n=>stubs[n],setTimeout,clearTimeout,console,process:{env:{EXPO_PUBLIC_APPLE_PAY_MERCHANT_ID:'merchant.existing.test'}}});return module.exports;}
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 const {createQuotePoller}=load('src/lib/liveQuote.ts');
 let calls=0,resolve,next,active=true,quotes=[],errors=[],timers=[];
 const poller=createQuotePoller({fetchQuote:()=>{calls++;return new Promise(r=>resolve=r)},onQuote:q=>quotes.push(q),onError:e=>errors.push(e),active:()=>active,clock:{set:fn=>(next=fn,timers.push(fn),fn),clear:()=>{next=null}}});
 await poller.refresh();assert.equal(calls,1,'No overlapping request');
 resolve({price:100});await tick();assert.equal(quotes.length,1);
 active=false;await next();assert.equal(calls,1,'Background does not fetch');
 active=true;void poller.refresh();assert.equal(calls,2);poller.stop();resolve({price:200});await tick();assert.equal(quotes.length,1,'Stopped route rejects stale quote');
 let fail=false,last,failed=0;
 const p=createQuotePoller({fetchQuote:async()=>{if(fail)throw Error('offline');return {price:100}},onQuote:q=>last=q,onError:()=>failed++,active:()=>true,clock:{set:fn=>(next=fn,fn),clear:()=>{}}});await tick();fail=true;await p.refresh();assert.equal(last.price,100,'Retain last quote on error');assert.equal(failed,1);p.stop();
 console.log('PASS quote refresh: no overlap, paused background, stale route reply ignored and previous price retained on network failure.');
 let state,platform='android',config={enabled:true,test_mode:true,publishable_key:'pk_test_fixture',google_pay_enabled:true},supported=true,result={},verified={ready:true,verified:true,card:{id:'card_1'}},setupCalls=0,defaults=0,saved=0,confirmArgs;
 const sdk={initStripe:async()=>{},isPlatformPaySupported:async()=>supported,PlatformPay:{PaymentType:{Immediate:'Immediate'}},confirmPlatformPaySetupIntent:async(...args)=>(confirmArgs=args,result)};
 const api={nativeConfig:async()=>config,nativeSetup:async()=>{setupCalls++;return {client_secret:'seti_fixture_secret',setup_intent_id:'seti_fixture'}},nativeSetupStatus:async()=>verified,makeDefault:async()=>{defaults++;return {selected:true}}};
 const native={get Platform(){return {OS:platform}}};
 const {usePlatformWallet}=load('src/lib/usePlatformWallet.native.ts',{react:React,'react-native':native,'@stripe/stripe-react-native':sdk,'./api':{paymentApi:api},'./format':{apiError:e=>e.message}});
 function Host({id='a'}){state=usePlatformWallet(id,async()=>saved++);return null;}
 let tree;await act(async()=>{tree=renderer.create(React.createElement(Host));});assert.equal(state.ready,true);
 await act(async()=>{const first=state.addWallet();const duplicate=state.addWallet();await Promise.all([first,duplicate]);});assert.equal(setupCalls,1);assert.equal(defaults,1);assert.equal(saved,1);assert.equal(confirmArgs[1].googlePay.testEnv,true);
 result={error:{code:'Canceled',message:'cancel'}};await act(async()=>state.addWallet());assert.equal(defaults,1);assert.equal(state.error,'');
 result={};verified={ready:false};await act(async()=>state.addWallet());assert.equal(defaults,1);assert.match(state.error,/ikke bekreftet/);
 await act(async()=>tree.unmount());
 platform='ios';config={...config,apple_merchant_id:''};await act(async()=>{tree=renderer.create(React.createElement(Host));});assert.equal(state.ready,false,'Apple requires signed merchant entitlement');await act(async()=>tree.unmount());
 platform='android';config={...config,publishable_key:'pk_live_fixture'};await act(async()=>{tree=renderer.create(React.createElement(Host));});assert.equal(state.ready,false,'Mismatched Stripe mode cannot launch wallet');await act(async()=>tree.unmount());
 console.log('PASS native wallet: capability gate, SetupIntent verification before selection, shared double-tap lock, neutral cancellation, no unverified card, merchant entitlement and Stripe mode gates. SDK calls are mocked; device acceptance is still required.');
})().catch(e=>{console.error(e);process.exitCode=1});
