const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), vm=require('node:vm');
const root=path.resolve(__dirname,'..'), React=require(root+'/node_modules/react'), renderer=require(root+'/node_modules/react-test-renderer'), ts=require(root+'/node_modules/typescript');
global.IS_REACT_ACT_ENVIRONMENT=true;
let fonts=false, reads=0, failRead=false, hideCalls=0, now=0, next=0;
const timers=new Map(), cache=new Map();
const pass=({children})=>React.createElement(React.Fragment,null,children), Stack=pass;Stack.Screen='StackScreen';
const stubs={
 'react':React,'react/jsx-runtime':require(root+'/node_modules/react/jsx-runtime'),
 'react-native':{View:'View',Text:'Text',Pressable:'Pressable',StyleSheet:{absoluteFill:{position:'absolute'}}},
 'expo-font':{useFonts:()=>[fonts,null]},'expo-status-bar':{StatusBar:'StatusBar'},
 'expo-splash-screen':{preventAutoHideAsync:async()=>{},hideAsync:async()=>{hideCalls++}},
 'react-native-gesture-handler':{GestureHandlerRootView:pass},'react-native-safe-area-context':{SafeAreaProvider:pass},
 '@tanstack/react-query':{QueryClient:class{},QueryClientProvider:pass},'expo-router':{Stack,router:{push(){}}},
 'expo-notifications':{getLastNotificationResponseAsync:async()=>null,addNotificationResponseReceivedListener:()=>({remove(){}})},
 '@/src/components/SplashArt':{LaunchSplash:'LaunchSplash'},'@/src/components/Motion':{useReducedMotion:()=>false},
 '@/src/components/GlobalCustomerShell':{GlobalCustomerShell:pass},'@/src/components/NativePaymentProvider':{NativePaymentProvider:pass},
 '@/src/theme':{colors:{surfaceInverse:'#0B1A2C'},FONT_ASSETS:{},useColorTheme:()=>({effective:'light'})},
 '@/src/lib/errorMonitoring':{installClientErrorMonitor:()=>()=>{}},
 '@/src/lib/nativeRuntime':{registerNativePush:async()=>{},unregisterNativePush:async()=>{},normalizeCustomerNotificationUrl:()=>null},
 '@/src/lib/socialSignIn':{googleIdentity:async()=>null,appleIdentity:async()=>null},
 '@/src/utils/storage':{storage:{getItem:async()=>{reads++;if(failRead)throw Error('Storage failure');return null},removeItem:async()=>{}}},
 '@/src/lib/api':{TOKEN_KEY:'synthetic',authApi:{}},
};
function load(file){
 if(cache.has(file))return cache.get(file);
 const module={exports:{}};cache.set(file,module.exports);
 const compiled=ts.transpileModule(fs.readFileSync(root+'/'+file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 vm.runInNewContext(compiled,{module,exports:module.exports,require:name=>{if(stubs[name])return stubs[name];if(name.startsWith('@/'))return load(name.slice(2)+'.tsx');throw Error(name)},setTimeout:(fn,ms)=>{const id=++next;timers.set(id,{fn,at:now+ms});return id},clearTimeout:id=>timers.delete(id)});
 cache.set(file,module.exports);return module.exports;
}
async function advance(ms){now+=ms;await renderer.act(async()=>{for(const [id,job] of [...timers])if(job.at<=now){timers.delete(id);job.fn()}})}
(async()=>{
 const Root=load('app/_layout.tsx').default;let tree;
 await renderer.act(async()=>{tree=renderer.create(React.createElement(Root))});
 assert.equal(reads,1,'Session restoration starts before the font/splash gate finishes');
 assert.equal(tree.root.findAllByProps({testID:'launch-overlay'}).length,1);
 await advance(1600);assert.equal(tree.root.findAllByProps({testID:'launch-overlay'}).length,1);
 fonts=true;await renderer.act(async()=>tree.update(React.createElement(Root)));
 assert.equal(tree.root.findAllByProps({testID:'launch-overlay'}).length,0);assert.equal(reads,1);assert.ok(hideCalls>0);
 await renderer.act(async()=>tree.unmount());assert.equal(timers.size,0);
 fonts=false;failRead=true;
 await renderer.act(async()=>{tree=renderer.create(React.createElement(Root))});
 await advance(5000);
 assert.equal(tree.root.findAllByProps({testID:'launch-overlay'}).length,0,'A stalled font loader cannot hold the splash forever');
 assert.equal(tree.root.findAllByProps({testID:'session-retry'}).length,1,'Storage/session failures expose a retry instead of hanging');
 await renderer.act(async()=>tree.unmount());assert.equal(timers.size,0);
 console.log('PASS: actual Root/AuthProvider starts session restore in parallel; font stall deadline, visible storage failure retry and timer cleanup');
})().catch(error=>{console.error(error);process.exitCode=1});
