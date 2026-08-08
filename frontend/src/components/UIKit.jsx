import React from "react";

export function Orb({ size = "default", className = "", withRings = true }) {
  const sizeClass =
    size === "large" ? "orb-large" : size === "small" ? "orb-small" : size === "tiny" ? "orb-tiny" : "";
  return (
    <div className={`orb-outer ${className}`} data-testid="ai-orb">
      <div className={`orb ${sizeClass}`} />
      {withRings && (
        <>
          <div className="orb-ring" />
          <div className="orb-ring delay" />
        </>
      )}
    </div>
  );
}

export function StatusBar() {
  const [time, setTime] = React.useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });
  React.useEffect(() => {
    const t = setInterval(() => {
      const d = new Date();
      setTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    }, 30000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="status-bar">
      <span>{time}</span>
      <div className="icons">
        <SignalIcon />
        <WifiIcon />
        <BatteryIcon />
      </div>
    </div>
  );
}

function SignalIcon() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
      <rect x="0" y="8" width="3" height="4" fill="currentColor" rx="0.5" />
      <rect x="4" y="5" width="3" height="7" fill="currentColor" rx="0.5" />
      <rect x="8" y="2" width="3" height="10" fill="currentColor" rx="0.5" />
      <rect x="12" y="0" width="3" height="12" fill="currentColor" rx="0.5" />
    </svg>
  );
}
function WifiIcon() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
      <path d="M8 11a1 1 0 100-2 1 1 0 000 2z" fill="currentColor" />
      <path d="M4.5 7.5a5 5 0 017 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M2 5a8 8 0 0112 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function BatteryIcon() {
  return (
    <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
      <rect x="1" y="1" width="20" height="10" rx="2" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <rect x="2.5" y="2.5" width="16" height="7" rx="1" fill="currentColor" />
      <rect x="22" y="4" width="1.5" height="4" rx="0.5" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

export function VoiceBars() {
  return (
    <span className="voice-bars" aria-hidden="true">
      <span /><span /><span /><span /><span /><span />
    </span>
  );
}

export function ProgressRing({ value = 0, size = 120, stroke = 6, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="progress-ring" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#1c2124"
          strokeWidth={stroke}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#2fe08c"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          fill="transparent"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
