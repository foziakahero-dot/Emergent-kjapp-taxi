import { MapCanvas } from './MapCanvas';

// On web (Expo preview) react-native-maps is not available — fall back to the
// stylised SVG canvas which renders identically everywhere.
export const Map = MapCanvas;
export default Map;
