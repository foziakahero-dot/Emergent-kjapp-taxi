import React, { useId, type ReactNode } from "react";
const iconPaths: Record<string, ReactNode> = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  map: <><path d="m3 6 5-3 8 3 5-3v15l-5 3-8-3-5 3V6Z"/><path d="M8 3v15M16 6v15"/></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  car: <><path d="m5 17-1 2v2h2l1-2h10l1 2h2v-2l-1-2-2-7H7l-2 7Z"/><path d="M4 17h16M7 14h.01M17 14h.01"/></>,
  route: <><circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M8.5 17.5c4-2 2-7 7-10"/></>,
  wallet: <><path d="M3 6h16a2 2 0 0 1 2 2v10H5a2 2 0 0 1-2-2V6Z"/><path d="M3 8V5a2 2 0 0 1 2-2h12M16 12h5"/></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/></>,
  chat: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  arrow: <><path d="m9 18 6-6-6-6"/></>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
  close: <><path d="m6 6 12 12M18 6 6 18"/></>,
  check: <><path d="m5 12 4 4L19 6"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  send: <><path d="m22 2-7 20-4-9-9-4 20-7Z"/><path d="M22 2 11 13"/></>,
  alert: <><path d="M10.3 3.3 2 20h20L13.7 3.3a2 2 0 0 0-3.4 0Z"/><path d="M12 9v5M12 17h.01"/></>,
  shield: <><path d="M12 3 4 7v5c0 5.25 3.5 10.15 8 11 4.5-.85 8-5.75 8-11V7l-8-4Z"/><path d="m9 12 2 2 4-4"/></>,
  building: <><rect x="3" y="9" width="18" height="13" rx="2"/><path d="M8 9V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4M12 13v4M9 16h6"/></>,
  zap: <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>,
  database: <><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></>,
  plug: <><path d="M12 22v-5M9 8V2M15 8V2M18 8H6a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2Z"/></>,
  tag: <><path d="M12.58 2.24A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.83 8.83a2 2 0 0 0 2.82 0l7.17-7.17a2 2 0 0 0 0-2.82L12.58 2.24Z"/><circle cx="7" cy="7" r="1"/></>,
  log: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h4"/><circle cx="19" cy="18" r="3"/><path d="M19 16v2l1 1"/></>,
  lock: <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
  eye: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></>,
  creditcard: <><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></>,
  filter: <><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></>,
  refresh: <><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M3 8V2M3 8h6M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M21 16v6M21 16h-6"/></>,
  user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
  key: <><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/></>,
  info: <><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></>,
  edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></>,
  trash: <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></>,
  more: <><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></>,
  trending: <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
  x: <><path d="m6 6 12 12M18 6 6 18"/></>,
};

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {iconPaths[name] ?? null}
    </svg>
  );
}

// ─── Brand ────────────────────────────────────────────────────────────────────

export function SnarMark({ size = 34 }: { size?: number }) {
  const id = useId();
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 100 100">
      <defs>
        <linearGradient id={id} x1=".1" y1="-.07" x2=".9" y2="1.07">
          <stop stopColor="#ff3b3b"/>
          <stop offset=".55" stopColor="#ff0000"/>
          <stop offset="1" stopColor="#b30000"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="26" fill={`url(#${id})`}/>
      <path d="M28 29l21 21-21 21" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M53 29l21 21-21 21" fill="none" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

