import { useEffect, useState } from "react"
import Splash from "../screens/Splash"
import Login from "../screens/Login"
import LiveMap from "../components/LiveMap"
import SnarMark from "../components/SnarMark"

type Screen = "splash" | "login" | "documents" | "app"
type Stage = "dashboard" | "request" | "topickup" | "pickup" | "intrip" | "complete"
type Tab = "home" | "earnings" | "profile"

function Icon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  const p: Record<string, React.ReactNode> = {
    phone: <path d="M5 4h4l2 5-2 1a11 11 0 005 5l1-2 5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round" />,
    chat: <path d="M4 5h16v11H9l-4 3z" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round" />,
    nav: <path d="M12 2l9 20-9-5-9 5z" fill="currentColor" />,
    home: <path d="M4 11l8-7 8 7M6 10v9h12v-9" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
    chart: <path d="M3 12h4l2 6 4-14 2 8h6" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
    star: <path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3 5.8 20.9l1.6-6.8L2.2 8.9l6.9-.6z" fill="currentColor" />,
    doc: <path d="M6 3h8l4 4v14H6zM14 3v4h4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round" />,
    check: <path d="M5 12l5 5L20 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
    car: <path d="M6 16l2-6a3 3 0 013-2h2a3 3 0 013 2l2 6M5 16h14v3H5zM8 19v1M16 19v1" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
    user: <><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.6" fill="none" /><path d="M4 20a8 8 0 0116 0" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" /></>,
    shield: <path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round" />,
    chevron: <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />,
    plus: <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
    globe: <><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" fill="none" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" stroke="currentColor" strokeWidth="1.6" fill="none" /></>,
    bell: <path d="M6 16V10a6 6 0 1112 0v6l2 2H4zM10 20a2 2 0 004 0" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round" />,
  }
  return <svg viewBox="0 0 24 24" className={className}>{p[name]}</svg>
}

function Stat({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "0 2px 6px rgba(11,14,20,0.04)" }}>
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--ink-faint)]">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold" style={{ color: accent }}>
        {value}{unit && <span className="ml-1 text-xs font-normal text-[var(--ink-soft)]">{unit}</span>}
      </p>
    </div>
  )
}

/* ---------- dashboard with online/offline ---------- */
function Dashboard({ online, setOnline, onRequest }: { online: boolean; setOnline: (v: boolean) => void; onRequest: () => void }) {
  return (
    <div className="relative h-full">
      {online && <LiveMap />}
      {online && (
        <div className="pointer-events-none absolute inset-0 z-[450]">
          {[
            { top: "24%", left: "30%", s: 150 },
            { top: "42%", left: "62%", s: 120 },
            { top: "58%", left: "40%", s: 100 },
          ].map((h, i) => (
            <span key={i} className="absolute rounded-full" style={{ top: h.top, left: h.left, width: h.s, height: h.s, transform: "translate(-50%,-50%)", background: "radial-gradient(circle, rgba(255,0,0,0.32), rgba(255,0,0,0.12) 45%, transparent 70%)" }} />
          ))}
        </div>
      )}
      <div className={online ? "" : "h-full overflow-y-auto"} style={online ? {} : { background: "linear-gradient(180deg,#ffffff,#f2f5fa)" }}>
        {/* header + toggle */}
        <div className="absolute inset-x-4 top-4 z-[500]">
          <div className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: "rgba(255,255,255,0.96)", border: "1px solid var(--line)", boxShadow: "0 8px 24px rgba(11,14,20,0.1)" }}>
            <div className="flex items-center gap-3">
              <SnarMark size={34} />
              <div>
                <p className="text-sm font-semibold">Eirik Sandvik</p>
                <p className="font-mono text-[10px] tracking-widest" style={{ color: online ? "var(--green)" : "var(--ink-faint)" }}>{online ? "● ONLINE" : "OFFLINE"}</p>
              </div>
            </div>
            <button onClick={() => setOnline(!online)} className="relative h-8 w-14 rounded-full transition-colors" style={{ background: online ? "var(--green)" : "var(--line-strong)" }}>
              <span className="absolute top-0.5 h-7 w-7 rounded-full bg-white shadow transition-all" style={{ left: online ? "26px" : "2px" }} />
            </button>
          </div>
        </div>

        {online ? (
          <div className="absolute inset-x-0 bottom-0 z-[500] rounded-t-[30px] px-6 pb-8 pt-5" style={{ background: "rgba(255,255,255,0.97)", borderTop: "1px solid var(--line)", boxShadow: "0 -20px 50px rgba(11,14,20,0.12)" }}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: "var(--line-strong)" }} />
            <div className="flex items-center gap-3 rounded-2xl p-4" style={{ background: "var(--blue-soft)", border: "1px solid var(--blue)" }}>
              <span className="flex h-11 w-11 items-center justify-center rounded-full text-white" style={{ background: "var(--blue)" }}><Icon name="nav" /></span>
              <div className="flex-1">
                <p className="text-sm font-semibold">Kjør mot Aker Brygge</p>
                <p className="text-xs text-[var(--ink-soft)]">Høy etterspørsel · +42% inntjening</p>
              </div>
            </div>
            <button onClick={onRequest} className="mt-4 w-full rounded-full py-4 font-display text-sm font-semibold text-white transition-transform active:scale-95" style={{ background: "linear-gradient(120deg,#ff3b3b,#ff0000)", boxShadow: "0 12px 30px rgba(255,0,0,0.35)" }}>
              Simuler forespørsel
            </button>
            <p className="mt-3 text-center text-xs text-[var(--ink-soft)]">Venter på turer i nærheten…</p>
          </div>
        ) : (
          <div className="px-6 pb-28 pt-24">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-faint)]">Inntjening i dag</p>
            <p className="mt-1 font-display text-4xl font-semibold">2 480 <span className="text-lg font-normal text-[var(--ink-soft)]">kr</span></p>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <Stat label="Turer" value="14" accent="var(--ink)" />
              <Stat label="Online" value="6,2" unit="t" accent="var(--blue)" />
              <Stat label="Vurdering" value="4,97" accent="var(--green)" />
            </div>
            <div className="mt-5 rounded-3xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Oppdrag: 20 turer</p>
                <p className="font-mono text-[11px] text-[var(--blue)]">+500 kr</p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ background: "var(--surface-soft)" }}>
                <div className="h-full rounded-full" style={{ width: "70%", background: "var(--blue)" }} />
              </div>
              <p className="mt-2 text-xs text-[var(--ink-soft)]">14 av 20 turer fullført</p>
            </div>
            <div className="mt-4 rounded-3xl p-5" style={{ background: "#fff7ed", border: "1px solid #fed7aa" }}>
              <p className="text-sm font-semibold text-[#9a3412]">Vedlikehold</p>
              <p className="text-xs text-[#c2410c]">Service anbefalt om 1 200 km</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- ride request modal with countdown ---------- */
function RequestModal({ onAccept, onDecline }: { onAccept: () => void; onDecline: () => void }) {
  const [sec, setSec] = useState(18)
  const [reasons, setReasons] = useState(false)
  useEffect(() => {
    if (reasons) return
    if (sec <= 0) { onDecline(); return }
    const t = setTimeout(() => setSec((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [sec, onDecline, reasons])

  if (reasons) {
    return (
      <div className="relative flex h-full flex-col justify-end" style={{ background: "rgba(11,14,20,0.4)" }}>
        <LiveMap />
        <div className="absolute inset-x-0 bottom-0 z-[600] rounded-t-[30px] px-6 pb-8 pt-5" style={{ background: "#fff", boxShadow: "0 -24px 60px rgba(11,14,20,0.3)" }}>
          <div className="flex items-center justify-between">
            <p className="font-display text-lg font-bold">Hvorfor avslår du?</p>
            <button onClick={() => setReasons(false)} className="flex h-8 w-8 items-center justify-center rounded-full text-lg" style={{ background: "var(--surface-soft)" }}>×</button>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {["For langt å kjøre", "Ikke egnet bil", "Skal snart av vakt", "Annet"].map((r) => (
              <button key={r} onClick={onDecline} className="rounded-2xl px-4 py-3.5 text-left text-sm font-medium transition-transform active:scale-95" style={{ background: "var(--surface)", border: "1px solid var(--line-strong)" }}>{r}</button>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-[var(--ink-soft)]">Forespørselen sendes til neste sjåfør</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex h-full flex-col justify-end" style={{ background: "rgba(11,14,20,0.4)" }}>
      <LiveMap />
      <div className="absolute inset-x-0 bottom-0 z-[600] rounded-t-[30px] px-6 pb-8 pt-5" style={{ background: "#fff", boxShadow: "0 -24px 60px rgba(11,14,20,0.3)" }}>
        <div className="flex items-center justify-between">
          <p className="font-display text-lg font-semibold">Ny tur</p>
          <div className="relative flex h-11 w-11 items-center justify-center">
            <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90"><circle cx="22" cy="22" r="19" fill="none" stroke="var(--surface-soft)" strokeWidth="4" /><circle cx="22" cy="22" r="19" fill="none" stroke="var(--blue)" strokeWidth="4" strokeLinecap="round" strokeDasharray={2 * Math.PI * 19} strokeDashoffset={2 * Math.PI * 19 * (1 - sec / 18)} /></svg>
            <span className="font-display text-sm font-bold">{sec}</span>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-2xl p-3" style={{ background: "var(--surface-soft)" }}>
          <div className="flex items-center gap-2 text-sm"><Icon name="star" className="h-4 w-4 text-[var(--blue)]" /> 4,9 passasjer</div>
          <p className="font-display text-lg font-semibold">185 kr</p>
        </div>
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--green)" }} /><p className="flex-1 text-sm">Solli plass 3</p><span className="font-mono text-[11px] text-[var(--ink-faint)]">2 min unna</span></div>
          <div className="ml-1 h-4 w-px" style={{ background: "var(--line-strong)" }} />
          <div className="flex items-center gap-3"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--blue)" }} /><p className="flex-1 text-sm">Oslo Lufthavn</p><span className="font-mono text-[11px] text-[var(--ink-faint)]">38 min tur</span></div>
        </div>
        <div className="mt-5 grid grid-cols-[1fr_1.6fr] gap-3">
          <button onClick={() => setReasons(true)} className="rounded-2xl py-4 text-sm font-medium text-[var(--ink-soft)] transition-transform active:scale-95" style={{ background: "var(--surface)", border: "1px solid var(--line-strong)" }}>Avslå</button>
          <button onClick={onAccept} className="rounded-2xl py-4 text-sm font-semibold text-white transition-transform active:scale-95" style={{ background: "var(--green)", boxShadow: "0 12px 28px rgba(18,185,129,0.3)" }}>Godta tur</button>
        </div>
      </div>
    </div>
  )
}

/* ---------- slide to confirm ---------- */
function SlideConfirm({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const [done, setDone] = useState(false)
  return (
    <button
      onClick={() => { setDone(true); setTimeout(onConfirm, 350) }}
      className="relative h-14 w-full overflow-hidden rounded-full text-sm font-semibold text-white transition-transform active:scale-[0.99]"
      style={{ background: "linear-gradient(120deg,#ff3b3b,#ff0000)", boxShadow: "0 12px 30px rgba(255,0,0,0.35)" }}
    >
      <span className="absolute inset-0 flex items-center justify-center">{label}</span>
      <span className="absolute top-1 flex h-12 w-12 items-center justify-center rounded-full bg-white transition-all duration-300" style={{ left: done ? "calc(100% - 52px)" : "4px", color: "var(--blue)" }}>→</span>
    </button>
  )
}

function ToPickup({ onArrived }: { onArrived: () => void }) {
  return (
    <div className="relative h-full">
      <LiveMap />
      <div className="absolute inset-x-4 top-4 z-[500] rounded-2xl px-4 py-3" style={{ background: "rgba(255,255,255,0.96)", border: "1px solid var(--line)", boxShadow: "0 8px 24px rgba(11,14,20,0.1)" }}>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full text-white" style={{ background: "var(--blue)" }}><Icon name="nav" /></span>
          <div><p className="font-display text-base font-semibold">Ta til høyre i Uranienborgveien</p><p className="text-xs text-[var(--ink-soft)]">Til henting · 2 min · 700 m</p></div>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 z-[500] rounded-t-[30px] px-6 pb-8 pt-5" style={{ background: "#fff", borderTop: "1px solid var(--line)", boxShadow: "0 -20px 50px rgba(11,14,20,0.12)" }}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: "var(--line-strong)" }} />
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full font-display font-semibold text-white" style={{ background: "var(--surface-soft)", color: "var(--ink)" }}>A</div>
          <div className="flex-1"><p className="text-sm font-semibold">Astrid · henting</p><p className="text-xs text-[var(--ink-soft)]">Solli plass 3</p></div>
          <button className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "var(--surface-soft)" }}><Icon name="phone" className="h-4 w-4" /></button>
          <button className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "var(--surface-soft)" }}><Icon name="chat" className="h-4 w-4" /></button>
        </div>
        <SlideConfirm label="Skyv når du er fremme" onConfirm={onArrived} />
      </div>
    </div>
  )
}

function PickupConfirm({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative h-full">
      <LiveMap />
      <div className="absolute inset-x-0 bottom-0 z-[500] rounded-t-[30px] px-6 pb-8 pt-5" style={{ background: "#fff", borderTop: "1px solid var(--line)", boxShadow: "0 -20px 50px rgba(11,14,20,0.12)" }}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: "var(--line-strong)" }} />
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--blue)]">Bekreft passasjer</p>
        <div className="mt-3 rounded-2xl p-4" style={{ background: "var(--surface-soft)", border: "1px solid var(--line)" }}>
          <p className="text-sm">Navn: <span className="font-semibold">Astrid Hansen</span></p>
          <p className="mt-1 text-sm">Destinasjon: <span className="font-semibold">Oslo Lufthavn</span></p>
        </div>
        <SlideConfirm label="Start tur" onConfirm={onStart} />
      </div>
    </div>
  )
}

function InTrip({ onEnd }: { onEnd: () => void }) {
  const [pct, setPct] = useState(0.1)
  useEffect(() => { const t = setInterval(() => setPct((p) => Math.min(1, p + 0.12)), 1400); return () => clearInterval(t) }, [])
  return (
    <div className="relative h-full">
      <LiveMap />
      <div className="absolute inset-x-4 top-4 z-[500] rounded-2xl px-4 py-3" style={{ background: "rgba(255,255,255,0.96)", border: "1px solid var(--line)", boxShadow: "0 8px 24px rgba(11,14,20,0.1)" }}>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full text-white" style={{ background: "var(--blue)" }}><Icon name="nav" /></span>
          <div className="flex-1"><p className="font-display text-base font-semibold">E6 mot Gardermoen</p><p className="text-xs text-[var(--ink-soft)]">Ankomst 14:32 · 32 km igjen</p></div>
          <span className="rounded-lg px-2 py-1 font-display text-sm font-bold" style={{ background: "var(--surface-soft)" }}>92<span className="text-[10px] font-normal"> km/t</span></span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface-soft)" }}><div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct * 100}%`, background: "var(--blue)" }} /></div>
      </div>
      <div className="absolute inset-x-0 bottom-0 z-[500] rounded-t-[30px] px-6 pb-8 pt-5" style={{ background: "#fff", borderTop: "1px solid var(--line)", boxShadow: "0 -20px 50px rgba(11,14,20,0.12)" }}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: "var(--line-strong)" }} />
        <div className="mb-4 grid grid-cols-3 gap-3 text-xs">
          <button className="flex flex-col items-center gap-1.5 rounded-2xl py-3 font-medium" style={{ background: "var(--surface)", border: "1px solid var(--line-strong)" }}><Icon name="chat" className="h-5 w-5 text-[var(--blue)]" /> Melding</button>
          <button className="flex flex-col items-center gap-1.5 rounded-2xl py-3 font-medium" style={{ background: "var(--surface)", border: "1px solid var(--line-strong)" }}>＋ Legg til stopp</button>
          <button className="flex flex-col items-center gap-1.5 rounded-2xl py-3 font-semibold text-white" style={{ background: "#e11d48" }}><Icon name="star" className="h-5 w-5" /> SOS</button>
        </div>
        <SlideConfirm label="Avslutt tur" onConfirm={onEnd} />
      </div>
    </div>
  )
}

function Complete({ onDone }: { onDone: () => void }) {
  const [rating, setRating] = useState(0)
  return (
    <div className="flex h-full flex-col px-7 pt-16" style={{ background: "linear-gradient(180deg,#ffffff,#f2f5fa)" }}>
      <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--green)" }}>Tur fullført</p>
      <p className="mt-1 font-display text-4xl font-semibold">+185,00 <span className="text-lg font-normal text-[var(--ink-soft)]">kr</span></p>
      <div className="mt-5 rounded-3xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        {[["Distanse", "38,4 km"], ["Tid", "42 min"], ["Grunn + km", "162,00 kr"], ["Bonus", "23,00 kr"]].map(([k, v]) => (
          <div key={k} className="flex justify-between py-1.5 text-sm"><span className="text-[var(--ink-soft)]">{k}</span><span className="font-medium">{v}</span></div>
        ))}
      </div>
      <div className="mt-6 rounded-3xl p-5 text-center" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <p className="text-sm font-medium">Vurder passasjeren</p>
        <div className="mt-3 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => setRating(n)}><Icon name="star" className={`h-8 w-8 ${n <= rating ? "text-[var(--blue)]" : "text-[var(--line-strong)]"}`} /></button>)}
        </div>
      </div>
      <div className="mt-auto mb-8 grid grid-cols-2 gap-3">
        <button onClick={onDone} className="rounded-full py-4 text-sm font-medium" style={{ background: "var(--surface)", border: "1px solid var(--line-strong)" }}>Ta pause</button>
        <button onClick={onDone} className="rounded-full py-4 font-display text-sm font-semibold text-white" style={{ background: "linear-gradient(120deg,#ff3b3b,#ff0000)", boxShadow: "0 12px 30px rgba(255,0,0,0.35)" }}>Fortsett online</button>
      </div>
    </div>
  )
}

function Earnings() {
  const bars = [40, 62, 48, 80, 55, 90, 70]
  const days = ["M", "T", "O", "T", "F", "L", "S"]
  return (
    <div className="h-full overflow-y-auto px-7 pb-28 pt-14" style={{ background: "linear-gradient(180deg,#ffffff,#f2f5fa)" }}>
      <h2 className="font-display text-2xl font-semibold">Inntjening</h2>
      <div className="mt-6 rounded-3xl p-6" style={{ background: "linear-gradient(135deg,#ff3b3b,#b30000)", color: "#fff" }}>
        <p className="font-mono text-[10px] tracking-widest opacity-80">DENNE UKEN</p>
        <p className="mt-2 font-display text-4xl font-semibold">14 320 kr</p>
        <p className="mt-1 text-xs opacity-80">86 turer · 34,5 timer</p>
      </div>
      <div className="mt-5 rounded-3xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <p className="text-sm font-semibold">Daglig oversikt</p>
        <div className="mt-4 flex h-32 items-end justify-between gap-2">
          {bars.map((h, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-2">
              <div className="w-full rounded-t-lg" style={{ height: `${h}%`, background: i === 5 ? "var(--blue)" : "var(--blue-soft)" }} />
              <span className="font-mono text-[10px] text-[var(--ink-faint)]">{days[i]}</span>
            </div>
          ))}
        </div>
      </div>
      {[
        { label: "Utbetalinger", sub: "Neste: fredag · DNB ••31" },
        { label: "Bonus og oppdrag", sub: "+500 kr venter" },
        { label: "Skatt og dokumenter", sub: "Årsoppgave klar" },
      ].map((r) => (
        <div key={r.label} className="mt-3 flex items-center justify-between rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <div><p className="text-sm font-semibold">{r.label}</p><p className="text-xs text-[var(--ink-soft)]">{r.sub}</p></div>
          <span className="text-[var(--ink-faint)]">›</span>
        </div>
      ))}
    </div>
  )
}

/* ---------- driver toggle ---------- */
function DToggle({ on, set }: { on: boolean; set: (v: boolean) => void }) {
  return (
    <button onClick={() => set(!on)} className="relative h-7 w-12 shrink-0 rounded-full transition-colors" style={{ background: on ? "var(--blue)" : "var(--line-strong)" }}>
      <span className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all" style={{ left: on ? "22px" : "2px" }} />
    </button>
  )
}

/* ---------- driver profile ---------- */
const FLEET = { name: "Oslo Taxi Partner AS", org: "918 273 645" }
const FLEET_VEHICLES = [
  { id: "ct74521", name: "Toyota Corolla Hybrid · 2022", detail: "Sølv · CT 74521 · 5 seter", klass: "SNAR" },
  { id: "el90233", name: "Volkswagen ID.4 · 2023", detail: "Grå · EL 90233 · 5 seter", klass: "SNAR EL" },
]

function DriverProfile({ onLogout }: { onLogout: () => void }) {
  const [driveMode, setDriveMode] = useState(true)
  const [pushRides, setPushRides] = useState(true)
  const [vehicle, setVehicle] = useState(FLEET_VEHICLES[0].id)

  const docs = [
    { label: "Førerkort", exp: "Gyldig til 04/2029", color: "var(--success)" },
    { label: "Kjøreseddel", exp: "Gyldig til 02/2028", color: "var(--success)" },
    { label: "Profilbilde", exp: "Verifisert", color: "var(--success)" },
  ]

  return (
    <div className="h-full overflow-y-auto px-7 pb-28 pt-14" style={{ background: "linear-gradient(180deg,#ffffff,#f2f5fa)" }}>
      <h2 className="font-display text-2xl font-semibold">Min profil</h2>

      {/* account */}
      <div className="mt-6 flex items-center gap-4 rounded-3xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full font-display text-2xl font-semibold text-white" style={{ background: "linear-gradient(135deg,#012a54,#001f3f)" }}>
          M
          <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-white" style={{ background: "var(--success)" }}><Icon name="check" className="h-3.5 w-3.5" /></span>
        </div>
        <div className="flex-1">
          <p className="font-display text-lg font-semibold">Mats Berg</p>
          <p className="text-xs text-[var(--ink-soft)]">+47 900 00 000 · mats@snar.no</p>
          <p className="mt-1 flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--warn)" }}><Icon name="star" className="h-3.5 w-3.5" /> 4,92 · 2 140 turer</p>
        </div>
      </div>
      <button className="mt-3 w-full rounded-2xl py-3 text-sm font-semibold text-[var(--blue)]" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>Endre passord</button>

      {/* fleet / company */}
      <p className="mt-7 font-mono text-[10px] uppercase tracking-widest text-[var(--ink-faint)]">Du kjører for</p>
      <div className="mt-3 flex items-center gap-3 rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl text-white" style={{ background: "linear-gradient(135deg,#012a54,#001f3f)" }}><Icon name="shield" /></span>
        <div className="flex-1">
          <p className="text-sm font-semibold">{FLEET.name}</p>
          <p className="text-xs text-[var(--ink-soft)]">Org.nr {FLEET.org}</p>
        </div>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: "var(--success)" }}>Tilknyttet</span>
      </div>

      {/* vehicle — choose only among fleet-assigned */}
      <p className="mt-7 font-mono text-[10px] uppercase tracking-widest text-[var(--ink-faint)]">Kjøretøy</p>
      <p className="mt-1 text-xs text-[var(--ink-soft)]">Velg blant kjøretøy tildelt av flåteeier.</p>
      <div className="mt-3 flex flex-col gap-2">
        {FLEET_VEHICLES.map((v) => {
          const on = vehicle === v.id
          return (
            <button key={v.id} onClick={() => setVehicle(v.id)} className="flex items-center gap-3 rounded-2xl p-4 text-left transition-all" style={{ background: "var(--surface)", border: `1px solid ${on ? "var(--blue)" : "var(--line-strong)"}`, boxShadow: on ? "0 0 0 4px rgba(255,0,0,0.1)" : "none" }}>
              <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: on ? "var(--blue-soft)" : "var(--surface-soft)", color: on ? "var(--blue)" : "var(--ink-soft)" }}><Icon name="car" /></span>
              <div className="flex-1">
                <p className="text-sm font-semibold">{v.name}</p>
                <p className="text-xs text-[var(--ink-soft)]">{v.detail}</p>
              </div>
              {on ? <span className="flex h-5 w-5 items-center justify-center rounded-full text-white" style={{ background: "var(--blue)" }}><Icon name="check" className="h-3.5 w-3.5" /></span> : <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "var(--surface-soft)", color: "var(--ink-soft)" }}>{v.klass}</span>}
            </button>
          )
        })}
      </div>

      {/* identity */}
      <p className="mt-7 font-mono text-[10px] uppercase tracking-widest text-[var(--ink-faint)]">Identitet</p>
      <div className="mt-3 flex items-center gap-3 rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <span className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--success)]" style={{ background: "rgba(76,175,80,0.12)" }}><Icon name="user" /></span>
        <div className="flex-1">
          <p className="text-sm font-semibold">Identitet verifisert</p>
          <p className="text-xs text-[var(--ink-soft)]">Selfie matcher førerkort</p>
        </div>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: "var(--success)" }}>Verifisert</span>
      </div>

      {/* documents */}
      <p className="mt-7 font-mono text-[10px] uppercase tracking-widest text-[var(--ink-faint)]">Dokumenter</p>
      <div className="mt-3 rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <div className="flex flex-col gap-2">
          {docs.map((d) => (
            <div key={d.label} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
              <p className="flex-1 text-xs font-medium">{d.label}</p>
              <p className="text-xs" style={{ color: d.color }}>{d.exp}</p>
              {d.color === "var(--warn)" && <button className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: "var(--warn)" }}>Forny</button>}
            </div>
          ))}
        </div>
      </div>

      {/* earnings */}
      <p className="mt-7 font-mono text-[10px] uppercase tracking-widest text-[var(--ink-faint)]">Inntekter og utbetalinger</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Stat label="I dag" value="1 240" unit="kr" accent="var(--success)" />
        <Stat label="Denne uken" value="8 920" unit="kr" accent="var(--blue)" />
      </div>
      <div className="mt-3 flex items-center justify-between rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <div><p className="text-sm font-semibold">Neste utbetaling</p><p className="text-xs text-[var(--ink-soft)]">Fredag · DNB ••31</p></div>
        <p className="font-display text-lg font-semibold" style={{ color: "var(--success)" }}>8 920 kr</p>
      </div>
      <button className="mt-3 w-full rounded-2xl py-3 text-sm font-semibold text-[var(--blue)]" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>Se detaljerte inntektsrapporter</button>

      {/* safety & ratings */}
      <p className="mt-7 font-mono text-[10px] uppercase tracking-widest text-[var(--ink-faint)]">Sikkerhet og vurderinger</p>
      <div className="mt-3 rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--success)]" style={{ background: "rgba(76,175,80,0.12)" }}><Icon name="shield" /></span>
          <div className="flex-1"><p className="text-sm font-semibold">Sikkerhetsprofil</p><p className="text-xs text-[var(--ink-soft)]">0 hendelser · verifisert sjåfør</p></div>
          <Icon name="chevron" className="h-4 w-4 text-[var(--ink-faint)]" />
        </div>
      </div>

      {/* app settings */}
      <p className="mt-7 font-mono text-[10px] uppercase tracking-widest text-[var(--ink-faint)]">Appinnstillinger</p>
      <div className="mt-3 flex flex-col gap-3">
        <div className="flex items-center gap-3 rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <span className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--ink-soft)]" style={{ background: "var(--surface-soft)" }}><Icon name="car" /></span>
          <div className="flex-1"><p className="text-sm font-semibold">Kjøremodus</p><p className="text-xs text-[var(--ink-soft)]">Ikke forstyrr under kjøring</p></div>
          <DToggle on={driveMode} set={setDriveMode} />
        </div>
        <div className="flex items-center gap-3 rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <span className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--ink-soft)]" style={{ background: "var(--surface-soft)" }}><Icon name="bell" /></span>
          <div className="flex-1"><p className="text-sm font-semibold">Push for nye turer</p><p className="text-xs text-[var(--ink-soft)]">Varsel ved forespørsel i nærheten</p></div>
          <DToggle on={pushRides} set={setPushRides} />
        </div>
        {[["globe", "Språk", "Norsk (bokmål)"], ["user", "Tilgjengelighet", "Stor tekst · Høykontrast"]].map(([ic, l, s]) => (
          <button key={l} className="flex items-center gap-3 rounded-2xl p-4 text-left" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
            <span className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--ink-soft)]" style={{ background: "var(--surface-soft)" }}><Icon name={ic} /></span>
            <div className="flex-1"><p className="text-sm font-semibold">{l}</p><p className="text-xs text-[var(--ink-soft)]">{s}</p></div>
            <Icon name="chevron" className="h-4 w-4 text-[var(--ink-faint)]" />
          </button>
        ))}
      </div>

      <button onClick={onLogout} className="mt-5 w-full rounded-2xl py-3.5 text-sm font-semibold text-[var(--error)]" style={{ background: "var(--surface)", border: "1px solid rgba(244,67,54,0.25)" }}>Logg ut</button>
    </div>
  )
}

/* ---------- driver onboarding: invitation-only (fleet-owner invite) ---------- */
const NavyBtn = ({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) => (
  <button disabled={disabled} onClick={onClick} className="mt-6 w-full rounded-full py-4 font-display text-sm font-semibold text-white transition-transform active:scale-95" style={{ background: disabled ? "var(--line-strong)" : "linear-gradient(120deg,#012a54,#001f3f)", boxShadow: disabled ? "none" : "0 12px 30px rgba(0,31,63,0.35)" }}>
    {children}
  </button>
)

function DriverOnboard({ onDone }: { onDone: () => void }) {
  type Step = "invite" | "contact" | "password" | "documents" | "selfie" | "vehicle" | "pending"
  const [step, setStep] = useState<Step>("invite")
  const [docs, setDocs] = useState<Record<string, boolean>>({})
  const [selfie, setSelfie] = useState(false)
  const [vehicle, setVehicle] = useState<string | null>(null)
  const [email, setEmail] = useState("mats@snar.no")
  const [phone, setPhone] = useState("+47 900 00 000")

  const docList = [
    { id: "license", label: "Førerkort", sub: "Forside og bakside" },
    { id: "kjoreseddel", label: "Kjøreseddel", sub: "Løyve for persontransport" },
  ]
  const uploaded = docList.filter((d) => docs[d.id]).length

  const Wrap = ({ children }: { children: React.ReactNode }) => (
    <div className="flex h-full flex-col overflow-y-auto px-7 pb-8 pt-16" style={{ background: "linear-gradient(180deg,#ffffff,#f2f5fa)" }}>
      <div className="flex items-center gap-3">
        <SnarMark size={40} />
        <p className="font-mono text-[10px] uppercase tracking-[0.28em]" style={{ color: "var(--navy)" }}>SNAR Sjåfør</p>
      </div>
      {children}
    </div>
  )

  const StepDots = ({ n }: { n: number }) => (
    <div className="mt-6 flex gap-1.5">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i <= n ? "var(--navy)" : "var(--line-strong)" }} />
      ))}
    </div>
  )

  if (step === "invite") {
    return (
      <Wrap>
        <StepDots n={0} />
        <h2 className="mt-5 font-display text-2xl font-semibold">Du er invitert til SNAR</h2>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">Bekreft at dette er deg for å aktivere sjåførkontoen.</p>

        <div className="mt-6 rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-faint)]">Invitert av</p>
          <div className="mt-2 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl text-white" style={{ background: "linear-gradient(135deg,#012a54,#001f3f)" }}><Icon name="shield" /></span>
            <div>
              <p className="text-sm font-semibold">Oslo Taxi Partner AS</p>
              <p className="text-xs text-[var(--ink-soft)]">Org.nr 918 273 645</p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-faint)]">Din invitasjon</p>
          <p className="mt-2 text-sm">Mats Berg</p>
          <p className="text-xs text-[var(--ink-soft)]">mats@snar.no · +47 900 00 000</p>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-[var(--ink-soft)]">
          Sjåførkontoer opprettes kun via invitasjon fra flåteeier. Du kan ikke velge flåte selv.
        </p>

        <NavyBtn onClick={() => setStep("contact")}>Dette er meg — fortsett</NavyBtn>
      </Wrap>
    )
  }

  if (step === "contact") {
    return (
      <Wrap>
        <StepDots n={1} />
        <h2 className="mt-5 font-display text-2xl font-semibold">Kontaktinformasjon</h2>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">Bekreft e-post og telefonnummer for sjåførkontoen.</p>
        <div className="mt-7 flex flex-col gap-4">
          <label className="block">
            <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--ink-faint)]">E-post</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-2xl px-4 py-3.5 text-[15px] outline-none" style={{ background: "var(--surface)", border: "1px solid var(--line-strong)" }} />
          </label>
          <label className="block">
            <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--ink-faint)]">Telefonnummer</span>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-2xl px-4 py-3.5 text-[15px] outline-none" style={{ background: "var(--surface)", border: "1px solid var(--line-strong)" }} />
          </label>
        </div>
        <NavyBtn disabled={!email.trim() || !phone.trim()} onClick={() => setStep("password")}>Fortsett</NavyBtn>
      </Wrap>
    )
  }

  if (step === "password") {
    return (
      <Wrap>
        <StepDots n={2} />
        <h2 className="mt-5 font-display text-2xl font-semibold">Lag et passord</h2>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">Dette bruker du til å logge inn på sjåførkontoen.</p>
        <div className="mt-7 flex flex-col gap-4">
          <label className="block">
            <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--ink-faint)]">Passord</span>
            <input type="password" placeholder="Minst 8 tegn" className="w-full rounded-2xl px-4 py-3.5 text-[15px] outline-none" style={{ background: "var(--surface)", border: "1px solid var(--line-strong)" }} />
          </label>
          <label className="block">
            <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--ink-faint)]">Gjenta passord</span>
            <input type="password" placeholder="Gjenta passord" className="w-full rounded-2xl px-4 py-3.5 text-[15px] outline-none" style={{ background: "var(--surface)", border: "1px solid var(--line-strong)" }} />
          </label>
        </div>
        <NavyBtn onClick={() => setStep("documents")}>Fortsett</NavyBtn>
      </Wrap>
    )
  }

  if (step === "documents") {
    return (
      <Wrap>
        <StepDots n={3} />
        <h2 className="mt-5 font-display text-2xl font-semibold">Last opp dokumenter</h2>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">{uploaded}/{docList.length} lastet opp.</p>
        <div className="mt-6 flex flex-col gap-3">
          {docList.map((d) => {
            const on = !!docs[d.id]
            return (
              <button key={d.id} onClick={() => setDocs((p) => ({ ...p, [d.id]: !p[d.id] }))} className="flex items-center gap-3 rounded-2xl p-4 text-left transition-all" style={{ background: "var(--surface)", border: `1px solid ${on ? "var(--green)" : "var(--line-strong)"}` }}>
                <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: on ? "rgba(76,175,80,0.12)" : "var(--surface-soft)", color: on ? "var(--green)" : "var(--ink-soft)" }}><Icon name={on ? "check" : "doc"} /></span>
                <div className="flex-1"><p className="text-sm font-semibold">{d.label}</p><p className="text-xs text-[var(--ink-soft)]">{d.sub}</p></div>
                <span className="font-mono text-[10px] tracking-widest" style={{ color: on ? "var(--green)" : "var(--navy)" }}>{on ? "OPPLASTET" : "LAST OPP"}</span>
              </button>
            )
          })}
        </div>
        <NavyBtn disabled={uploaded < docList.length} onClick={() => setStep("selfie")}>{uploaded < docList.length ? "Last opp alle dokumenter" : "Fortsett"}</NavyBtn>
      </Wrap>
    )
  }

  if (step === "selfie") {
    return (
      <Wrap>
        <StepDots n={4} />
        <h2 className="mt-5 font-display text-2xl font-semibold">Ta et profilbilde</h2>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">Vi bruker en selfie for å bekrefte identiteten din mot førerkortet.</p>
        <div className="mt-8 flex flex-col items-center">
          <button onClick={() => setSelfie(true)} className="relative flex h-44 w-44 items-center justify-center rounded-full transition-transform active:scale-95" style={{ background: selfie ? "rgba(76,175,80,0.12)" : "var(--surface)", border: `2px dashed ${selfie ? "var(--green)" : "var(--line-strong)"}`, color: selfie ? "var(--green)" : "var(--ink-faint)" }}>
            <Icon name={selfie ? "check" : "user"} className="h-16 w-16" />
          </button>
          <p className="mt-4 text-sm font-medium" style={{ color: selfie ? "var(--green)" : "var(--ink-soft)" }}>{selfie ? "Selfie tatt" : "Trykk for å ta selfie"}</p>
        </div>
        <div className="mt-auto" />
        <NavyBtn disabled={!selfie} onClick={() => setStep("vehicle")}>Fortsett</NavyBtn>
      </Wrap>
    )
  }

  if (step === "vehicle") {
    return (
      <Wrap>
        <StepDots n={5} />
        <h2 className="mt-5 font-display text-2xl font-semibold">Velg kjøretøy</h2>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">Kjøretøyene under er tildelt av Oslo Taxi Partner AS.</p>
        <div className="mt-6 flex flex-col gap-3">
          {FLEET_VEHICLES.map((v) => {
            const on = vehicle === v.id
            return (
              <button key={v.id} onClick={() => setVehicle(v.id)} className="flex items-center gap-3 rounded-2xl p-4 text-left transition-all" style={{ background: "var(--surface)", border: `1px solid ${on ? "var(--navy)" : "var(--line-strong)"}`, boxShadow: on ? "0 0 0 4px rgba(0,31,63,0.1)" : "none" }}>
                <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: on ? "rgba(0,31,63,0.08)" : "var(--surface-soft)", color: on ? "var(--navy)" : "var(--ink-soft)" }}><Icon name="car" /></span>
                <div className="flex-1"><p className="text-sm font-semibold">{v.name}</p><p className="text-xs text-[var(--ink-soft)]">{v.detail}</p></div>
                {on && <span className="flex h-5 w-5 items-center justify-center rounded-full text-white" style={{ background: "var(--navy)" }}><Icon name="check" className="h-3.5 w-3.5" /></span>}
              </button>
            )
          })}
        </div>
        <NavyBtn disabled={!vehicle} onClick={() => setStep("pending")}>Send til godkjenning</NavyBtn>
      </Wrap>
    )
  }

  // pending — waiting for fleet-owner / SNAR approval
  return (
    <div className="flex h-full flex-col items-center justify-center px-7 text-center" style={{ background: "linear-gradient(180deg,#ffffff,#f2f5fa)" }}>
      <span className="flex h-20 w-20 items-center justify-center rounded-full text-white animate-rise" style={{ background: "linear-gradient(135deg,#012a54,#001f3f)" }}>
        <Icon name="check" className="h-10 w-10" />
      </span>
      <h2 className="mt-6 font-display text-2xl font-semibold animate-rise">Sendt til godkjenning</h2>
      <p className="mt-2 max-w-[17rem] text-sm text-[var(--ink-soft)] animate-rise">
        Oslo Taxi Partner AS og SNAR går gjennom søknaden din. Du får varsel når kontoen er klar til bruk.
      </p>
      <div className="mt-6 w-full max-w-xs rounded-2xl p-4 text-left" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        {[["Identitet", "Til kontroll"], ["Dokumenter", "Mottatt"], ["Kjøretøy", "Bekreftet"]].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between py-1.5 text-sm"><span className="text-[var(--ink-soft)]">{k}</span><span className="font-medium">{v}</span></div>
        ))}
      </div>
      <button onClick={onDone} className="mt-8 w-full max-w-xs rounded-full py-4 font-display text-sm font-semibold text-white transition-transform active:scale-95" style={{ background: "linear-gradient(120deg,#012a54,#001f3f)", boxShadow: "0 12px 30px rgba(0,31,63,0.35)" }}>
        Fortsett (demo: godkjent)
      </button>
    </div>
  )
}

/* ---------- root ---------- */
export default function DriverApp() {
  const [screen, setScreen] = useState<Screen>("splash")
  const [tab, setTab] = useState<Tab>("home")
  const [stage, setStage] = useState<Stage>("dashboard")
  const [online, setOnline] = useState(false)

  const reset = () => { setScreen("splash"); setTab("home"); setStage("dashboard"); setOnline(false) }

  let body: React.ReactNode = null
  if (screen === "splash") body = <Splash variant="driver" onEnter={() => setScreen("login")} />
  else if (screen === "login") body = <Login variant="driver" onDone={() => setScreen("documents")} />
  else if (screen === "documents") body = <DriverOnboard onDone={() => setScreen("app")} />
  else if (tab === "earnings") body = <Earnings />
  else if (tab === "profile") body = <DriverProfile onLogout={reset} />
  else if (stage === "dashboard") body = <Dashboard online={online} setOnline={setOnline} onRequest={() => setStage("request")} />
  else if (stage === "request") body = <RequestModal onAccept={() => setStage("topickup")} onDecline={() => setStage("dashboard")} />
  else if (stage === "topickup") body = <ToPickup onArrived={() => setStage("pickup")} />
  else if (stage === "pickup") body = <PickupConfirm onStart={() => setStage("intrip")} />
  else if (stage === "intrip") body = <InTrip onEnd={() => setStage("complete")} />
  else body = <Complete onDone={() => setStage("dashboard")} />

  const showTabs = screen === "app" && (tab === "earnings" || tab === "profile" || stage === "dashboard")

  return (
    <div className="relative h-full">
      {body}
      {showTabs && (
        <div className="absolute inset-x-4 bottom-4 z-[560]">
          <div className="flex items-center justify-around rounded-[26px] px-3 py-2.5" style={{ background: "rgba(255,255,255,0.94)", backdropFilter: "blur(22px)", border: "1px solid var(--line)", boxShadow: "0 16px 40px rgba(11,14,20,0.14)" }}>
            {([["home", "Hjem", "home"], ["earnings", "Inntjening", "chart"], ["profile", "Profil", "user"]] as const).map(([id, label, icon]) => {
              const on = tab === id
              return (
                <button key={id} onClick={() => setTab(id)} className="flex flex-1 flex-col items-center gap-1 py-1.5" style={{ color: on ? "var(--blue)" : "var(--ink-faint)" }}>
                  <Icon name={icon} className="h-5 w-5" />
                  <span className="text-[10px] font-medium">{label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
      {screen !== "splash" && (
        <button onClick={reset} className="absolute right-3 top-3 z-[610] rounded-full px-2.5 py-1 font-mono text-[9px] tracking-widest text-[var(--ink-faint)]" style={{ background: "rgba(255,255,255,0.85)", border: "1px solid var(--line)", backdropFilter: "blur(10px)" }}>
          RESET
        </button>
      )}
    </div>
  )
}
