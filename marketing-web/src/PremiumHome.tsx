import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import BetaWaitlist from "./BetaWaitlist";
import ProductPreview from "./ProductPreview";
import { Badge, Brand, Card, Footer } from "./SnarUI";
import "./landing-simplify.css";

const steps = [
  ["01", "Hvor skal du?", "Skriv eller si destinasjonen."],
  ["02", "Velg bilen", "Se prisestimat og hentetid før du bestiller."],
  ["03", "Følg reisen", "Se bilen live frem til hentestedet."],
];

const vehicles = [
  ["SNAR", "Rask og enkel", "/assets/snar/standard-3d.svg"],
  ["SNAR XL", "Mer plass · opptil 7 seter", "/assets/snar/xl-3d.svg"],
  ["Premium", "Ekstra komfort", "/assets/snar/premium-3d.svg"],
];

const safety = [
  "Lisensierte sjåfører",
  "Sjåfør, bil og skilt før henting",
  "Live-posisjon under reisen",
  "Mulighet til å dele reisen",
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
        <a className="snar-skip" href="#content">Hopp til innhold</a>
        <div className="snar-shell snar-header-inner">
          <Brand />
          <nav aria-label="Hovedmeny">
            <a href="#how">Slik fungerer det</a>
            <a href="#features">SNAR Assist</a>
            <Link to="/loyvehaver">Kjør med SNAR</Link>
          </nav>
          <div className="snar-header-actions">
            <button type="button" className="snar-btn snar-btn-primary" onClick={openBeta}>
              Få beta
            </button>
          </div>
        </div>
      </header>

      <main id="content">
        <section className="snar-hero snar-shell snar-hero-clean" aria-labelledby="hero-title">
          <div className="snar-hero-copy">
            <Badge>OSLO · BETA</Badge>
            <h1 id="hero-title">Taxi.<br />Bare enklere.</h1>
            <p className="snar-lead">Bestill. Se prisen. Følg bilen.</p>
            <div className="snar-actions snar-hero-actions-simple">
              <button type="button" className="snar-btn snar-btn-primary" onClick={openBeta}>
                Få SNAR beta <span aria-hidden="true">↗</span>
              </button>
              <Link className="snar-text-link" to="/loyvehaver">Kjør med SNAR →</Link>
            </div>
            <p className="snar-hero-note">Norsk taxiopplevelse · tydelig prisestimat · live sporing</p>
          </div>
          <ProductPreview />
        </section>

        <section id="how" className="snar-section snar-shell snar-how-simple" aria-labelledby="how-title">
          <div className="snar-section-copy">
            <span className="snar-kicker">SLIK FUNGERER SNAR</span>
            <h2 id="how-title">Fra adresse til bil på tre steg.</h2>
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

        <section id="vehicles" className="snar-section snar-vehicles snar-vehicles-clean" aria-labelledby="vehicles-title">
          <div className="snar-shell">
            <div className="snar-section-copy snar-section-copy-centered">
              <span className="snar-kicker">VELG BIL</span>
              <h2 id="vehicles-title">Riktig bil. Uten unødvendige valg.</h2>
              <p>Tre tydelige kategorier. Pris og forventet hentetid vises før du bekrefter.</p>
            </div>
            <div className="snar-vehicle-grid snar-vehicle-grid-clean">
              {vehicles.map(([name, copy, image]) => (
                <Card key={name} className="snar-vehicle-card snar-vehicle-card-clean">
                  <img src={image} width="276" height="148" alt={`${name} kjøretøykategori`} loading="lazy" />
                  <div>
                    <h3>{name}</h3>
                    <p>{copy}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="snar-section snar-shell snar-feature-duo" aria-labelledby="features-title">
          <div className="snar-feature-intro">
            <span className="snar-kicker">SMART NÅR DU VIL. TRYGT HELE VEIEN.</span>
            <h2 id="features-title">Mindre friksjon. Mer kontroll.</h2>
            <p>SNAR Assist gjør bestillingen enklere, mens tydelig sjåfør- og bilinformasjon gjør hentingen tryggere.</p>
          </div>

          <div className="snar-feature-grid">
            <Card className="snar-assist-panel">
              <div className="snar-feature-icon" aria-hidden="true">
                <img src="/assets/figma/mic.svg" width="30" height="30" alt="" />
              </div>
              <span className="snar-kicker">SNAR ASSIST</span>
              <h3>Bare si hvor du skal.</h3>
              <blockquote>«Kjør meg til Gardermoen.»</blockquote>
              <div className="snar-voice-wave" aria-hidden="true">
                {[18, 30, 46, 26, 56, 38, 22, 44, 28, 16, 34, 20].map((height, i) => (
                  <i key={i} style={{ height, animationDelay: `${i * 70}ms` }} />
                ))}
              </div>
              <p>SNAR gjør turen klar. Du ser over destinasjon, bilvalg og prisestimat før du bekrefter.</p>
            </Card>

            <Card className="snar-safety-panel">
              <span className="snar-kicker">TRYGG HENTING</span>
              <h3>Du vet hvem som kommer.</h3>
              <ul className="snar-safety-list">
                {safety.map((item) => (
                  <li key={item}><span aria-hidden="true">✓</span>{item}</li>
                ))}
              </ul>
            </Card>
          </div>
        </section>

        <section id="download" className="snar-beta snar-shell snar-final-cta" aria-labelledby="beta-heading">
          <Badge>OSLO FØRST</Badge>
          <h2 id="beta-heading">Bli blant de første som prøver SNAR.</h2>
          <p>Meld interesse, så kontakter vi deg når beta-tilgang åpner.</p>
          <div className="snar-actions">
            <button className="snar-btn snar-btn-primary" type="button" onClick={openBeta}>Få tilgang til beta</button>
            <Link className="snar-text-link" to="/loyvehaver">Er du løyvehaver? →</Link>
          </div>
        </section>
      </main>

      <Footer />
      <BetaWaitlist open={open} onClose={close} returnFocusTo={trigger.current} />
    </div>
  );
}
