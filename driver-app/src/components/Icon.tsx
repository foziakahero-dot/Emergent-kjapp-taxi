import React from 'react';
import Svg, { Path, Circle, Line, Polyline, Rect } from 'react-native-svg';
import { colors as theme, useColorTheme } from '@/src/theme';

// Lucide-style 24x24 stroke icons. Only the glyphs used across KJAPP.
type IconName =
  | 'menu' | 'search' | 'x' | 'map-pin' | 'navigation' | 'star' | 'phone'
  | 'message' | 'shield' | 'car' | 'user' | 'settings' | 'clock' | 'chevron-right'
  | 'chevron-left' | 'arrow-left' | 'plus' | 'check' | 'home' | 'briefcase'
  | 'plane' | 'card' | 'sparkles' | 'power' | 'wallet' | 'log-out' | 'history'
  | 'trending-up' | 'lock' | 'mail' | 'eye' | 'eye-off' | 'circle-dot' | 'flag'
  | 'help' | 'bell' | 'chevron-up' | 'minus' | 'crosshair' | 'file-text'
  | 'globe' | 'chevron-down';

const P: Record<IconName, React.ReactNode> = {
  menu: (<><Line x1="3" y1="6" x2="21" y2="6" /><Line x1="3" y1="12" x2="21" y2="12" /><Line x1="3" y1="18" x2="21" y2="18" /></>),
  search: (<><Circle cx="11" cy="11" r="8" /><Line x1="21" y1="21" x2="16.65" y2="16.65" /></>),
  x: (<><Line x1="18" y1="6" x2="6" y2="18" /><Line x1="6" y1="6" x2="18" y2="18" /></>),
  'map-pin': (<><Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><Circle cx="12" cy="10" r="3" /></>),
  navigation: (<Path d="M12 2l9 20-9-5-9 5z" fill="currentColor" />),
  star: (<Path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3 5.8 20.9l1.6-6.8L2.2 8.9l6.9-.6z" fill="currentColor" />),
  phone: (<Path d="M5 4h4l2 5-2 1a11 11 0 005 5l1-2 5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round" />),
  message: (<Path d="M4 5h16v11H9l-4 3z" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round" />),
  shield: (<Path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round" />),
  car: (<Path d="M6 16l2-6a3 3 0 013-2h2a3 3 0 013 2l2 6M5 16h14v3H5zM8 19v1M16 19v1" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />),
  user: (<><Circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.6" fill="none" /><Path d="M4 20a8 8 0 0116 0" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" /></>),
  settings: (<><Circle cx="12" cy="12" r="3" /><Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></>),
  clock: (<><Circle cx="12" cy="12" r="9" /><Polyline points="12 7 12 12 15 14" /></>),
  'chevron-right': (<Path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />),
  'chevron-left': (<Polyline points="15 18 9 12 15 6" />),
  'chevron-up': (<Polyline points="18 15 12 9 6 15" />),
  'arrow-left': (<><Line x1="19" y1="12" x2="5" y2="12" /><Polyline points="12 19 5 12 12 5" /></>),
  plus: (<Path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />),
  check: (<Path d="M5 12l5 5L20 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />),
  home: (<Path d="M4 11l8-7 8 7M6 10v9h12v-9" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />),
  briefcase: (<><Rect x="2" y="7" width="20" height="14" rx="2" /><Path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" /></>),
  plane: (<Path d="M17.8 19.2L16 11l3.5-3.5a2.12 2.12 0 00-3-3L13 8 4.8 6.2a1 1 0 00-.9 1.7l3.6 2.6-1.5 3H4a1 1 0 00-.7 1.7l2 1.3 1.3 2a1 1 0 001.7-.7v-1.5l3-1.5 2.6 3.6a1 1 0 001.7-.9z" />),
  card: (<><Rect x="2" y="5" width="20" height="14" rx="2" /><Line x1="2" y1="10" x2="22" y2="10" /></>),
  sparkles: (<Path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />),
  power: (<><Path d="M18.36 6.64a9 9 0 11-12.73 0" /><Line x1="12" y1="2" x2="12" y2="12" /></>),
  wallet: (<><Path d="M21 12V7H5a2 2 0 010-4h14v4" /><Path d="M3 5v14a2 2 0 002 2h16v-5" /><Path d="M18 12a2 2 0 000 4h4v-4z" /></>),
  'log-out': (<><Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><Polyline points="16 17 21 12 16 7" /><Line x1="21" y1="12" x2="9" y2="12" /></>),
  history: (<><Path d="M3 3v5h5" /><Path d="M3.05 13A9 9 0 106 5.3L3 8" /><Polyline points="12 7 12 12 15 14" /></>),
  'trending-up': (<Path d="M3 12h4l2 6 4-14 2 8h6" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />),
  lock: (<><Rect x="3" y="11" width="18" height="11" rx="2" /><Path d="M7 11V7a5 5 0 0110 0v4" /></>),
  mail: (<><Rect x="2" y="4" width="20" height="16" rx="2" /><Polyline points="22 6 12 13 2 6" /></>),
  eye: (<><Path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><Circle cx="12" cy="12" r="3" /></>),
  'eye-off': (<><Path d="M17.94 17.94A10 10 0 0112 20c-7 0-11-8-11-8a18 18 0 015.06-5.94M9.9 4.24A9 9 0 0112 4c7 0 11 8 11 8a18 18 0 01-2.16 3.19" /><Line x1="1" y1="1" x2="23" y2="23" /></>),
  'circle-dot': (<><Circle cx="12" cy="12" r="10" /><Circle cx="12" cy="12" r="3" /></>),
  flag: (<><Path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><Line x1="4" y1="22" x2="4" y2="15" /></>),
  help: (<><Circle cx="12" cy="12" r="10" /><Path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><Line x1="12" y1="17" x2="12.01" y2="17" /></>),
  bell: (<Path d="M6 16V10a6 6 0 1112 0v6l2 2H4zM10 20a2 2 0 004 0" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round" />),
  minus: (<Line x1="5" y1="12" x2="19" y2="12" />),
  crosshair: (<><Circle cx="12" cy="12" r="8" /><Line x1="12" y1="2" x2="12" y2="5" /><Line x1="12" y1="19" x2="12" y2="22" /><Line x1="2" y1="12" x2="5" y2="12" /><Line x1="19" y1="12" x2="22" y2="12" /></>),
  'file-text': (<Path d="M6 3h8l4 4v14H6zM14 3v4h4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round" />),
  globe: (<><Circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" fill="none" /><Path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" stroke="currentColor" strokeWidth="1.6" fill="none" /></>),
  'chevron-down': (<Polyline points="6 9 12 15 18 9" />),
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
  useColorTheme();
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

