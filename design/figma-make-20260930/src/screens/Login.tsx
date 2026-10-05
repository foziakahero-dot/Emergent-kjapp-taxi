import { useState } from "react"
import SnarMark from "../components/SnarMark"

/* ---------- shared field ---------- */
function Field({
  label,
  placeholder,
  type = "text",
  value,
  onChange,
}: {
  label: string
  placeholder: string
  type?: string
  value?: string
  onChange?: (v: string) => void
}) {
  const [focused, setFocused] = useState(false)
  return (
    <label className="block">
      <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--ink-faint)]">
        {label}
      </span>
      <div
        className="relative rounded-2xl transition-all duration-300"
        style={{
          background: "var(--surface)",
          border: `1px solid ${focused ? "var(--blue)" : "var(--line-strong)"}`,
          boxShadow: focused ? "0 0 0 4px rgba(255,0,0,0.12)" : "0 1px 2px rgba(11,14,20,0.04)",
        }}
      >
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full bg-transparent px-4 py-3.5 text-[15px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
        />
      </div>
    </label>
  )
}

function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-full py-4 font-display text-sm font-semibold text-white transition-transform active:scale-95"
      style={{
        background: disabled ? "var(--line-strong)" : "linear-gradient(120deg,#ff3b3b,#ff0000)",
        boxShadow: disabled ? "none" : "0 12px 30px rgba(255,0,0,0.35)",
      }}
    >
      {children}
    </button>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 01-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.2-4 1.2-3 0-5.6-2-6.5-4.8H1.5v3C3.5 21.4 7.4 24 12 24z" />
      <path fill="#FBBC05" d="M5.5 14.5A7.2 7.2 0 015.1 12c0-.9.2-1.7.4-2.5v-3H1.5A12 12 0 000 12c0 1.9.5 3.8 1.5 5.5l4-3z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.4 0 3.5 2.6 1.5 6.5l4 3C6.4 6.7 9 4.8 12 4.8z" />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#ffffff" aria-hidden="true">
      <path d="M16.4 12.7c0-2.2 1.8-3.3 1.9-3.3-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.6.8-3.3.8-.7 0-1.7-.8-2.8-.8-1.5 0-2.8.8-3.6 2.2-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.6 2.2 2.7 2.1 1.1 0 1.5-.7 2.8-.7 1.3 0 1.6.7 2.8.7 1.1 0 1.9-1 2.6-2 .8-1.2 1.2-2.3 1.2-2.4-.1 0-2.2-.9-2.2-3.5zM14.2 5.9c.6-.7 1-1.7.9-2.7-.9 0-1.9.6-2.5 1.3-.5.6-1 1.6-.9 2.6 1 .1 1.9-.5 2.5-1.2z" />
    </svg>
  )
}

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="relative flex h-full flex-col overflow-y-auto px-7 pb-10 pt-14" style={{ background: "linear-gradient(180deg,#ffffff,#f2f5fa)" }}>
    {children}
  </div>
)

const BackLink = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick} className="mb-6 flex items-center gap-2 text-sm font-medium text-[var(--ink-soft)]">
    <span className="text-lg leading-none">‹</span> {children}
  </button>
)

/* ============================================================= */
/* CUSTOMER — self-service login with registration + forgot flow */
/* ============================================================= */
type CView = "login" | "register" | "forgot-email" | "forgot-sent" | "forgot-reset" | "forgot-done"

function CustomerLogin({ onDone }: { onDone: () => void }) {
  const [view, setView] = useState<CView>("login")
  const [agree, setAgree] = useState(false)

  if (view === "login") {
    return (
      <Shell>
        <div className="flex flex-col items-center text-center animate-rise">
          <SnarMark size={64} float />
          <h2 className="mt-6 font-display text-3xl font-semibold">Velkommen til SNAR</h2>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">Bestill. Følg. Betal.</p>
        </div>

        <div className="mt-9 flex flex-col gap-3 animate-rise" style={{ animationDelay: "0.06s" }}>
          <button onClick={onDone} className="flex items-center justify-center gap-3 rounded-full py-3.5 text-sm font-semibold text-white transition-transform active:scale-95" style={{ background: "#000000" }}>
            <AppleIcon /> Fortsett med Apple
          </button>
          <button onClick={onDone} className="flex items-center justify-center gap-3 rounded-full py-3.5 text-sm font-semibold transition-transform active:scale-95" style={{ background: "var(--surface)", border: "1px solid var(--line-strong)", color: "var(--ink)" }}>
            <GoogleIcon /> Fortsett med Google
          </button>
        </div>

        <div className="mt-6 flex items-center gap-3 animate-rise" style={{ animationDelay: "0.1s" }}>
          <span className="h-px flex-1" style={{ background: "var(--line)" }} />
          <span className="font-mono text-[10px] tracking-widest text-[var(--ink-faint)]">ELLER</span>
          <span className="h-px flex-1" style={{ background: "var(--line)" }} />
        </div>

        <div className="mt-6 flex flex-col gap-4 animate-rise" style={{ animationDelay: "0.14s" }}>
          <Field label="E-post eller telefon" placeholder="deg@epost.no" />
          <Field label="Passord" placeholder="••••••••" type="password" />
        </div>

        <div className="mt-7 flex flex-col gap-4 animate-rise" style={{ animationDelay: "0.18s" }}>
          <PrimaryButton onClick={onDone}>Logg inn</PrimaryButton>
          <button onClick={() => setView("forgot-email")} className="text-center text-sm font-medium text-[var(--blue)]">
            Glemt passord?
          </button>
        </div>

        <p className="mt-8 text-center text-sm text-[var(--ink-soft)]">
          Ny hos SNAR?{" "}
          <button onClick={() => setView("register")} className="font-semibold text-[var(--blue)]">Opprett konto</button>
        </p>
      </Shell>
    )
  }

  if (view === "register") {
    return (
      <Shell>
        <BackLink onClick={() => setView("login")}>Tilbake</BackLink>
        <SnarMark size={44} />
        <h2 className="mt-5 font-display text-2xl font-semibold">Opprett konto</h2>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">Kom i gang på under ett minutt.</p>

        <div className="mt-7 flex flex-col gap-4">
          <Field label="Fullt navn" placeholder="Ola Nordmann" />
          <Field label="E-post" placeholder="deg@epost.no" type="email" />
          <Field label="Telefon" placeholder="+47 000 00 000" type="tel" />
          <Field label="Passord" placeholder="Minst 8 tegn" type="password" />
        </div>

        <button onClick={() => setAgree((a) => !a)} className="mt-5 flex items-start gap-3 text-left">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white" style={{ background: agree ? "var(--green)" : "var(--line-strong)" }}>
            {agree && <svg viewBox="0 0 24 24" className="h-4 w-4"><path d="M5 12l5 5L20 6" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </span>
          <span className="text-xs leading-relaxed text-[var(--ink-soft)]">
            Jeg godtar SNARs <span className="font-semibold text-[var(--ink)]">vilkår</span> og <span className="font-semibold text-[var(--ink)]">personvernerklæring</span>.
          </span>
        </button>

        <div className="mt-6 flex flex-col gap-3">
          <PrimaryButton onClick={onDone} disabled={!agree}>Opprett konto</PrimaryButton>
          <div className="flex items-center gap-3">
            <span className="h-px flex-1" style={{ background: "var(--line)" }} />
            <span className="font-mono text-[10px] tracking-widest text-[var(--ink-faint)]">ELLER</span>
            <span className="h-px flex-1" style={{ background: "var(--line)" }} />
          </div>
          <button onClick={onDone} className="flex items-center justify-center gap-3 rounded-full py-3.5 text-sm font-semibold text-white transition-transform active:scale-95" style={{ background: "#000000" }}>
            <AppleIcon /> Fortsett med Apple
          </button>
          <button onClick={onDone} className="flex items-center justify-center gap-3 rounded-full py-3.5 text-sm font-semibold transition-transform active:scale-95" style={{ background: "var(--surface)", border: "1px solid var(--line-strong)", color: "var(--ink)" }}>
            <GoogleIcon /> Fortsett med Google
          </button>
        </div>

        <p className="mt-8 text-center text-sm text-[var(--ink-soft)]">
          Har du allerede konto?{" "}
          <button onClick={() => setView("login")} className="font-semibold text-[var(--blue)]">Logg inn</button>
        </p>
      </Shell>
    )
  }

  if (view === "forgot-email") {
    return (
      <Shell>
        <BackLink onClick={() => setView("login")}>Tilbake til innlogging</BackLink>
        <SnarMark size={44} />
        <h2 className="mt-5 font-display text-2xl font-semibold">Glemt passord?</h2>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">Skriv inn e-posten din, så sender vi deg en lenke for å lage nytt passord.</p>
        <div className="mt-7">
          <Field label="E-post" placeholder="deg@epost.no" type="email" />
        </div>
        <div className="mt-7">
          <PrimaryButton onClick={() => setView("forgot-sent")}>Send tilbakestillingslenke</PrimaryButton>
        </div>
      </Shell>
    )
  }

  if (view === "forgot-sent") {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center text-center animate-rise">
          <span className="flex h-16 w-16 items-center justify-center rounded-full text-[var(--blue)]" style={{ background: "var(--blue-soft)" }}>
            <svg viewBox="0 0 24 24" className="h-8 w-8"><path d="M4 6h16v12H4zM4 7l8 6 8-6" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round" /></svg>
          </span>
          <h2 className="mt-6 font-display text-2xl font-semibold">Sjekk e-posten din</h2>
          <p className="mt-2 max-w-[16rem] text-sm text-[var(--ink-soft)]">Vi har sendt en tilbakestillingslenke. Åpne den for å lage et nytt passord.</p>
          <button onClick={() => setView("forgot-reset")} className="mt-8 text-sm font-semibold text-[var(--blue)]">Jeg har åpnet lenken →</button>
          <button onClick={() => setView("forgot-email")} className="mt-4 text-sm text-[var(--ink-soft)]">Send på nytt</button>
        </div>
      </Shell>
    )
  }

  if (view === "forgot-reset") {
    return (
      <Shell>
        <SnarMark size={44} />
        <h2 className="mt-5 font-display text-2xl font-semibold">Nytt passord</h2>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">Velg et nytt passord for kontoen din.</p>
        <div className="mt-7 flex flex-col gap-4">
          <Field label="Nytt passord" placeholder="Minst 8 tegn" type="password" />
          <Field label="Gjenta passord" placeholder="Gjenta passord" type="password" />
        </div>
        <div className="mt-7">
          <PrimaryButton onClick={() => setView("forgot-done")}>Lagre nytt passord</PrimaryButton>
        </div>
      </Shell>
    )
  }

  // forgot-done
  return (
    <Shell>
      <div className="flex flex-1 flex-col items-center justify-center text-center animate-rise">
        <span className="flex h-16 w-16 items-center justify-center rounded-full text-white" style={{ background: "var(--green)" }}>
          <svg viewBox="0 0 24 24" className="h-9 w-9"><path d="M5 12l5 5L20 6" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <h2 className="mt-6 font-display text-2xl font-semibold">Passordet er endret</h2>
        <p className="mt-2 max-w-[16rem] text-sm text-[var(--ink-soft)]">Du kan nå logge inn med det nye passordet ditt.</p>
        <div className="mt-8 w-full">
          <PrimaryButton onClick={() => setView("login")}>Logg inn</PrimaryButton>
        </div>
      </div>
    </Shell>
  )
}

/* ============================================================= */
/* DRIVER — invitation-only, no public registration              */
/* ============================================================= */
type DView = "login" | "forgot-email" | "forgot-sent" | "forgot-reset" | "forgot-done"

function DriverLogin({ onDone }: { onDone: () => void }) {
  const [view, setView] = useState<DView>("login")

  if (view === "login") {
    return (
      <Shell>
        <div className="flex items-center gap-3 animate-rise">
          <SnarMark size={48} />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.28em]" style={{ color: "var(--navy)" }}>SNAR Sjåfør</p>
            <h2 className="font-display text-2xl font-semibold">Logg inn</h2>
          </div>
        </div>

        <div className="mt-9 flex flex-col gap-4 animate-rise" style={{ animationDelay: "0.06s" }}>
          <Field label="E-post eller telefon" placeholder="deg@epost.no" />
          <Field label="Passord" placeholder="••••••••" type="password" />
        </div>

        <button
          onClick={onDone}
          className="mt-8 rounded-full py-4 font-display text-sm font-semibold text-white transition-transform active:scale-95 animate-rise"
          style={{ background: "linear-gradient(120deg,#012a54,#001f3f)", boxShadow: "0 12px 30px rgba(0,31,63,0.35)", animationDelay: "0.12s" }}
        >
          Logg inn
        </button>
        <button onClick={() => setView("forgot-email")} className="mt-5 text-center text-sm font-medium" style={{ color: "var(--navy)" }}>
          Glemt passord?
        </button>

        <div className="mt-auto pt-10">
          <div className="rounded-2xl p-4 text-center" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
            <p className="text-xs leading-relaxed text-[var(--ink-soft)]">
              Har du ikke fått tilgang? Sjåførkonto opprettes via invitasjon fra flåteeier.
            </p>
            <button className="mt-2 text-xs font-semibold" style={{ color: "var(--navy)" }}>Trenger du hjelp?</button>
          </div>
        </div>
      </Shell>
    )
  }

  if (view === "forgot-email") {
    return (
      <Shell>
        <BackLink onClick={() => setView("login")}>Tilbake til innlogging</BackLink>
        <SnarMark size={44} />
        <h2 className="mt-5 font-display text-2xl font-semibold">Glemt passord?</h2>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">Skriv inn e-posten knyttet til sjåførkontoen din.</p>
        <div className="mt-7">
          <Field label="E-post" placeholder="deg@epost.no" type="email" />
        </div>
        <button
          onClick={() => setView("forgot-sent")}
          className="mt-7 rounded-full py-4 font-display text-sm font-semibold text-white transition-transform active:scale-95"
          style={{ background: "linear-gradient(120deg,#012a54,#001f3f)", boxShadow: "0 12px 30px rgba(0,31,63,0.35)" }}
        >
          Send tilbakestillingslenke
        </button>
      </Shell>
    )
  }

  if (view === "forgot-sent") {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center text-center animate-rise">
          <span className="flex h-16 w-16 items-center justify-center rounded-full text-white" style={{ background: "var(--navy)" }}>
            <svg viewBox="0 0 24 24" className="h-8 w-8"><path d="M4 6h16v12H4zM4 7l8 6 8-6" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round" /></svg>
          </span>
          <h2 className="mt-6 font-display text-2xl font-semibold">Sjekk e-posten din</h2>
          <p className="mt-2 max-w-[16rem] text-sm text-[var(--ink-soft)]">Vi har sendt en tilbakestillingslenke til sjåførkontoen din.</p>
          <button onClick={() => setView("forgot-reset")} className="mt-8 text-sm font-semibold" style={{ color: "var(--navy)" }}>Jeg har åpnet lenken →</button>
        </div>
      </Shell>
    )
  }

  if (view === "forgot-reset") {
    return (
      <Shell>
        <SnarMark size={44} />
        <h2 className="mt-5 font-display text-2xl font-semibold">Nytt passord</h2>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">Velg et nytt passord for sjåførkontoen din.</p>
        <div className="mt-7 flex flex-col gap-4">
          <Field label="Nytt passord" placeholder="Minst 8 tegn" type="password" />
          <Field label="Gjenta passord" placeholder="Gjenta passord" type="password" />
        </div>
        <button
          onClick={() => setView("forgot-done")}
          className="mt-7 rounded-full py-4 font-display text-sm font-semibold text-white transition-transform active:scale-95"
          style={{ background: "linear-gradient(120deg,#012a54,#001f3f)", boxShadow: "0 12px 30px rgba(0,31,63,0.35)" }}
        >
          Lagre nytt passord
        </button>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="flex flex-1 flex-col items-center justify-center text-center animate-rise">
        <span className="flex h-16 w-16 items-center justify-center rounded-full text-white" style={{ background: "var(--green)" }}>
          <svg viewBox="0 0 24 24" className="h-9 w-9"><path d="M5 12l5 5L20 6" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <h2 className="mt-6 font-display text-2xl font-semibold">Passordet er endret</h2>
        <p className="mt-2 max-w-[16rem] text-sm text-[var(--ink-soft)]">Logg inn med det nye passordet ditt.</p>
        <button
          onClick={() => setView("login")}
          className="mt-8 w-full rounded-full py-4 font-display text-sm font-semibold text-white transition-transform active:scale-95"
          style={{ background: "linear-gradient(120deg,#012a54,#001f3f)", boxShadow: "0 12px 30px rgba(0,31,63,0.35)" }}
        >
          Logg inn
        </button>
      </div>
    </Shell>
  )
}

export default function Login({
  onDone,
  variant = "customer",
}: {
  onDone: () => void
  variant?: "customer" | "driver"
}) {
  return variant === "driver" ? <DriverLogin onDone={onDone} /> : <CustomerLogin onDone={onDone} />
}
