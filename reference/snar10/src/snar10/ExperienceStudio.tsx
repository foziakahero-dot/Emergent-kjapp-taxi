import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Dock, Icon, StateView, TopBar } from "./kit"

type StudioProps = {
  product: "customer" | "driver"
  value: string
  onChange: (value: string) => void
  onContinue: () => void
  earnings?: number
}

const journeys = [
  {
    id: "standard",
    label: "Effektiv",
    icon: "navigation",
    title: "Mer dag. Mindre venting.",
    sub: "Standard · estimert henting 3 min",
    body: "Et enkelt valg for hverdagsturene. Se rute og pris før du bestiller.",
  },
  {
    id: "comfort",
    label: "Pusterom",
    icon: "moon",
    title: "Et lite pusterom.",
    sub: "Comfort · estimert henting 5 min",
    body: "Mer benplass og en roligere start. Ønsket om en stille tur vises som en demopreferanse, ikke en bekreftet sjåførtjeneste.",
  },
  {
    id: "premium",
    label: "Signatur",
    icon: "star",
    title: "Gjør reisen til en del av dagen.",
    sub: "Premium · estimert henting 6 min",
    body: "Velg Premium, og utforsk bilkategori, pris og sjåfør i den eksisterende bestillingsflyten.",
  },
]
const shifts = [
  {
    id: "2200",
    label: "Balanse",
    icon: "heart",
    title: "Et godt skift. På dine premisser.",
    sub: "Dagsmål 2 200 kr",
    body: "Et oversiktlig mål med plass til pauser. Du bestemmer tempoet, og alle anbefalinger er valgfrie.",
  },
  {
    id: "2800",
    label: "Fokus",
    icon: "earnings",
    title: "Færre distraksjoner. Klar retning.",
    sub: "Dagsmål 2 800 kr",
    body: "Hold dagens mål synlig og utforsk estimerte etterspørselsområder i Drive Intelligence.",
  },
  {
    id: "3400",
    label: "Ambisjon",
    icon: "arrowUp",
    title: "Sikt høyere. Kjør like trygt.",
    sub: "Dagsmål 3 400 kr",
    body: "Et ambisiøst, personlig mål — aldri et inntektsløfte. Sikker kjøring og pauser kommer alltid først.",
  },
]

export default function ExperienceStudio({
  product,
  value,
  onChange,
  onContinue,
  earnings = 0,
}: StudioProps) {
  const driver = product === "driver"
  const options = driver ? shifts : journeys
  const selected = options.find((item) => item.id === value) ?? options[0]
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const host = useRef<HTMLDivElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const choice = options.find((item) => item.id === draft) ?? options[0]
  const progress = Math.min(100, Math.round((earnings / Number(value)) * 100))
  const close = () => setOpen(false)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.focus()
    return () => previous?.focus()
  }, [open])

  const screen = host.current?.closest(".s10-screen")
  return (
    <div
      ref={host}
      className={`signature-studio ${driver ? "signature-driver" : ""}`}
    >
      <div className="signature-eyebrow">
        <span className="signature-signal" />
        SNAR {driver ? "DRIVE" : "PERSONAL"}
        <span>01 / {driver ? "DITT SKIFT" : "DIN REISE"}</span>
      </div>
      <div className="signature-title">
        {driver ? (
          <>
            Bak rattet.
            <br />
            <span>Foran dagen.</span>
          </>
        ) : (
          <>
            Byen er din.
            <br />
            <span>Reis på din måte.</span>
          </>
        )}
      </div>
      <div className="signature-launch">
        <StateView
          icon={selected.icon}
          title={driver ? selected.sub : `Din reisestil · ${selected.label}`}
          body={
            driver
              ? `${earnings.toLocaleString("nb-NO")} av ${Number(value).toLocaleString("nb-NO")} kr · ${progress} % av målet`
              : selected.sub
          }
          action={driver ? "Åpne Skiftstudio" : "Åpne Reisestudio"}
          onAction={() => {
            setDraft(value)
            setOpen(true)
          }}
        />
      </div>
      <div className="signature-disclaimer">PERSONLIG KONSEPT · DEMODATA</div>
      {driver && (
        <div
          className="signature-meter"
          role="progressbar"
          aria-label="Dagens inntekt mot personlig mål"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <svg
            viewBox="0 0 100 2"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M0 1H100" className="signature-track" />
            <path d={`M0 1H${progress}`} className="signature-fill" />
          </svg>
        </div>
      )}
      {open &&
        screen &&
        createPortal(
          <div
            className="signature-overlay s10-fade"
            role="dialog"
            aria-modal="true"
            aria-label={driver ? "Skiftstudio" : "Reisestudio"}
            ref={dialog}
            tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation()
                close()
              }
              if (event.key === "Tab") {
                const controls = Array.from(
                  dialog.current?.querySelectorAll<HTMLElement>(
                    'button, [tabindex="0"]',
                  ) ?? [],
                )
                const first = controls[0],
                  last = controls[controls.length - 1]
                if (
                  event.shiftKey &&
                  (document.activeElement === first ||
                    document.activeElement === dialog.current)
                ) {
                  event.preventDefault()
                  last?.focus()
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault()
                  first?.focus()
                }
              }
            }}
          >
            <TopBar
              title={driver ? "Skiftstudio" : "Reisestudio"}
              onBack={close}
            />
            <div className="signature-eyebrow">
              <Icon name="ai" size={16} />
              DESIGNET RUNDT DEG
            </div>
            <div className="signature-orbit" aria-hidden="true">
              <div />
              <div />
              <div />
              <Icon name={choice.icon} size={40} />
            </div>
            <div className="signature-choice" aria-live="polite">
              <div className="t-large">{choice.title}</div>
              <div className="t-sec">{choice.body}</div>
            </div>
            <div className="signature-selector">
              <Dock items={options} active={draft} onSelect={setDraft} />
            </div>
            <div className="signature-summary">
              <div className="t-over">
                {driver ? "Ditt personlige mål" : "Ditt neste steg"}
              </div>
              <div className="t-heading">{choice.sub}</div>
              <div className="t-cap">
                {driver
                  ? "Kun lagret i denne demoøkten. Ingen automatisk styring."
                  : "Bilvalget følger deg videre. Ingen tur bestilles her."}
              </div>
            </div>
            <div className="signature-apply">
              <StateView
                icon="check"
                title="Du har kontrollen."
                body="Prototype · ikke koblet til backend, AI eller sanntidsdata."
                action={
                  driver
                    ? "Lagre mål og se innsikt"
                    : "Bruk reisestilen og se ruten"
                }
                secondary="Tilbake uten endringer"
                onAction={() => {
                  onChange(draft)
                  close()
                  onContinue()
                }}
                onSecondary={close}
              />
            </div>
          </div>,
          screen,
        )}
    </div>
  )
}
