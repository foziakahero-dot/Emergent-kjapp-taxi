const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {createRequire}=require('node:module');
const req=createRequire(path.resolve(__dirname,'../frontend/package.json'));
const React=req('react'),renderer=req('react-test-renderer'),ts=req('typescript');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const host=name=>({children,...props})=>React.createElement(name,props,children);
function setup(file){
  let reduced=false;const animations=[];
  class Value{constructor(n){this.value=n;}stopAnimation(){}setValue(n){this.value=n;}interpolate(config){return config;}}
  const Animated={Value,View:host('AnimatedView'),timing:(value,config)=>{const animation={...config,started:false,stopped:false,start(){this.started=true;},stop(){this.stopped=true;}};animations.push(animation);return animation;},sequence:steps=>({start(){steps.forEach(x=>x.start());},stop(){steps.forEach(x=>x.stop());}})};
  const mocks={react:React,'react/jsx-runtime':req('react/jsx-runtime'),'react-native':{Animated,Easing:{out:x=>x,cubic:x=>x}},'./VehicleAsset':{VehicleAsset:host('Vehicle')},'./Motion':{useReducedMotion:()=>reduced},'@/src/components/Motion':{useReducedMotion:()=>reduced},'@/src/components/Typography':{Text:host('Text')},'@/src/theme':{useColorTheme(){},colors:{},font:{}},'@/src/lib/format':{kr:n=>`${n} kr`}};
  const module={exports:{}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../frontend/src/components',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module,exports:module.exports,require:name=>{if(!mocks[name])throw Error(name);return mocks[name];}});
  return {...module.exports,animations,reduce:()=>reduced=true};
}
test('all car kinds share native selection motion; rapid changes stop old motion and reduced motion stays still',async()=>{
  const h=setup('V10CategoryImage.tsx');let tree;
  const render=selected=>React.createElement(h.V10CategoryImage,{kind:'trygg',selected});
  await renderer.act(async()=>{tree=renderer.create(render(false));});
  await renderer.act(async()=>tree.update(render(true)));
  assert.ok(h.animations.every(a=>a.useNativeDriver===true));
  assert.equal(h.animations.at(-1).toValue,1);assert.equal(h.animations[0].stopped,true);
  h.reduce();const count=h.animations.length;
  await renderer.act(async()=>tree.update(render(false)));
  assert.equal(h.animations.length,count);assert.equal(h.animations.at(-1).stopped,true);
  await renderer.act(async()=>tree.unmount());
});
test('price animation displays the new exact quote immediately without counting through invented prices',async()=>{
  const h=setup('BookingPrice.tsx');let tree;
  const render=amount=>React.createElement(h.BookingPrice,{amount});
  await renderer.act(async()=>{tree=renderer.create(render(219));});assert.equal(h.animations.length,0);
  await renderer.act(async()=>tree.update(render(227)));
  assert.equal(tree.root.findByType('Text').props.children,'227 kr');
  assert.equal(tree.root.findByType('Text').props.accessibilityLabel,'Pris 227 kr');
  assert.ok(h.animations.every(a=>a.started&&a.useNativeDriver));
  const count=h.animations.length;await renderer.act(async()=>tree.update(render(227)));assert.equal(h.animations.length,count);
  h.reduce();await renderer.act(async()=>tree.update(render(231)));assert.equal(h.animations.length,count);
  assert.equal(tree.root.findByType('Text').props.children,'231 kr');
  await renderer.act(async()=>tree.update(render(null)));assert.equal(tree.root.findByType('Text').props.children,'—');
  await renderer.act(async()=>tree.unmount());
});
