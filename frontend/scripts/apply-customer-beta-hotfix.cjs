const fs = require('fs');
const path = require('path');

const homePath = path.join(__dirname, '..', 'app', '(app)', 'home.tsx');
let source = fs.readFileSync(homePath, 'utf8');
const originalEol = source.includes('\r\n') ? '\r\n' : '\n';
source = source.replace(/\r\n/g, '\n');

// Idempotent: once the source is folded in permanently, do nothing without
// terminating the parent process. This module is required by the build gate,
// so process.exit(0) here would incorrectly skip all remaining gate checks.
if (source.includes('const [rideSheetCollapsed, setRideSheetCollapsed]')) {
  console.log('Customer ride-sheet minimize fix already present.');
} else {
  const stateBefore = `  const [searchCollapsed, setSearchCollapsed] = useState(false);\n  const [sheetCollapsed, setSheetCollapsed] = useState(true);\n  useEffect(() => { if (dropoff) setSearchCollapsed(true); }, [dropoff]);`;
  const stateAfter = `  const [searchCollapsed, setSearchCollapsed] = useState(false);\n  const [sheetCollapsed, setSheetCollapsed] = useState(true);\n  const [rideSheetCollapsed, setRideSheetCollapsed] = useState(false);\n  useEffect(() => {\n    if (dropoff) {\n      setSearchCollapsed(true);\n      setRideSheetCollapsed(false);\n    }\n  }, [dropoff]);`;

  if (!source.includes(stateBefore)) throw new Error('Ride-sheet state anchor not found; refusing an unsafe source rewrite.');
  source = source.replace(stateBefore, stateAfter);

  const fabBefore = `                bottom: dropoff\n                  ? insets.bottom + 372\n                  : insets.bottom + (sheetCollapsed ? 94 : 300),`;
  const fabAfter = `                bottom: dropoff\n                  ? insets.bottom + (rideSheetCollapsed ? 126 : 372)\n                  : insets.bottom + (sheetCollapsed ? 94 : 300),`;
  if (!source.includes(fabBefore)) throw new Error('Location FAB anchor not found.');
  source = source.replace(fabBefore, fabAfter);

  const sheetBefore = `<View style={[s.rideSheet, { paddingBottom: insets.bottom + 112 }]} testID="home-ride-sheet">\n              <Pressable testID="customer-app-app-home-365" style={s.sheetHandleButton} onPress={() => setSheetCollapsed((v) => !v)}>\n                <View style={s.handle} />\n              </Pressable>\n\n              <View style={s.rideHeader}>`;
  const sheetAfter = `<View style={[s.rideSheet, { paddingBottom: insets.bottom + (rideSheetCollapsed ? 18 : 112) }]} testID="home-ride-sheet">\n              <Pressable\n                testID={rideSheetCollapsed ? 'home-ride-sheet-expand' : 'home-ride-sheet-collapse'}\n                style={s.sheetHandleButton}\n                onPress={() => setRideSheetCollapsed((v) => !v)}\n                accessibilityRole="button"\n                accessibilityLabel={rideSheetCollapsed ? 'Utvid bilvalg' : 'Minimer bilvalg'}\n              >\n                <View style={s.handle} />\n              </Pressable>\n\n              {rideSheetCollapsed ? (\n                <Pressable\n                  testID="home-ride-sheet-summary"\n                  onPress={() => setRideSheetCollapsed(false)}\n                  accessibilityRole="button"\n                  accessibilityLabel="Vis bilvalg"\n                  style={{ minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 }}\n                >\n                  <View style={[s.vehicleIconBox, s.vehicleIconBoxActive]}>\n                    <VehicleGlyph selected kind={selType as VehicleKind} />\n                  </View>\n                  <View style={{ flex: 1 }}>\n                    <Text style={s.vehicleName}>{selectedCopy.name}</Text>\n                    <Text style={s.vehicleMeta}>{nearest != null ? nearest + ' min · ' : ''}{selectedPrice != null ? kr(selectedPrice) : 'Beregner pris…'}</Text>\n                  </View>\n                  <Icon name="chevron-up" size={20} color={colors.textMuted} />\n                </Pressable>\n              ) : (\n                <>\n              <View style={s.rideHeader}>`;
  if (!source.includes(sheetBefore)) throw new Error('Ride-sheet header anchor not found.');
  source = source.replace(sheetBefore, sheetAfter);

  const closeBefore = `              {error ? <Text style={s.error} testID="home-error">{error}</Text> : null}\n            </View>\n          )}`;
  const closeAfter = `              {error ? <Text style={s.error} testID="home-error">{error}</Text> : null}\n                </>\n              )}\n            </View>\n          )}`;
  if (!source.includes(closeBefore)) throw new Error('Ride-sheet closing anchor not found.');
  source = source.replace(closeBefore, closeAfter);

  if (originalEol === '\r\n') source = source.replace(/\n/g, '\r\n');
  fs.writeFileSync(homePath, source, 'utf8');
  console.log('Applied Customer ride-sheet minimize/restore fix for native build.');
}
