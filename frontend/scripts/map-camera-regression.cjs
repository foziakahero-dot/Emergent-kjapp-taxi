const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
const ts = require(root + '/node_modules/typescript');
const React = require(root + '/node_modules/react');
const renderer = require(root + '/node_modules/react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN = 'unit-map-token';
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, file);
const calls = [];
const Camera = React.forwardRef((props, ref) => {
  React.useImperativeHandle(ref, () => ({ fitBounds: (...args) => calls.push({ bounds: args }), setCamera: config => calls.push({ config }) }));
  return React.createElement('Camera', props);
});
const old = Module._load;
Module._load = function (id, parent, isMain) {
  if (id === 'react' || id === 'react/jsx-runtime') return old.call(this, root + '/node_modules/' + id, parent, isMain);
  if (id === 'react-native') return { View: 'View', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator' };
  if (id === '@rnmapbox/maps') return { __esModule: true, default: { setAccessToken() {} }, Camera, MapView: 'MapView', MarkerView: 'MarkerView', ShapeSource: 'ShapeSource', LineLayer: 'LineLayer', StyleImport: 'StyleImport' };
  if (id === 'react-native-svg') return { __esModule: true, default: 'Svg', Circle: 'Circle', Ellipse: 'Ellipse', Rect: 'Rect' };
  if (id === '@/src/lib/mapFocus') return old.call(this, root + '/src/lib/mapFocus.ts', parent, isMain);
  if (id === '@/src/theme') return { colors: {}, font: {}, useColorTheme: () => ({ effective: 'light' }) };
  if (id === './useSmoothPosition') return { useSmoothPosition: p => p };
  if (id === './RasterMap') return { InteractiveMap: 'RasterMap' };
  if (id === './Typography') return { Text: 'Text' };
  if (id === './Icon') return { Icon: 'Icon' };
  if (id === '@/src/components/MapMarkers') return { MapCar: 'MapCar', PositionDot: 'PositionDot' };
  return old.call(this, id, parent, isMain);
};
(async () => {
  const { MapboxInteractiveMap } = require(root + '/src/components/MapboxMap.native.tsx');
  const props = { testID: 'map', pickup: { lat: 59.91, lng: 10.75 }, cars: [{ id: 'live', lat: 59.94, lng: 10.82 }], focusMode: 'nearby', contentInsets: { top: 160, right: 48, bottom: 440, left: 48 } };
  let app;
  await renderer.act(async () => { app = renderer.create(React.createElement(MapboxInteractiveMap, props)); });
  await renderer.act(async () => {
    app.root.findByProps({ testID: 'map' }).findByType('View').props.onLayout({ nativeEvent: { layout: { width: 390, height: 844 } } });
    app.root.findByType('MapView').props.onDidFinishLoadingMap();
  });
  assert.deepEqual(calls.at(-1).bounds.slice(0, 3), [[10.82, 59.94], [10.75, 59.91], [160, 48, 440, 48]], 'Native camera must frame real pickup/cars in the space above the ride card');
  await renderer.act(async () => app.update(React.createElement(MapboxInteractiveMap, { ...props, contentInsets: { ...props.contentInsets, bottom: 144 } })));
  assert.equal(calls.at(-1).bounds[2][2], 144, 'Collapsing a card must refit the native camera');
  await renderer.act(async () => app.root.findByType('MapView').props.onCameraChanged({ gestures: { isGestureActive: true } }));
  const before = calls.length;
  await renderer.act(async () => app.update(React.createElement(MapboxInteractiveMap, { ...props, cars: [{ id: 'live', lat: 59.95, lng: 10.83 }] })));
  assert.equal(calls.length, before, 'Live location updates must respect manual panning');
  await renderer.act(async () => app.update(React.createElement(MapboxInteractiveMap, { ...props, cars: [{ id: 'live', lat: 59.95, lng: 10.83 }], focusRevision: 1 })));
  assert.ok(calls.length > before, 'Explicit recenter must recover automatic framing after manual pan');
  assert.deepEqual(calls.at(-1).bounds.slice(0, 2), [[10.83,59.95],[10.75,59.91]]);
  const fullRoute = [[10.75,59.91],[10.9,59.99],[10.76,59.92]];
  await renderer.act(async () => app.update(React.createElement(MapboxInteractiveMap, { ...props, focusMode:'route', focusRoute:fullRoute, route:[], dropoff:{lat:59.92,lng:10.76}, focusRevision:2 })));
  assert.deepEqual(calls.at(-1).bounds.slice(0,2),[[10.9,59.99],[10.75,59.91]],'Route camera includes road detours before its animated line starts');
  const beforeDrawing = calls.length;
  await renderer.act(async () => app.update(React.createElement(MapboxInteractiveMap, { ...props, focusMode:'route', focusRoute:fullRoute, route:fullRoute.slice(0,2), dropoff:{lat:59.92,lng:10.76}, focusRevision:2 })));
  assert.equal(calls.length,beforeDrawing,'Line drawing must not move the camera along its prefix');
  await renderer.act(async () => app.unmount());
  await renderer.act(async () => { app = renderer.create(React.createElement(MapboxInteractiveMap, { ...props, cars: [] })); });
  await renderer.act(async () => {
    app.root.findByProps({ testID: 'map' }).findByType('View').props.onLayout({ nativeEvent: { layout: { width: 390, height: 844 } } });
    app.root.findByType('MapView').props.onDidFinishLoadingMap();
  });
  assert.deepEqual(calls.at(-1).config.padding, { paddingTop: 160, paddingRight: 48, paddingBottom: 440, paddingLeft: 48 }, 'A lone pickup uses the same unobscured viewport');
  await renderer.act(async () => app.update(React.createElement(MapboxInteractiveMap,{...props,activeCar:{lat:59.913,lng:10.755,heading:30,eta_min:4}})));
  assert.ok(app.root.findAllByType('Text').some(node=>JSON.stringify(node.props.children).includes('4')), 'Fresh assigned-car ETA stays attached to its actual map marker');
  await renderer.act(async () => app.update(React.createElement(MapboxInteractiveMap,{...props,activeCar:{lat:59.913,lng:10.755,heading:30}})));
  assert.equal(app.root.findAllByType('Text').some(node=>JSON.stringify(node.props.children).includes('min')),false,'Without a fresh ETA the marker tag disappears');
  await renderer.act(async () => app.unmount());
  console.log('PASS: native Mapbox bounds, panel resizing, manual panning and single-point camera padding');
})().catch(error => { console.error(error); process.exitCode = 1; });

