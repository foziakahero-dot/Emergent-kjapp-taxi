import { useEffect, useState } from "react"
import Splash from "../screens/Splash"
import Login from "../screens/Login"
import LiveMap from "../components/LiveMap"
import TaskBar from "../components/TaskBar"
import SnarMark from "../components/SnarMark"

type Screen = "splash" | "permissions" | "login" | "setup" | "app"
type RideStage = "browse" | "confirm" | "matching" | "arriving" | "inride" | "receipt"

const categories = [
  { id: "ai", name: "SNAR AI", desc: "Smart matchet", wait: "2 min", price: "149–169", cap: 4, badge: "Standard" },
  { id: "comfort", name: "Comfort", desc: "Ekstra plass", wait: "4 min", price: "189–219", cap: 4 },
  { id: "luxury", name: "Luxury", desc: "Premiumbiler", wait: "6 min", price: "329–379", cap: 3 },
  { id: "van", name: "Van", desc: "Opptil 7", wait: "7 min", price: "279–319", cap: 7 },
  { id: "wheel", name: "Rullestol", desc: "Tilrettelagt", wait: "9 min", price: "149–169", cap: 3 },
]

const destinations = [
  { icon: "home", label: "Hjem", sub: "Thorvald Meyers gate 12" },
  { icon: "work", label: "Jobb", sub: "Aker Brygge 2" },
  { icon: "recent", label: "Oslo Lufthavn", sub: "Gardermoen" },
  { icon: "recent", label: "Vulkan", sub: "Maridalsveien 17" },
]

function Icon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  const p: Record<string, React.ReactNode> = {
    search: <path d="M11 4a7 7 0 105 12l4 4M11 4a7 7 0 010 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />,
    home: <path d="M4 11l8-7 8 7M6 10v9h12v-9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
    work: <path d="M4 8h16v11H4zM9 8V5h6v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />,
    recent: <><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" fill="none" /><path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" /></>,
    phone: <path d="M5 4h4l2 5-2 1a11 11 0 005 5l1-2 5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round" />,
    chat: <path d="M4 5h16v11H9l-4 3z" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round" />,
    shield: <path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round" />,
    plus: <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
    star: <path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3 5.8 20.9l1.6-6.8L2.2 8.9l6.9-.6z" fill="currentColor" />,
    loc: <><path d="M12 21c5-5 7-8 7-11a7 7 0 10-14 0c0 3 2 6 7 11z" stroke="currentColor" strokeWidth="1.6" fill="none" /><circle cx="12" cy="10" r="2.4" fill="currentColor" /></>,
    card: <><rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" fill="none" /><path d="M3 10h18" stroke="currentColor" strokeWidth="1.6" /></>,
    globe: <><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" fill="none" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" stroke="currentColor" strokeWidth="1.6" fill="none" /></>,
    chevron: <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />,
    close: <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
    sparkle: <path d="M12 3l1.7 5 5 1.7-5 1.7L12 16l-1.7-4.6-5-1.7 5-1.7zM18.5 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" fill="currentColor" />,
    gift: <><rect x="4" y="9" width="16" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.6" fill="none" /><path d="M3 9h18v3H3zM12 9v11M12 9c-1.5-4-6-3-6-1s3 2 6 1zm0 0c1.5-4 6-3 6-1s-3 2-6 1z" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round" /></>,
    food: <path d="M6 3v7a2 2 0 004 0V3M8 10v11M16 3c-1.5 0-2.5 1.5-2.5 4s1 4 2.5 4v10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />,
    send: <path d="M4 12l16-8-6 16-2.5-6.5z" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round" />,
  }
  return <svg viewBox="0 0 24 24" className={className}>{p[name]}</svg>
}

/* ---------- permission screen ---------- */
function Permissions({ onDone }: { onDone: () => void }) {
  const [loc, setLoc] = useState(true)
  const [notif, setNotif] = useState(true)
  const rows = [
    { on: loc, set: setLoc, icon: "loc", title: "Posisjon", sub: "For å finne sjåfører i nærheten og vise hvor du er" },
    { on: notif, set: setNotif, icon: "chat", title: "Varsler", sub: "Beskjed når sjåføren er på vei og har ankommet" },
  ]
  return (
    <div className="flex h-full flex-col px-7 pt-16" style={{ background: "linear-gradient(180deg,#ffffff,#f2f5fa)" }}>
      <SnarMark size={44} />
      <h2 className="mt-6 font-display text-2xl font-semibold animate-rise">Noen få tillatelser</h2>
      <p className="mt-1 text-sm text-[var(--ink-soft)] animate-rise">Vi trenger disse for en trygg og rask opplevelse.</p>
      <div className="mt-8 flex flex-col gap-3">
        {rows.map((r, i) => (
          <div key={r.title} className="flex items-center gap-3 rounded-2xl p-4 animate-rise" style={{ background: "var(--surface)", border: "1px solid var(--line)", animationDelay: `${i * 0.06}s` }}>
            <span className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--blue)]" style={{ background: "var(--blue-soft)" }}>
              <Icon name={r.icon} />
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold">{r.title}</p>
              <p className="text-xs leading-snug text-[var(--ink-soft)]">{r.sub}</p>
            </div>
            <button onClick={() => r.set(!r.on)} className="relative h-7 w-12 rounded-full transition-colors" style={{ background: r.on ? "var(--blue)" : "var(--line-strong)" }}>
              <span className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all" style={{ left: r.on ? "22px" : "2px" }} />
            </button>
          </div>
        ))}
      </div>
      <button onClick={onDone} className="mt-auto mb-8 rounded-full py-4 font-display text-sm font-semibold text-white transition-transform active:scale-95" style={{ background: "linear-gradient(120deg,#ff3b3b,#ff0000)", boxShadow: "0 12px 30px rgba(255,0,0,0.35)" }}>
        Tillat og fortsett
      </button>
    </div>
  )
}

/* ---------- profile setup (name, payment, frequent addresses) ---------- */
function ProfileSetup({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("")
  const [pay, setPay] = useState("apple")
  const [home, setHome] = useState("")
  const [work, setWork] = useState("")
  const pays = [["apple", "Apple Pay"], ["gpay", "Google Pay"], ["vipps", "Vipps"], ["card", "Kort"]]
  return (
    <div className="flex h-full flex-col overflow-y-auto px-7 pb-8 pt-16" style={{ background: "linear-gradient(180deg,#ffffff,#f2f5fa)" }}>
      <SnarMark size={44} />
      <h2 className="mt-6 font-display text-2xl font-semibold animate-rise">Sett opp profilen</h2>
      <p className="mt-1 text-sm text-[var(--ink-soft)] animate-rise">Så vi kan gjøre hver tur raskere for deg.</p>

      <div className="mt-8 flex flex-col gap-5">
        <label className="block">
          <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--ink-faint)]">Navn</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Fornavn Etternavn" className="w-full rounded-2xl bg-[var(--surface)] px-4 py-3.5 text-[15px] text-[var(--ink)] outline-none" style={{ border: "1px solid var(--line-strong)" }} />
        </label>

        <div>
          <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--ink-faint)]">Betalingsmåte</span>
          <div className="grid grid-cols-2 gap-2">
            {pays.map(([id, l]) => (
              <button key={id} onClick={() => setPay(id)} className="rounded-2xl py-3 text-sm font-semibold transition-all" style={{ background: pay === id ? "var(--blue-soft)" : "var(--surface)", border: `1px solid ${pay === id ? "var(--blue)" : "var(--line-strong)"}`, color: pay === id ? "var(--blue)" : "var(--ink)" }}>{l}</button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--ink-faint)]">Faste adresser</span>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 rounded-2xl bg-[var(--surface)] px-4 py-3" style={{ border: "1px solid var(--line-strong)" }}><Icon name="home" className="h-5 w-5 text-[var(--ink-faint)]" /><input value={home} onChange={(e) => setHome(e.target.value)} placeholder="Hjem" className="w-full bg-transparent text-[15px] outline-none placeholder:text-[var(--ink-faint)]" /></div>
            <div className="flex items-center gap-2 rounded-2xl bg-[var(--surface)] px-4 py-3" style={{ border: "1px solid var(--line-strong)" }}><Icon name="work" className="h-5 w-5 text-[var(--ink-faint)]" /><input value={work} onChange={(e) => setWork(e.target.value)} placeholder="Jobb" className="w-full bg-transparent text-[15px] outline-none placeholder:text-[var(--ink-faint)]" /></div>
          </div>
        </div>
      </div>

      <button onClick={onDone} className="mt-8 rounded-full py-4 font-display text-sm font-semibold text-white transition-transform active:scale-95" style={{ background: "linear-gradient(120deg,#ff3b3b,#ff0000)", boxShadow: "0 12px 30px rgba(255,0,0,0.35)" }}>Fullfør</button>
      <button onClick={onDone} className="mt-3 text-center text-xs font-medium text-[var(--ink-soft)]">Hopp over for nå</button>
    </div>
  )
}

/* ---------- ride: browse (map + search + categories) ---------- */
function Browse({ onBook }: { onBook: (name: string, price: string) => void }) {
  const [dest, setDest] = useState<string | null>(null)
  const [cat, setCat] = useState("ai")
  const [expanded, setExpanded] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(true)
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState("")
  const selected = categories.find((c) => c.id === cat)!

  // proactive AI place recommendations
  const [aiOpen, setAiOpen] = useState(false)
  const [aiIdx, setAiIdx] = useState(0)
  const aiPlaces = [
    { name: "Vippa", tag: "Street food · 6 min unna", line: "Lyst på lunsj? Vippa har 12 kjøkken ved fjorden — populært akkurat nå.", sub: "Akershusstranda 25" },
    { name: "Mathallen Oslo", tag: "Matmarked · 8 min unna", line: "Basert på turene dine tror jeg du vil like Mathallen på Vulkan.", sub: "Vulkan 5" },
    { name: "SALT Art & Music", tag: "Bar & sauna · 9 min unna", line: "Fint vær i kveld — SALT ved fjorden har uteservering og badstue.", sub: "Langkaia 1" },
  ]
  const ai = aiPlaces[aiIdx]

  useEffect(() => {
    if (dest || searching) return
    const t = setTimeout(() => setAiOpen(true), 3500)
    return () => clearTimeout(t)
  }, [dest, searching])

  const results = destinations.filter(
    (d) => !query || d.label.toLowerCase().includes(query.toLowerCase()) || d.sub.toLowerCase().includes(query.toLowerCase()),
  )

  const pick = (label: string) => { setDest(label); setSearching(false); setQuery("") }

  return (
    <div className="relative h-full">
      <LiveMap />

      {/* search bar (tap to open full search) */}
      <div className="absolute inset-x-4 top-4 z-[500] animate-rise">
        <button onClick={() => setSearching(true)} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left" style={{ background: "rgba(255,255,255,0.96)", backdropFilter: "blur(16px)", border: "1px solid var(--line)", boxShadow: "0 8px 24px rgba(11,14,20,0.1)" }}>
          <Icon name="search" className="h-5 w-5 text-[var(--ink-faint)]" />
          <span className="text-[15px] font-medium" style={{ color: dest ? "var(--ink)" : "var(--ink-faint)" }}>
            {dest ?? "Hvor skal du?"}
          </span>
        </button>
      </div>

      {/* full search overlay — minimizable via Avbryt / × */}
      {searching && (
        <div className="absolute inset-0 z-[550] flex flex-col" style={{ background: "var(--surface)" }}>
          <div className="flex items-center gap-2 px-4 pt-5 pb-3" style={{ borderBottom: "1px solid var(--line)" }}>
            <div className="flex flex-1 items-center gap-2 rounded-2xl px-3 py-2.5" style={{ background: "var(--surface-soft)" }}>
              <Icon name="search" className="h-5 w-5 text-[var(--ink-faint)]" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Hvor skal du?"
                className="w-full bg-transparent text-[15px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
              />
              {query && (
                <button onClick={() => setQuery("")} className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] text-white" style={{ background: "var(--ink-faint)" }}>×</button>
              )}
            </div>
            <button onClick={() => { setSearching(false); setQuery("") }} className="px-2 text-sm font-semibold text-[var(--red)]">Avbryt</button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-2">
            {results.length > 0 ? results.map((d) => (
              <button key={d.label} onClick={() => pick(d.label)} className="flex w-full items-center gap-3 py-3 text-left transition-colors active:opacity-60">
                <span className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--ink-soft)]" style={{ background: "var(--surface-soft)" }}><Icon name={d.icon} /></span>
                <div className="flex-1 border-b pb-3" style={{ borderColor: "var(--line)" }}>
                  <p className="text-sm font-semibold">{d.label}</p>
                  <p className="text-xs text-[var(--ink-soft)]">{d.sub}</p>
                </div>
              </button>
            )) : (
              <div className="mt-16 flex flex-col items-center text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full text-[var(--ink-faint)]" style={{ background: "var(--surface-soft)" }}><Icon name="search" className="h-6 w-6" /></span>
                <p className="mt-3 text-sm font-semibold">Fant ingen steder</p>
                <p className="text-xs text-[var(--ink-soft)]">Prøv et annet søk</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* center-location FAB */}
      <button className="absolute right-4 z-[500] flex h-11 w-11 items-center justify-center rounded-full transition-all active:scale-90" style={{ bottom: dest ? 360 : sheetOpen ? 300 : 96, background: "rgba(255,255,255,0.96)", border: "1px solid var(--line)", boxShadow: "0 6px 18px rgba(11,14,20,0.12)", color: "var(--blue)" }}>
        <Icon name="loc" />
      </button>

      {/* proactive AI place recommendation */}
      {aiOpen && !dest && !searching && (
        <div className="absolute inset-x-4 z-[540] animate-rise" style={{ bottom: sheetOpen ? 316 : 112 }}>
          <div className="overflow-hidden rounded-3xl" style={{ background: "rgba(255,255,255,0.98)", backdropFilter: "blur(20px)", border: "1px solid var(--line)", boxShadow: "0 16px 40px rgba(11,14,20,0.18)" }}>
            <div className="flex items-center gap-2 px-4 pt-3.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full text-white" style={{ background: "linear-gradient(135deg,#ff3b3b,#ff0000)" }}><Icon name="sparkle" className="h-4 w-4" /></span>
              <p className="flex-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--blue)]">SNAR AI anbefaler</p>
              <button onClick={() => setAiOpen(false)} className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--ink-faint)]"><Icon name="close" className="h-4 w-4" /></button>
            </div>
            <div className="px-4 pb-4 pt-2">
              <p className="text-sm leading-snug text-[var(--ink-soft)]">{ai.line}</p>
              <div className="mt-3 flex items-center gap-3 rounded-2xl p-3" style={{ background: "var(--surface-soft)" }}>
                <span className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--blue)]" style={{ background: "#fff" }}><Icon name="food" /></span>
                <div className="flex-1"><p className="text-sm font-semibold">{ai.name}</p><p className="text-xs text-[var(--ink-soft)]">{ai.tag}</p></div>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => { setDest(ai.name); setAiOpen(false) }} className="flex-1 rounded-full py-2.5 text-sm font-semibold text-white transition-transform active:scale-95" style={{ background: "linear-gradient(120deg,#ff3b3b,#ff0000)" }}>Ta meg dit</button>
                <button onClick={() => setAiIdx((i) => (i + 1) % aiPlaces.length)} className="rounded-full px-4 py-2.5 text-sm font-semibold text-[var(--ink-soft)]" style={{ border: "1px solid var(--line-strong)" }}>Noe annet</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* bottom sheet */}
      <div className={`absolute inset-x-0 bottom-0 z-[500] rounded-t-[30px] px-6 pt-4 animate-rise transition-all duration-300 ${!dest && !sheetOpen ? "pb-8" : "pb-28"}`} style={{ background: "rgba(255,255,255,0.98)", backdropFilter: "blur(26px)", borderTop: "1px solid var(--line)", boxShadow: "0 -20px 50px rgba(11,14,20,0.12)" }}>
        <button onClick={() => (dest ? setExpanded((e) => !e) : setSheetOpen((o) => !o))} aria-label={sheetOpen ? "Minimer" : "Utvid"} className="mx-auto mb-3 flex h-6 w-16 items-center justify-center">
          <span className="block h-1 w-10 rounded-full" style={{ background: "var(--line-strong)" }} />
        </button>

        {!dest ? (
          <>
            <button onClick={() => setSheetOpen((o) => !o)} className="mb-2 flex w-full items-center justify-between text-left">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-faint)]">Nylig og favoritter</span>
              <Icon name="chevron" className={`h-4 w-4 text-[var(--ink-faint)] transition-transform ${sheetOpen ? "-rotate-90" : "rotate-90"}`} />
            </button>
            <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: sheetOpen ? 400 : 0, opacity: sheetOpen ? 1 : 0 }}>
              <div className="flex flex-col">
                {destinations.map((d) => (
                  <button key={d.label} onClick={() => setDest(d.label)} className="flex items-center gap-3 py-3 text-left transition-colors active:opacity-60">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--ink-soft)]" style={{ background: "var(--surface-soft)" }}>
                      <Icon name={d.icon} />
                    </span>
                    <div className="flex-1 border-b pb-3" style={{ borderColor: "var(--line)" }}>
                      <p className="text-sm font-semibold">{d.label}</p>
                      <p className="text-xs text-[var(--ink-soft)]">{d.sub}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display text-lg font-semibold">Velg reise</p>
              <button onClick={() => setDest(null)} className="font-mono text-[11px] tracking-widest text-[var(--blue)]">ENDRE</button>
            </div>
            <div className={`flex flex-col gap-2 ${expanded ? "max-h-[300px] overflow-y-auto" : ""}`}>
              {(expanded ? categories : categories.slice(0, 3)).map((c) => {
                const on = c.id === cat
                return (
                  <button key={c.id} onClick={() => setCat(c.id)} className="flex items-center gap-3 rounded-2xl p-3 text-left transition-all" style={{ background: on ? "var(--blue-soft)" : "var(--surface)", border: `1px solid ${on ? "var(--blue)" : "var(--line)"}` }}>
                    <span className="flex h-11 w-14 items-center justify-center rounded-xl" style={{ background: on ? "#ffffff" : "var(--surface-soft)" }}>
                      <svg viewBox="0 0 48 24" className="h-6 w-12" fill={on ? "var(--blue)" : "var(--ink-soft)"}><path d="M6 16l3-7a3 3 0 013-2h12a3 3 0 013 2l3 7v4h-4a3 3 0 01-6 0h-8a3 3 0 01-6 0H6z" /></svg>
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{c.name}</p>
                        {c.badge && <span className="rounded-full px-2 py-0.5 text-[9px] font-semibold text-white" style={{ background: "var(--blue)" }}>{c.badge}</span>}
                      </div>
                      <p className="text-xs text-[var(--ink-soft)]">{c.desc} · {c.wait} · {c.cap} pers.</p>
                    </div>
                    <p className="font-display text-sm font-semibold">{c.price} kr</p>
                  </button>
                )
              })}
            </div>
            <button onClick={() => onBook(selected.name, selected.price)} className="mt-4 w-full rounded-full py-4 font-display text-sm font-semibold text-white transition-transform active:scale-95" style={{ background: "linear-gradient(120deg,#ff3b3b,#ff0000)", boxShadow: "0 12px 30px rgba(255,0,0,0.35)" }}>
              Se over · {selected.name}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/* ---------- confirmation with fare breakdown ---------- */
function Confirm({ name, price, onConfirm, onBack }: { name: string; price: string; onConfirm: () => void; onBack: () => void }) {
  const rows = [["Grunnpris", "89,00"], ["Distanse (8,4 km)", "58,00"], ["Est. ventetid", "6,00"], ["Mva.", "16,00"]]
  return (
    <div className="flex h-full flex-col px-6 pt-14 pb-8" style={{ background: "linear-gradient(180deg,#ffffff,#f2f5fa)" }}>
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: "var(--surface)", border: "1px solid var(--line-strong)" }}>
          <Icon name="chevron" className="h-4 w-4 rotate-180" />
        </button>
        <h2 className="font-display text-xl font-bold">Bekreft tur</h2>
      </div>

      {/* route summary */}
      <div className="mt-6 rounded-3xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "0 2px 8px rgba(11,14,20,0.05)" }}>
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--green)" }} />
          <p className="flex-1 text-sm font-medium">Min posisjon · Solli plass 3</p>
        </div>
        <div className="ml-1 h-5 w-px" style={{ background: "var(--line-strong)" }} />
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--red)" }} />
          <p className="flex-1 text-sm font-medium">Oslo Lufthavn Gardermoen</p>
        </div>
      </div>

      {/* fare breakdown */}
      <div className="mt-4 rounded-3xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{name}</p>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: "var(--green)" }}>Fastpris</span>
        </div>
        <div className="mt-3">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between py-1.5 text-sm"><span className="text-[var(--ink-soft)]">{k}</span><span className="font-medium">{v} kr</span></div>
          ))}
          <div className="mt-2 flex justify-between border-t pt-3 font-display text-base font-bold" style={{ borderColor: "var(--line)" }}>
            <span>Totalt</span><span>{price.split("–")[1] ?? price} kr</span>
          </div>
        </div>
      </div>

      {/* payment method */}
      <button className="mt-4 flex items-center gap-3 rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <Icon name="card" className="h-5 w-5 text-[var(--ink-soft)]" />
        <span className="flex-1 text-left text-sm font-semibold">Apple Pay · Visa ••42</span>
        <span className="font-mono text-[10px] tracking-widest text-[var(--red)]">ENDRE</span>
      </button>

      <button onClick={onConfirm} className="mt-auto rounded-full py-4 font-display text-base font-bold text-white transition-transform active:scale-95" style={{ background: "linear-gradient(120deg,#ff3b3b,#ff0000)", boxShadow: "0 14px 34px rgba(255,0,0,0.4)" }}>
        Bekreft tur
      </button>
    </div>
  )
}

/* ---------- matching overlay ---------- */
function Matching({ onMatched }: { onMatched: () => void }) {
  useEffect(() => {
    const t = setTimeout(onMatched, 2400)
    return () => clearTimeout(t)
  }, [onMatched])
  return (
    <div className="relative h-full">
      <LiveMap />
      <div className="absolute inset-0 z-[500] flex flex-col items-center justify-end pb-40" style={{ background: "linear-gradient(180deg, rgba(244,246,250,0.2), rgba(244,246,250,0.75))" }}>
        <div className="flex flex-col items-center rounded-3xl px-10 py-8" style={{ background: "rgba(255,255,255,0.96)", border: "1px solid var(--line)", boxShadow: "0 16px 40px rgba(11,14,20,0.14)" }}>
          <div className="relative flex h-16 w-16 items-center justify-center">
            <span className="absolute inset-0 rounded-full border-2 border-transparent" style={{ borderTopColor: "var(--blue)", animation: "spin 0.9s linear infinite" }} />
            <SnarMark size={40} />
          </div>
          <p className="mt-5 font-display text-base font-semibold">Finner din sjåfør…</p>
          <p className="mt-1 text-xs text-[var(--ink-soft)]">Matcher med nærmeste SNAR AI-bil</p>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

/* ---------- arriving / verify ---------- */
function DriverCard({ verify = false }: { verify?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl p-3" style={{ background: "var(--surface-soft)", border: "1px solid var(--line)" }}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full font-display text-lg font-semibold text-white" style={{ background: "linear-gradient(135deg,#ff3b3b,#ff0000)" }}>E</div>
      <div className="flex-1">
        <p className="text-sm font-semibold">Eirik Sandvik</p>
        <p className="font-mono text-[11px] text-[var(--ink-soft)]">Tesla Model Y · Perle Hvit</p>
      </div>
      {verify ? (
        <div className="rounded-lg px-3 py-1.5 text-center" style={{ background: "#fff", border: "1px solid var(--line-strong)" }}>
          <p className="font-mono text-[9px] tracking-widest text-[var(--ink-faint)]">SKILT</p>
          <p className="font-display text-sm font-bold tracking-wider">EL 73921</p>
        </div>
      ) : (
        <div className="flex items-center gap-1 text-sm font-semibold">
          <Icon name="star" className="h-3.5 w-3.5 text-[var(--blue)]" />4,98
        </div>
      )}
    </div>
  )
}

function Arriving({ onStart }: { onStart: () => void }) {
  const [eta, setEta] = useState(4)
  useEffect(() => {
    const t = setInterval(() => setEta((e) => (e > 1 ? e - 1 : e)), 3000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="relative h-full">
      <LiveMap />
      <div className="absolute inset-x-4 top-4 z-[500] rounded-2xl px-4 py-3 text-center" style={{ background: "rgba(255,255,255,0.96)", border: "1px solid var(--line)", boxShadow: "0 8px 24px rgba(11,14,20,0.1)" }}>
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--blue)]">Sjåføren er på vei</p>
        <p className="font-display text-xl font-semibold">Ankommer om {eta} min</p>
      </div>
      <div className="absolute inset-x-0 bottom-0 z-[500] rounded-t-[30px] px-6 pb-28 pt-5" style={{ background: "rgba(255,255,255,0.97)", borderTop: "1px solid var(--line)", boxShadow: "0 -20px 50px rgba(11,14,20,0.12)" }}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: "var(--line-strong)" }} />
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[var(--ink-faint)]">Bekreft sjåfør og bil</p>
        <DriverCard verify />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-medium transition-transform active:scale-95" style={{ background: "var(--surface)", border: "1px solid var(--line-strong)" }}>
            <Icon name="phone" className="h-4 w-4" /> Ring
          </button>
          <button className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-medium transition-transform active:scale-95" style={{ background: "var(--surface)", border: "1px solid var(--line-strong)" }}>
            <Icon name="chat" className="h-4 w-4" /> Melding
          </button>
        </div>
        <button onClick={onStart} className="mt-3 w-full rounded-full py-4 font-display text-sm font-semibold text-white transition-transform active:scale-95" style={{ background: "linear-gradient(120deg,#ff3b3b,#ff0000)", boxShadow: "0 12px 30px rgba(255,0,0,0.35)" }}>
          Sjåføren har hentet meg
        </button>
      </div>
    </div>
  )
}

/* ---------- in ride ---------- */
function InRide({ onEnd }: { onEnd: () => void }) {
  const [pct, setPct] = useState(0.15)
  useEffect(() => {
    const t = setInterval(() => setPct((p) => Math.min(1, p + 0.12)), 1500)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="relative h-full">
      <LiveMap />
      {/* persistent banner */}
      <div className="absolute inset-x-4 top-4 z-[500] rounded-2xl px-4 py-3" style={{ background: "rgba(255,255,255,0.96)", border: "1px solid var(--line)", boxShadow: "0 8px 24px rgba(11,14,20,0.1)" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--blue)]">Underveis · neste: Ring 2</p>
            <p className="text-sm font-semibold">Eirik · Tesla Model Y · EL 73921</p>
          </div>
          <p className="font-display text-lg font-semibold">14:32</p>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface-soft)" }}>
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct * 100}%`, background: "var(--blue)" }} />
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-[500] rounded-t-[30px] px-6 pb-28 pt-5" style={{ background: "rgba(255,255,255,0.97)", borderTop: "1px solid var(--line)", boxShadow: "0 -20px 50px rgba(11,14,20,0.12)" }}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: "var(--line-strong)" }} />
        <div className="grid grid-cols-3 gap-3">
          <button className="flex flex-col items-center gap-1.5 rounded-2xl py-3 text-xs font-medium transition-transform active:scale-95" style={{ background: "var(--surface)", border: "1px solid var(--line-strong)" }}>
            <Icon name="shield" className="h-5 w-5 text-[var(--blue)]" /> Del tur
          </button>
          <button className="flex flex-col items-center gap-1.5 rounded-2xl py-3 text-xs font-medium transition-transform active:scale-95" style={{ background: "var(--surface)", border: "1px solid var(--line-strong)" }}>
            <Icon name="plus" className="h-5 w-5 text-[var(--blue)]" /> Legg til stopp
          </button>
          <button className="flex flex-col items-center gap-1.5 rounded-2xl py-3 text-xs font-semibold text-white transition-transform active:scale-95" style={{ background: "#e11d48" }}>
            <Icon name="shield" className="h-5 w-5" /> SOS
          </button>
        </div>
        <button onClick={onEnd} className="mt-4 w-full rounded-full py-4 font-display text-sm font-semibold text-white transition-transform active:scale-95" style={{ background: "linear-gradient(120deg,#ff3b3b,#ff0000)", boxShadow: "0 12px 30px rgba(255,0,0,0.35)" }}>
          Avslutt tur (demo)
        </button>
      </div>
    </div>
  )
}

/* ---------- receipt + rating ---------- */
function Receipt({ onDone }: { onDone: () => void }) {
  const [rating, setRating] = useState(0)
  const rows = [["Grunnpris", "89,00"], ["Distanse (8,4 km)", "58,00"], ["Ventetid", "6,00"], ["Mva.", "16,00"]]
  return (
    <div className="flex h-full flex-col overflow-y-auto px-7 pt-14 pb-8" style={{ background: "linear-gradient(180deg,#ffffff,#f2f5fa)" }}>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full text-white" style={{ background: "var(--green)" }}>✓</span>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--green)" }}>Betalt automatisk</p>
          <h2 className="font-display text-xl font-semibold">Takk for turen!</h2>
        </div>
      </div>

      <div className="mt-6 rounded-3xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between py-1.5 text-sm">
            <span className="text-[var(--ink-soft)]">{k}</span><span className="font-medium">{v} kr</span>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t pt-3 font-display text-base font-semibold" style={{ borderColor: "var(--line)" }}>
          <span>Totalt</span><span>169,00 kr</span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-[var(--ink-soft)]"><Icon name="card" className="h-4 w-4" /> Apple Pay · Visa ••42</div>
      </div>

      <div className="mt-6 rounded-3xl p-5 text-center" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <DriverCard />
        <p className="mt-4 text-sm font-medium">Hvordan var turen?</p>
        <div className="mt-3 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setRating(n)}>
              <Icon name="star" className={`h-8 w-8 ${n <= rating ? "text-[var(--blue)]" : "text-[var(--line-strong)]"}`} />
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        {["Ros sjåfør", "Meld sak", "Mistet noe"].map((t) => (
          <button key={t} className="rounded-xl py-2.5 font-medium" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>{t}</button>
        ))}
      </div>

      <button onClick={onDone} className="mt-6 rounded-full py-4 font-display text-sm font-semibold text-white transition-transform active:scale-95" style={{ background: "linear-gradient(120deg,#ff3b3b,#ff0000)", boxShadow: "0 12px 30px rgba(255,0,0,0.35)" }}>
        Ferdig
      </button>
    </div>
  )
}

/* ---------- other tabs ---------- */
function ListScreen({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto px-7 pb-28 pt-14" style={{ background: "linear-gradient(180deg,#ffffff,#f2f5fa)" }}>
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <div className="mt-6 flex flex-col gap-3">{children}</div>
    </div>
  )
}

function Activity() {
  const trips = [
    { to: "Oslo Lufthavn", date: "I dag · 08:12", price: "169", cat: "SNAR AI" },
    { to: "Aker Brygge", date: "I går · 19:40", price: "129", cat: "Comfort" },
    { to: "Vulkan", date: "22. sep · 12:05", price: "98", cat: "SNAR AI" },
  ]
  return (
    <ListScreen title="Aktivitet">
      {trips.map((t, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <span className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--blue)]" style={{ background: "var(--blue-soft)" }}><Icon name="loc" /></span>
          <div className="flex-1">
            <p className="text-sm font-semibold">{t.to}</p>
            <p className="text-xs text-[var(--ink-soft)]">{t.date} · {t.cat}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-sm font-semibold">{t.price} kr</p>
            <button className="font-mono text-[10px] tracking-widest text-[var(--blue)]">BESTILL IGJEN</button>
          </div>
        </div>
      ))}
    </ListScreen>
  )
}

function Wallet() {
  return (
    <ListScreen title="Lommebok">
      <div className="rounded-3xl p-5 text-white" style={{ background: "linear-gradient(135deg,#ff3b3b,#b30000)" }}>
        <p className="font-mono text-[10px] tracking-widest opacity-80">SNAR-KREDITT</p>
        <p className="mt-2 font-display text-3xl font-semibold">0,00 kr</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold">Kommer snart</span>
          <p className="text-xs opacity-80">Verving lanseres senere</p>
        </div>
      </div>
      {[
        { icon: "card", label: "Apple Pay", sub: "Standard", tag: "Aktiv" },
        { icon: "card", label: "Google Pay", sub: "Google-konto" },
        { icon: "card", label: "Visa ••42", sub: "Utløper 07/28" },
        { icon: "plus", label: "Legg til betalingsmåte", sub: "Kort · Vipps · Google Pay" },
      ].map((m) => (
        <div key={m.label} className="flex items-center gap-3 rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <span className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--ink-soft)]" style={{ background: "var(--surface-soft)" }}><Icon name={m.icon} /></span>
          <div className="flex-1"><p className="text-sm font-semibold">{m.label}</p><p className="text-xs text-[var(--ink-soft)]">{m.sub}</p></div>
          {m.tag && <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: "var(--green)" }}>{m.tag}</span>}
        </div>
      ))}
      <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px dashed var(--line-strong)" }}>
        <p className="text-sm font-semibold">Har du en kampanjekode?</p>
        <div className="mt-2 flex gap-2">
          <input placeholder="KODE" className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: "var(--surface-soft)", border: "1px solid var(--line)" }} />
          <button className="rounded-xl px-4 text-sm font-semibold text-white" style={{ background: "var(--blue)" }}>Bruk</button>
        </div>
      </div>
    </ListScreen>
  )
}

/* small toggle used across settings sub-screens */
function Toggle({ on, set }: { on: boolean; set: (v: boolean) => void }) {
  return (
    <button onClick={() => set(!on)} className="relative h-7 w-12 shrink-0 rounded-full transition-colors" style={{ background: on ? "var(--blue)" : "var(--line-strong)" }}>
      <span className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all" style={{ left: on ? "22px" : "2px" }} />
    </button>
  )
}

/* detail sub-screen wrapper with a back button */
function Sub({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto px-7 pb-28 pt-14" style={{ background: "linear-gradient(180deg,#ffffff,#f2f5fa)" }}>
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: "var(--surface)", border: "1px solid var(--line-strong)" }}>
          <Icon name="chevron" className="h-4 w-4 rotate-180" />
        </button>
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
      </div>
      <div className="mt-6 flex flex-col gap-3">{children}</div>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>{children}</div>
}

/* ---------- AI support assistant ---------- */
type Msg = { from: "ai" | "me"; text: string }
function Support({ onBack }: { onBack: () => void }) {
  const faqs = [
    { q: "Hvordan fungerer fastpris?", a: "Fastprisen beregnes før du bestiller, ut fra distanse og estimert tid. Den endrer seg ikke selv om det blir kø eller omkjøring — du betaler alltid det du så da du bekreftet turen." },
    { q: "Jeg glemte noe i bilen", a: "Så kjedelig! Gå til Aktivitet → velg turen → «Mistet noe», så setter jeg deg i kontakt med sjåføren. Gjenstander oppbevares trygt i 14 dager." },
    { q: "Endre destinasjon underveis", a: "Trykk «Legg til stopp» i turskjermen, eller be sjåføren direkte. Prisen justeres automatisk og vises før endringen bekreftes." },
    { q: "Refusjon og klage på en tur", a: "Du kan klage innen 30 dager via Aktivitet → «Meld sak». Jeg vurderer saken umiddelbart, og enkle refusjoner behandles automatisk." },
  ]
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: "ai", text: "Hei! Jeg er SNAR AI-assistent 🤖 Spør meg om det meste, eller velg et vanlig tema under. Trenger du et menneske, sender jeg saken videre." },
  ])
  const [input, setInput] = useState("")
  const [code, setCode] = useState("")

  const askFaq = (f: { q: string; a: string }) => setMsgs((m) => [...m, { from: "me", text: f.q }, { from: "ai", text: f.a }])
  const send = () => {
    const t = input.trim()
    if (!t) return
    setInput("")
    setMsgs((m) => [...m, { from: "me", text: t }, { from: "ai", text: "Takk! Dette ser ut som en henvendelse et menneske bør se på. Jeg har opprettet sak #SNAR-4821 — du får svar på e-post innen 24 t, eller start live chat nedenfor for umiddelbar hjelp." }])
  }
  const redeem = () => {
    const c = code.trim().toUpperCase()
    if (!c) return
    setCode("")
    setMsgs((m) => [...m, { from: "me", text: `Løs inn: ${c}` }, { from: "ai", text: `🎁 Koden ${c} er godkjent! 50 kr er lagt til SNAR-kreditten din. Den brukes automatisk på neste tur.` }])
  }

  return (
    <div className="flex h-full flex-col" style={{ background: "linear-gradient(180deg,#ffffff,#f2f5fa)" }}>
      <div className="flex items-center gap-3 px-7 pt-14 pb-3">
        <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: "var(--surface)", border: "1px solid var(--line-strong)" }}>
          <Icon name="chevron" className="h-4 w-4 rotate-180" />
        </button>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full text-white" style={{ background: "linear-gradient(135deg,#ff3b3b,#ff0000)" }}><Icon name="sparkle" className="h-4 w-4" /></span>
          <div>
            <h2 className="font-display text-lg font-semibold leading-tight">Kundestøtte</h2>
            <p className="font-mono text-[9px] tracking-widest text-[var(--green)]">● SNAR AI · SVARER NÅ</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4">
        {/* FAQ chips */}
        <div className="mb-3 flex flex-wrap gap-2">
          {faqs.map((f) => (
            <button key={f.q} onClick={() => askFaq(f)} className="rounded-full px-3 py-2 text-left text-xs font-medium transition-transform active:scale-95" style={{ background: "var(--surface)", border: "1px solid var(--line-strong)", color: "var(--ink-soft)" }}>{f.q}</button>
          ))}
        </div>

        {/* chat thread */}
        <div className="flex flex-col gap-2.5">
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-snug" style={m.from === "me" ? { background: "linear-gradient(120deg,#ff3b3b,#ff0000)", color: "#fff", borderBottomRightRadius: 6 } : { background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink)", borderBottomLeftRadius: 6 }}>{m.text}</div>
            </div>
          ))}
        </div>

        {/* code / reward */}
        <div className="mt-4 rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px dashed var(--line-strong)" }}>
          <div className="flex items-center gap-2">
            <Icon name="gift" className="h-4 w-4 text-[var(--blue)]" />
            <p className="text-sm font-semibold">Kode eller reward</p>
          </div>
          <div className="mt-2 flex gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="F.eks. VENN50" className="flex-1 rounded-xl px-3 py-2.5 text-sm uppercase outline-none" style={{ background: "var(--surface-soft)", border: "1px solid var(--line)" }} />
            <button onClick={redeem} className="rounded-xl px-4 text-sm font-semibold text-white" style={{ background: "var(--blue)" }}>Løs inn</button>
          </div>
        </div>
      </div>

      {/* input + escalation */}
      <div className="px-5 pb-6 pt-2" style={{ borderTop: "1px solid var(--line)", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)" }}>
        <div className="flex items-center gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Skriv til oss…" className="flex-1 rounded-full px-4 py-3 text-sm outline-none" style={{ background: "var(--surface)", border: "1px solid var(--line-strong)" }} />
          <button onClick={send} className="flex h-11 w-11 items-center justify-center rounded-full text-white transition-transform active:scale-90" style={{ background: "linear-gradient(120deg,#ff3b3b,#ff0000)" }}><Icon name="send" className="h-5 w-5" /></button>
        </div>
        <button className="mt-2 flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-xs font-semibold text-[var(--ink-soft)]" style={{ border: "1px solid var(--line)" }}>
          <Icon name="chat" className="h-4 w-4" /> Kontakt oss · live chat med menneske
        </button>
      </div>
    </div>
  )
}

type ProfileView = "menu" | "addresses" | "safety" | "privacy" | "payment" | "help" | "language"

function Profile({ onLogout }: { onLogout: () => void }) {
  const [view, setView] = useState<ProfileView>("menu")

  // privacy (GDPR) consents
  const [analytics, setAnalytics] = useState(true)
  const [marketing, setMarketing] = useState(false)
  const [locationHist, setLocationHist] = useState(true)
  const [personalise, setPersonalise] = useState(true)
  // safety
  const [autoShare, setAutoShare] = useState(false)
  const [rideCheck, setRideCheck] = useState(true)
  // language / accessibility
  const [bigText, setBigText] = useState(false)
  const [highContrast, setHighContrast] = useState(false)
  const [haptics, setHaptics] = useState(true)

  if (view === "addresses") {
    return (
      <Sub title="Favorittadresser" onBack={() => setView("menu")}>
        {[["home", "Hjem", "Thorvald Meyers gate 12"], ["work", "Jobb", "Aker Brygge 2"], ["recent", "Hytta", "Norefjell 40"]].map(([ic, l, a]) => (
          <div key={l} className="flex items-center gap-3"><Card><div className="flex w-full items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--ink-soft)]" style={{ background: "var(--surface-soft)" }}><Icon name={ic} /></span><div className="flex-1"><p className="text-sm font-semibold">{l}</p><p className="text-xs text-[var(--ink-soft)]">{a}</p></div><button className="font-mono text-[10px] tracking-widest text-[var(--blue)]">ENDRE</button></div></Card></div>
        ))}
        <button className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-[var(--blue)]" style={{ border: "1px dashed var(--line-strong)" }}><Icon name="plus" className="h-4 w-4" /> Legg til adresse</button>
      </Sub>
    )
  }
  if (view === "safety") {
    return (
      <Sub title="Sikkerhetssenter" onBack={() => setView("menu")}>
        <Card><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--red)]" style={{ background: "var(--red-soft)" }}><Icon name="shield" /></span><div className="flex-1"><p className="text-sm font-semibold">Nødkontakter</p><p className="text-xs text-[var(--ink-soft)]">Mamma · Jonas — varsles ved SOS</p></div><Icon name="chevron" className="h-4 w-4 text-[var(--ink-faint)]" /></div></Card>
        <Card><div className="flex items-center gap-3"><div className="flex-1"><p className="text-sm font-semibold">Del turen automatisk</p><p className="text-xs text-[var(--ink-soft)]">Del sanntidsposisjon med nødkontakter på hver tur</p></div><Toggle on={autoShare} set={setAutoShare} /></div></Card>
        <Card><div className="flex items-center gap-3"><div className="flex-1"><p className="text-sm font-semibold">RideCheck innsjekk</p><p className="text-xs text-[var(--ink-soft)]">Sjekker inn ved uventede stopp på lange turer</p></div><Toggle on={rideCheck} set={setRideCheck} /></div></Card>
        <Card><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--green)]" style={{ background: "rgba(18,185,129,0.12)" }}><Icon name="shield" /></span><div className="flex-1"><p className="text-sm font-semibold">Sjåførverifisering</p><p className="text-xs text-[var(--ink-soft)]">Foto-ID og skiltmatch aktiv</p></div></div></Card>
        <button className="mt-2 flex items-center justify-center gap-2 rounded-full py-4 text-sm font-semibold text-white" style={{ background: "linear-gradient(120deg,#ff3b3b,#ff0000)" }}><Icon name="shield" className="h-4 w-4" /> Nødhjelp (112)</button>
      </Sub>
    )
  }
  if (view === "privacy") {
    const rows: [string, string, boolean, (v: boolean) => void][] = [
      ["Personalisering", "Bruk turhistorikk til å forbedre forslag", personalise, setPersonalise],
      ["Lagre stedshistorikk", "Behold besøkte steder for raskere bestilling", locationHist, setLocationHist],
      ["Analyse og forbedring", "Anonym bruksstatistikk", analytics, setAnalytics],
      ["Markedsføring", "Tilbud og kampanjer på e-post/SMS", marketing, setMarketing],
    ]
    return (
      <Sub title="Personvern" onBack={() => setView("menu")}>
        <p className="text-xs leading-relaxed text-[var(--ink-soft)]">Du bestemmer over dine data. SNAR følger GDPR — endre samtykker når som helst.</p>
        {rows.map(([l, s, on, set]) => (
          <Card key={l}><div className="flex items-center gap-3"><div className="flex-1"><p className="text-sm font-semibold">{l}</p><p className="text-xs text-[var(--ink-soft)]">{s}</p></div><Toggle on={on} set={set} /></div></Card>
        ))}
        <div className="mt-2 flex flex-col gap-3">
          <button className="flex items-center gap-3 rounded-2xl p-4 text-left" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}><span className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--blue)]" style={{ background: "var(--blue-soft)" }}><Icon name="card" /></span><div className="flex-1"><p className="text-sm font-semibold">Last ned mine data</p><p className="text-xs text-[var(--ink-soft)]">Få en kopi av all lagret informasjon</p></div><Icon name="chevron" className="h-4 w-4 text-[var(--ink-faint)]" /></button>
          <button className="flex items-center gap-3 rounded-2xl p-4 text-left" style={{ background: "var(--surface)", border: "1px solid var(--red-soft)" }}><span className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--red)]" style={{ background: "var(--red-soft)" }}><Icon name="close" /></span><div className="flex-1"><p className="text-sm font-semibold text-[var(--red)]">Slett konto og data</p><p className="text-xs text-[var(--ink-soft)]">Fjerner kontoen din permanent</p></div></button>
        </div>
        <p className="mt-1 text-center text-[11px] text-[var(--ink-faint)]">Les personvernerklæringen og vilkårene</p>
      </Sub>
    )
  }
  if (view === "payment") {
    return (
      <Sub title="Betaling og kvitteringer" onBack={() => setView("menu")}>
        {[["Apple Pay", "Standard", "Aktiv"], ["Google Pay", "Google-konto", ""], ["Visa ••42", "Utløper 07/28", ""], ["Vipps", "+47 900 00 000", ""]].map(([l, s, tag]) => (
          <Card key={l}><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--ink-soft)]" style={{ background: "var(--surface-soft)" }}><Icon name="card" /></span><div className="flex-1"><p className="text-sm font-semibold">{l}</p><p className="text-xs text-[var(--ink-soft)]">{s}</p></div>{tag && <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: "var(--green)" }}>{tag}</span>}</div></Card>
        ))}
        <button className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-[var(--blue)]" style={{ border: "1px dashed var(--line-strong)" }}><Icon name="plus" className="h-4 w-4" /> Legg til betalingsmåte</button>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-[var(--ink-faint)]">Kvitteringer</p>
        {[["Oslo Lufthavn", "169 kr · i dag"], ["Aker Brygge", "129 kr · i går"]].map(([l, s]) => (
          <Card key={l}><div className="flex items-center gap-3"><div className="flex-1"><p className="text-sm font-semibold">{l}</p><p className="text-xs text-[var(--ink-soft)]">{s}</p></div><button className="font-mono text-[10px] tracking-widest text-[var(--blue)]">SEND PDF</button></div></Card>
        ))}
      </Sub>
    )
  }
  if (view === "help") {
    return <Support onBack={() => setView("menu")} />
  }
  if (view === "language") {
    return (
      <Sub title="Språk og tilgjengelighet" onBack={() => setView("menu")}>
        <Card><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--ink-soft)]" style={{ background: "var(--surface-soft)" }}><Icon name="globe" /></span><div className="flex-1"><p className="text-sm font-semibold">Språk</p><p className="text-xs text-[var(--ink-soft)]">Norsk (bokmål)</p></div><Icon name="chevron" className="h-4 w-4 text-[var(--ink-faint)]" /></div></Card>
        {[["Stor tekst", "Øk tekststørrelsen", bigText, setBigText], ["Høykontrast", "Sterkere farger og kontrast", highContrast, setHighContrast], ["Haptisk respons", "Vibrasjon ved viktige handlinger", haptics, setHaptics]].map(([l, s, on, set]) => (
          <Card key={l as string}><div className="flex items-center gap-3"><div className="flex-1"><p className="text-sm font-semibold">{l as string}</p><p className="text-xs text-[var(--ink-soft)]">{s as string}</p></div><Toggle on={on as boolean} set={set as (v: boolean) => void} /></div></Card>
        ))}
      </Sub>
    )
  }

  const items: { icon: string; label: string; sub: string; go: ProfileView }[] = [
    { icon: "home", label: "Favorittadresser", sub: "Hjem, Jobb, +1", go: "addresses" },
    { icon: "shield", label: "Sikkerhetssenter", sub: "Nødkontakter, deling, verifisering", go: "safety" },
    { icon: "card", label: "Betaling og kvitteringer", sub: "Apple Pay, Google Pay, kort", go: "payment" },
    { icon: "shield", label: "Personvern", sub: "Samtykker, data, GDPR", go: "privacy" },
    { icon: "sparkle", label: "Kundestøtte", sub: "AI-assistent, kontakt oss, kode/reward", go: "help" },
    { icon: "globe", label: "Språk og tilgjengelighet", sub: "Norsk · Stor tekst · Høykontrast", go: "language" },
  ]
  return (
    <ListScreen title="Profil">
      <div className="flex items-center gap-4 rounded-3xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <div className="flex h-14 w-14 items-center justify-center rounded-full font-display text-xl font-semibold text-white" style={{ background: "linear-gradient(135deg,#ff3b3b,#ff0000)" }}>A</div>
        <div className="flex-1"><p className="font-display text-lg font-semibold">Astrid Hansen</p><p className="text-xs text-[var(--ink-soft)]">+47 900 00 000 · 4,96 ★</p></div>
      </div>
      {items.map((it) => (
        <button key={it.label} onClick={() => setView(it.go)} className="flex items-center gap-3 rounded-2xl p-4 text-left transition-colors active:opacity-70" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <span className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--blue)]" style={{ background: "var(--blue-soft)" }}><Icon name={it.icon} /></span>
          <div className="flex-1"><p className="text-sm font-semibold">{it.label}</p><p className="text-xs text-[var(--ink-soft)]">{it.sub}</p></div>
          <Icon name="chevron" className="h-4 w-4 text-[var(--ink-faint)]" />
        </button>
      ))}
      <button onClick={onLogout} className="mt-2 rounded-2xl py-3.5 text-sm font-semibold text-[var(--red)]" style={{ background: "var(--surface)", border: "1px solid var(--red-soft)" }}>Logg ut</button>
    </ListScreen>
  )
}

/* ---------- root ---------- */
export default function CustomerApp() {
  const [screen, setScreen] = useState<Screen>("splash")
  const [tab, setTab] = useState("ride")
  const [stage, setStage] = useState<RideStage>("browse")
  const [ride, setRide] = useState({ name: "SNAR AI", price: "149–169" })

  const reset = () => { setScreen("splash"); setTab("ride"); setStage("browse") }

  let body: React.ReactNode = null
  if (screen === "splash") body = <Splash variant="customer" onEnter={() => setScreen("permissions")} />
  else if (screen === "permissions") body = <Permissions onDone={() => setScreen("login")} />
  else if (screen === "login") body = <Login variant="customer" onDone={() => setScreen("setup")} />
  else if (screen === "setup") body = <ProfileSetup onDone={() => setScreen("app")} />
  else {
    if (tab === "ride") {
      if (stage === "browse") body = <Browse onBook={(name, price) => { setRide({ name, price }); setStage("confirm") }} />
      else if (stage === "confirm") body = <Confirm name={ride.name} price={ride.price} onConfirm={() => setStage("matching")} onBack={() => setStage("browse")} />
      else if (stage === "matching") body = <Matching onMatched={() => setStage("arriving")} />
      else if (stage === "arriving") body = <Arriving onStart={() => setStage("inride")} />
      else if (stage === "inride") body = <InRide onEnd={() => setStage("receipt")} />
      else body = <Receipt onDone={() => setStage("browse")} />
    } else if (tab === "activity") body = <Activity />
    else if (tab === "wallet") body = <Wallet />
    else body = <Profile onLogout={() => setScreen("login")} />
  }

  const showTabs = screen === "app" && !(tab === "ride" && stage !== "browse" && stage !== "receipt")

  return (
    <div className="relative h-full">
      {body}
      {showTabs && <TaskBar active={tab} onChange={(t) => { setTab(t); setStage("browse") }} />}
      {screen !== "splash" && (
        <button onClick={reset} className="absolute right-3 top-3 z-[610] rounded-full px-2.5 py-1 font-mono text-[9px] tracking-widest text-[var(--ink-faint)]" style={{ background: "rgba(255,255,255,0.85)", border: "1px solid var(--line)", backdropFilter: "blur(10px)" }}>
          RESET
        </button>
      )}
    </div>
  )
}
