const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const layout = read('frontend/app/(app)/_layout.tsx');
const floating = read('frontend/src/components/FloatingTabBar.tsx');
const dockComponent = read('frontend/src/components/snar10/Dock.tsx');
const tokens = read('frontend/src/theme/snar10.ts');

assert.match(layout, /name="history" options=\{\{ title: 'Turer' \}\}/, 'History tab must be labelled Turer');
assert.match(layout, /name="messages" options=\{\{ title: 'Meldinger', href: null \}\}/, 'Messages must remain routable but hidden from primary navigation');
assert.match(floating, /\['home', 'history', 'assist', 'profile'\]/, 'Customer primary dock must expose exactly Hjem, Turer, SNAR AI and Profil');
assert.doesNotMatch(floating, /\['home', 'history', 'assist', 'messages', 'profile'\]/, 'Customer dock must not regress to five primary tabs');

for (const [name, expected] of [
  ['height', 74],
  ['radius', 28],
  ['aiSize', 62],
  ['aiRadius', 31],
  ['aiLift', 12],
  ['labelSize', 11],
  ['labelLineHeight', 14],
]) {
  assert.match(tokens, new RegExp(`${name}: ${expected}(?:,|\\n)`), `Locked dock token ${name} must remain ${expected}`);
}
assert.match(tokens, /pressScale: \.96/, 'Dock press scale must remain 0.96');
assert.match(tokens, /aiPulse: 1500/, 'SNAR AI pulse cycle must remain 1500ms');
assert.match(tokens, /aiStagger: 280/, 'SNAR AI pulse stagger must remain 280ms');

assert.match(dockComponent, /expo-haptics/, 'Dock must keep native haptic feedback');
assert.match(dockComponent, /isReduceMotionEnabled/, 'Dock animations must respect reduced-motion accessibility');
assert.match(dockComponent, /outputRange: \[1, 1\.65\]/, 'SNAR AI listening rings must expand to 1.65x');
assert.match(dockComponent, /borderWidth: 3,[\s\S]*borderColor: '#FFFFFF'/, 'SNAR AI button must keep the 3px white ring');
assert.match(dockComponent, /backgroundColor: colors\.accent/, 'SNAR AI button must use the SNAR red accent');
assert.match(dockComponent, /fontFamily: font\.medium/, 'Dock labels must use Geist Medium through the shared font token');

console.log('PASS: Locked SNAR customer dock specification is present.');
