type Tab = { id: string; label: string; icon: React.ReactNode }

const icons = {
  ride: (
    <svg viewBox="0 0 24 24" fill="none" className="h-full w-full">
      <path d="M5 11l1.5-4.5A2 2 0 018.4 5h7.2a2 2 0 011.9 1.5L19 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="4" y="11" width="16" height="6" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="8" cy="19" r="1.4" fill="currentColor" />
      <circle cx="16" cy="19" r="1.4" fill="currentColor" />
    </svg>
  ),
  activity: (
    <svg viewBox="0 0 24 24" fill="none" className="h-full w-full">
      <path d="M3 12h4l2 6 4-14 2 8h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  wallet: (
    <svg viewBox="0 0 24 24" fill="none" className="h-full w-full">
      <rect x="3" y="6" width="18" height="13" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16.5" cy="14.5" r="1.3" fill="currentColor" />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" fill="none" className="h-full w-full">
      <circle cx="12" cy="9" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.5 19a6.5 6.5 0 0113 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
}

const tabs: Tab[] = [
  { id: "ride", label: "Reise", icon: icons.ride },
  { id: "activity", label: "Aktivitet", icon: icons.activity },
  { id: "wallet", label: "Lommebok", icon: icons.wallet },
  { id: "profile", label: "Profil", icon: icons.profile },
]

export default function TaskBar({
  active,
  onChange,
}: {
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div className="absolute inset-x-4 bottom-4 z-[520]">
      <div
        className="flex items-center justify-between rounded-[26px] px-3 py-2.5"
        style={{
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(22px)",
          border: "1px solid var(--line)",
          boxShadow: "0 16px 40px rgba(11,14,20,0.14)",
        }}
      >
        {tabs.map((t) => {
          const on = t.id === active
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className="relative flex flex-1 flex-col items-center gap-1 py-1.5 transition-transform active:scale-95"
              style={{ color: on ? "var(--blue)" : "var(--ink-faint)" }}
            >
              {on && (
                <span
                  className="absolute -top-0.5 h-1 w-6 rounded-full"
                  style={{ background: "var(--blue)" }}
                />
              )}
              <span className="h-5 w-5 transition-all duration-300">
                {t.icon}
              </span>
              <span className="text-[10px] font-medium tracking-wide">{t.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
