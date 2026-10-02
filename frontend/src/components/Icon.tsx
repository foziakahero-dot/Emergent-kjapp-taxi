import React from 'react';
import Svg, { Path, Circle, Line, Polyline, Rect } from 'react-native-svg';
import { colors as theme } from '@/src/theme';

// KJAPP icon system — Lucide-style 24x24 strokes with a consistent optical grid.
type IconName =
  | 'menu' | 'search' | 'x' | 'map-pin' | 'navigation' | 'star' | 'phone'
  | 'message' | 'shield' | 'car' | 'user' | 'settings' | 'clock' | 'chevron-right'
  | 'chevron-left' | 'arrow-left' | 'plus' | 'check' | 'home' | 'briefcase'
  | 'plane' | 'card' | 'sparkles' | 'power' | 'wallet' | 'log-out' | 'history'
  | 'trending-up' | 'lock' | 'mail' | 'eye' | 'eye-off' | 'circle-dot' | 'flag'
  | 'help' | 'bell' | 'chevron-up' | 'minus' | 'crosshair' | 'file-text'
  | 'globe' | 'chevron-down' | 'mic';

const P: Record<IconName, React.ReactNode> = {
  menu: (<><Line x1="3" y1="6" x2="21" y2="6" /><Line x1="3" y1="12" x2="21" y2="12" /><Line x1="3" y1="18" x2="21" y2="18" /></>),
  search: (<Path d="M11 4a7 7 0 105 12l4 4M11 4a7 7 0 010 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />),
  x: (<Path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />),
  'map-pin': (<><Path d="M12 21c5-5 7-8 7-11a7 7 0 10-14 0c0 3 2 6 7 11z" stroke="currentColor" strokeWidth="1.6" fill="none" /><Circle cx="12" cy="10" r="2.4" fill="currentColor" /></>),
  navigation: (<Polyline points="3 11 22 2 13 21 11 13 3 11" />),
  star: (<Path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3 5.8 20.9l1.6-6.8L2.2 8.9l6.9-.6z" fill="currentColor" />),
  phone: (<Path d="M5 4h4l2 5-2 1a11 11 0 005 5l1-2 5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round" />),
  message: (<Path d="M4 5h16v11H9l-4 3z" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round" />),
  shield: (<Path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round" />),
  car: (<><Path d="M5 17h14M6 17l-1-5 2-5h10l2 5-1 5" /><Circle cx="7.5" cy="17.5" r="1.5" /><Circle cx="16.5" cy="17.5" r="1.5" /></>),
  user: (<><Path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><Circle cx="12" cy="7" r="4" /></>),
  settings: (<><Circle cx="12" cy="12" r="3" /><Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></>),
  clock: (<><Circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" fill="none" /><Path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" /></>),
  'chevron-right': (<Path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />),
  'chevron-left': (<Polyline points="15 18 9 12 15 6" />),
  'chevron-up': (<Polyline points="18 15 12 9 6 15" />),
  'arrow-left': (<><Line x1="19" y1="12" x2="5" y2="12" /><Polyline points="12 19 5 12 12 5" /></>),
  plus: (<Path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />),
  check: (<Polyline points="20 6 9 17 4 12" />),
  home: (<Path d="M4 11l8-7 8 7M6 10v9h12v-9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />),
  briefcase: (<Path d="M4 8h16v11H4zM9 8V5h6v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />),
  plane: (<Path d="M17.8 19.2L16 11l3.5-3.5a2.12 2.12 0 00-3-3L13 8 4.8 6.2a1 1 0 00-.9 1.7l3.6 2.6-1.5 3H4a1 1 0 00-.7 1.7l2 1.3 1.3 2a1 1 0 001.7-.7v-1.5l3-1.5 2.6 3.6a1 1 0 001.7-.9z" />),
  card: (<><Rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" fill="none" /><Path d="M3 10h18" stroke="currentColor" strokeWidth="1.6" /></>),
  sparkles: (<Path d="M12 3l1.7 5 5 1.7-5 1.7L12 16l-1.7-4.6-5-1.7 5-1.7zM18.5 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" fill="currentColor" />),
  power: (<><Path d="M18.36 6.64a9 9 0 11-12.73 0" /><Line x1="12" y1="2" x2="12" y2="12" /></>),
  wallet: (<><Path d="M21 12V7H5a2 2 0 010-4h14v4" /><Path d="M3 5v14a2 2 0 002 2h16v-5" /><Path d="M18 12a2 2 0 000 4h4v-4z" /></>),
  'log-out': (<><Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><Polyline points="16 17 21 12 16 7" /><Line x1="21" y1="12" x2="9" y2="12" /></>),
  history: (<><Path d="M3 3v5h5" /><Path d="M3.05 13A9 9 0 106 5.3L3 8" /><Polyline points="12 7 12 12 15 14" /></>),
  'trending-up': (<><Polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><Polyline points="17 6 23 6 23 12" /></>),
  lock: (<><Rect x="3" y="11" width="18" height="11" rx="2" /><Path d="M7 11V7a5 5 0 0110 0v4" /></>),
  mail: (<><Rect x="2" y="4" width="20" height="16" rx="2" /><Polyline points="22 6 12 13 2 6" /></>),
  eye: (<><Path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><Circle cx="12" cy="12" r="3" /></>),
  'eye-off': (<><Path d="M17.94 17.94A10 10 0 0112 20c-7 0-11-8-11-8a18 18 0 015.06-5.94M9.9 4.24A9 9 0 0112 4c7 0 11 8 11 8a18 18 0 01-2.16 3.19" /><Line x1="1" y1="1" x2="23" y2="23" /></>),
  'circle-dot': (<><Circle cx="12" cy="12" r="10" /><Circle cx="12" cy="12" r="3" /></>),
  flag: (<><Path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><Line x1="4" y1="22" x2="4" y2="15" /></>),
  help: (<><Circle cx="12" cy="12" r="10" /><Path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><Line x1="12" y1="17" x2="12.01" y2="17" /></>),
  bell: (<><Path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><Path d="M13.73 21a2 2 0 01-3.46 0" /></>),
  minus: (<Line x1="5" y1="12" x2="19" y2="12" />),
  crosshair: (<><Circle cx="12" cy="12" r="8" /><Line x1="12" y1="2" x2="12" y2="5" /><Line x1="12" y1="19" x2="12" y2="22" /><Line x1="2" y1="12" x2="5" y2="12" /><Line x1="19" y1="12" x2="22" y2="12" /></>),
  'file-text': (<><Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><Polyline points="14 2 14 8 20 8" /><Line x1="8" y1="13" x2="16" y2="13" /><Line x1="8" y1="17" x2="16" y2="17" /></>),
  globe: (<><Circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" fill="none" /><Path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" stroke="currentColor" strokeWidth="1.6" fill="none" /></>),
  'chevron-down': (<Polyline points="6 9 12 15 18 9" />),
  mic: (<><Rect x="9" y="2" width="6" height="12" rx="3" /><Path d="M5 10a7 7 0 0014 0" /><Line x1="12" y1="17" x2="12" y2="22" /><Line x1="8" y1="22" x2="16" y2="22" /></>),
};

export function Icon({
  name,
  size = 22,
  color = theme.text,
  strokeWidth = 1.6,
  fill = 'none',
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      color={color}
      fill={fill}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {P[name]}
    </Svg>
  );
}

export type { IconName };

