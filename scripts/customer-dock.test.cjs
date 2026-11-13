const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {createRequire} = require('node:module');
const req=createRequire(path.resolve(__dirname,'../frontend/package.json'));
const React=req('react'), renderer=req('react-test-renderer'), ts=req('typescript');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const host=name=>({children,...props})=>React.createElement(name,props,children);
const noop=()=>{};
class Value {stopAnimation(){} setValue(){} interpolate(){return 0;}}
const mocks={react:React,'react/jsx-runtime':req('react/jsx-runtime'),
  'react-native':{View:host('View'),Pressable:host('Pressable'),Animated:{Value,View:host('AnimatedView')},StyleSheet:{absoluteFill:{}}},
  'react-native-safe-area-context':{useSafeAreaInsets:()=>({bottom:34})},
  './Typography':{Text:host('Text')},'./V10Icon':{V10Icon:host('Icon')},
  './Motion':{useReducedMotion:()=>true},'./snar10/Glass':{Glass:host('Glass')},
  '@/src/theme/snar10':{dockBottom:n=>Math.max(22,n+6)},
  '@/src/theme':{useColorTheme:noop,colors:{},font:{}},
};
const moduleObject={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../frontend/src/components/CustomerDock.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,
  {module:moduleObject,exports:moduleObject.exports,require:name=>{if(!mocks[name])throw Error(name);return mocks[name];}});
const {CustomerDock}=moduleObject.exports;
test('Customer navigation preserves selection, press and long-press callbacks with reduced motion',async()=>{
  let tree;const selected=[],held=[];
  const items=[{id:'home',label:'Hjem',icon:'home'},{id:'history',label:'Turer',icon:'calendar'},{id:'profile',label:'Konto',icon:'profile'}];
  const render=active=>React.createElement(CustomerDock,{items,active,onSelect:id=>selected.push(id),onLongPress:id=>held.push(id)});
  await renderer.act(async()=>{tree=renderer.create(render('home'));});
  const tabs=()=>tree.root.findAll(node=>node.type==='Pressable');
  assert.deepEqual(tabs().map(node=>node.props.accessibilityRole),['tab','tab','tab']);
  assert.deepEqual(tabs().map(node=>node.props.accessibilityState.selected),[true,false,false]);
  await renderer.act(async()=>tabs()[1].props.onPress());
  await renderer.act(async()=>tabs()[2].props.onLongPress());
  assert.deepEqual(selected,['history']); assert.deepEqual(held,['profile']);
  await renderer.act(async()=>tree.update(render('history')));
  assert.deepEqual(tabs().map(node=>node.props.accessibilityState.selected),[false,true,false]);
  await renderer.act(async()=>tree.unmount());
});
