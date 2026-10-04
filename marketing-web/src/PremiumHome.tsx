import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import BetaWaitlist from "./BetaWaitlist";
import ProductPreview from "./ProductPreview";
import { Badge, Brand, Card, Footer } from "./SnarUI";
import "./landing-simplify.css";

const steps = [
  [
    "01",
    "Hvor skal du?",
    "Skriv eller si destinasjonen. SNAR gjør reisen klar.",
  ],
  [
    "02",
    "Velg bil",
    "Se biltype, prisestimat og hentetid før du bestiller.",
  ],
  [
    "03",
    "Følg bilen",
    "Når turen er akseptert, følger du bilen live frem til hentestedet.",
  ],
];

const vehicles = [
  ["SNAR", "Til hverdagen", "/assets/snar/standard-3d.svg"],
  ["SNAR XL", "Mer plass · opptil 7 seter", "/assets/snar/xl-3d.svg"],
  ["Premium", "Ekstra komfort", "/assets/snar/premium-3d.svg"],
];

const safety = [
  "Lisensierte sjåfører",
  "Sjåfør, bil og registreringsnummer etter aksept",
  "Live-posisjon under reisen",
  "Mulighet til å dele reisen",
  "Norsk kundestøtte",
];

export default function PremiumHome() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);
  const close = useCallback(() => setOpen(false), []);

  function openBeta(event: React.MouseEvent<HTMLElement>) {
    trigger.current = event.currentTarget;
    setOpen(true);
  }

  return (
    <div id="top" className="snar-page snar-streamlined-page">
      <header className="snar-header snar-streamlined-header">
        <a className="snar-skip" href="#content">
          Hopp til innhold
        </a>
        <div className="snar-shell snar-header-inner">
          <Brand />
          <nav aria-label="Hovedmeny">
            <a href="#how">Slik fungerer det</a>
            <a href="#safety">Sikkerhet</a>
            <Link to="/loyvehaver">Kjør med SNAR</Link>
          </nav>
          <div className="snar-header-actions">
            <button
              type="button"
              className="snar-btn snar-btn-primary"
              onClick={openBeta}
            >
              Få beta
            </button>
          </div>
        </div>
      </header>

      <main id="content">
        <section className="snar-hero snar-shell" aria-labelledby="hero-title">
          <div className="snar-hero-copy">
            <h1 id="hero-title">
              Taxi.
              <br />
              Bare enklere.
            </h1>
            <p className="snar-lead">
              Bestill, se prisen og følg bilen hele veien.
            </p>
            <div className="snar-actions snar-hero-actions-simple">
              <button
                type="button"
                className="snar-btn snar-btn-primary"
                onClick={openBeta}
              >
                Få SNAR beta <span aria-hidden="true">↗</span>
              </button>
              <Link className="snar-text-link" to="/loyvehaver">
                Kjør med SNAR →
              </Link>
            </div>
          </div>
          <ProductPreview />
        </section>

        <div
          className="snar-trust-strip snar-shell"
          aria-label="Dette får du med SNAR"
        >
          <span>Norske løyvehavere</span>
          <span>Lisensierte sjåfører</span>
          <span>Pris før bestilling</span>
          <span>Live sporing</span>
        </div>

        <section
          id="how"
          className="snar-section snar-shell snar-how-simple"
          aria-labelledby="how-title"
        >
          <div className="snar-section-copy">
            <span className="snar-kicker">SLIK FUNGERER SNAR</span>
            <h2 id="how-title">Fra destinasjon til bil på tre steg.</h2>
          </div>
          <ol className="snar-process" aria-label="Tre steg for å bestille med SNAR">
            {steps.map(([n, title, copy]) => (
              <li key={n} className="snar-process-step">
                <span className="snar-number">{n}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </li>
            ))}
          </ol>
        </section>

        <section
          id="vehicles"
          className="snar-section snar-vehicles"
          aria-labelledby="vehicles-title"
        >
          <div className="snar-shell">
            <div className="snar-section-copy">
              <span className="snar-kicker">VELG BIL</span>
              <h2 id="vehicles-title">Velg det som passer reisen.</h2>
            </div>
            <div className="snar-vehicle-grid">
              {vehicles.map(([name, copy, image]) => (
                <Card key={name} className="snar-vehicle-card">
                  <img
                    src={image}
                    width="276"
                    height="148"
                    alt={name + " kjøretøykategori"}
                    loading="lazy"
                  />
                  <h3>{name}</h3>
                  <p>{copy}</p>
                </Card>
              ))}
            </div>
            <p className="snar-caption">
              Tilgjengelige kategorier, estimert pris og hentetid vises i appen før bestilling.
            </p>
          </div>
        </section>

        <section
          id="voice"
          className="snar-section snar-shell snar-voice"
          aria-labelledby="voice-title"
        >
          <div>
            <span className="snar-kicker">SNAR ASSIST</span>
            <h2 id="voice-title">Bare si hvor du skal.</h2>
            <p>
              Fortell hvor du vil reise. SNAR gjør bestillingen klar, og du ser
              over destinasjon, bilvalg og prisestimat før du bekrefter.
            </p>
          </div>
          <Card className="snar-voice-card">
            <img src="/assets/figma/mic.svg" width="40" height="40" alt="" />
            <blockquote>«Kjør meg til Gardermoen.»</blockquote>
            <div className="snar-voice-wave" aria-hidden="true">
              {[18, 30, 46, 26, 56, 38, 22, 44, 28, 16, 34, 20].map((height, i) => (
                <i key={i} style={{ height, animationDelay: `${i * 70}ms` }} />
              ))}
            </div>
            <p>Si destinasjonen. Se over. Bekreft.</p>
          </Card>
        </section>

        <section
          id="safety"
          className="snar-section snar-shell snar-safety"
          aria-labelledby="safety-title"
        >
          <div className="snar-section-copy">
            <span className="snar-kicker">SIKKERHET</span>
            <h2 id="safety-title">Trygt hele veien.</h2>
            <p>
              Du skal vite hvem som kommer, hvilken bil du skal se etter og hvor
              reisen befinner seg.
            </p>
          </div>
          <ul className="snar-safety-list">
            {safety.map((item) => (
              <li key={item}>
                <span aria-hidden="true">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section
          id="download"
          className="snar-beta snar-shell snar-final-cta"
          aria-labelledby="beta-heading"
        >
          <Badge>OSLO FØRST</Badge>
          <h2 id="beta-heading">Bli blant de første som kjører med SNAR.</h2>
          <p>
            Vi starter i Oslo. Meld interesse, så kontakter vi deg når beta-tilgang åpner.
          </p>
          <div className="snar-actions">
            <button
              className="snar-btn snar-btn-primary"
              type="button"
              onClick={openBeta}
            >
              Få tilgang til beta
            </button>
          </div>
        </section>
      </main>

      <Footer />
      <BetaWaitlist
        open={open}
        onClose={close}
        returnFocusTo={trigger.current}
      />
    </div>
  );
}
