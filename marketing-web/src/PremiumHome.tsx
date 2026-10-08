import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import BetaWaitlist, { type BetaRole } from "./BetaWaitlist";
import ProductPreview from "./ProductPreview";
import { Badge, Brand, Card, Footer } from "./SnarUI";
import "./landing-simplify.css";

const steps = [
  ["01", "Hvor skal du?", "Velg hentested og destinasjon. Skriv eller bruk stemmen."],
  ["02", "Velg bilen", "Se prisestimat og hentetid før du bestiller."],
  ["03", "Følg reisen", "Følg sjåføren til hentestedet og betal digitalt i appen."],
];

const vehicles = [
  ["SNAR", "Rask og enkel", "/assets/snar/standard-3d.svg"],
  ["SNAR XL", "Mer plass til reisefølget", "/assets/snar/xl-3d.svg"],
  ["Premium", "Ekstra komfort", "/assets/snar/premium-3d.svg"],
];

const safety = [
  "Profesjonelle sjåfører med kjøreseddel",
  "Sjåfør, bil og registreringsnummer før henting",
  "Sjåførens posisjon i sanntid",
  "Mulighet til å dele reisen",
];

export default function PremiumHome() {
  const [open, setOpen] = useState(false);
  const [betaRole, setBetaRole] = useState<BetaRole>("passenger");
  const trigger = useRef<HTMLElement | null>(null);
  const close = useCallback(() => setOpen(false), []);

  function openBeta(event: React.MouseEvent<HTMLElement>, role: BetaRole = "passenger") {
    trigger.current = event.currentTarget;
    setBetaRole(role);
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
            <Link to="/loyvehaver">For løyvehavere</Link>
          </nav>
          <div className="snar-header-actions">
            <button type="button" className="snar-btn snar-btn-primary" onClick={openBeta}>
              Meld interesse
            </button>
          </div>
        </div>
      </header>

      <main id="content">
        <section className="snar-hero snar-shell snar-hero-clean" aria-labelledby="hero-title">
          <div className="snar-hero-copy">
            <Badge>SNAR · OSLO-BETA</Badge>
            <h1 id="hero-title">Dit du skal.<br />Med SNAR.</h1>
            <p className="snar-lead">Bestill en bil med sjåfør. Se prisestimat, følg sjåføren og betal i appen.</p>
            <div className="snar-actions snar-hero-actions-simple">
              <button type="button" className="snar-btn snar-btn-primary" onClick={openBeta}>
                Meld interesse for beta <span aria-hidden="true">↗</span>
              </button>
              <Link className="snar-text-link" to="/loyvehaver">For løyvehavere →</Link>
            </div>
            <p className="snar-hero-note">En norsk mobilitetsplattform. Oversikt hele veien.</p>
          </div>
          <ProductPreview />
        </section>

        <section id="how" className="snar-section snar-shell snar-how-simple" aria-labelledby="how-title">
          <div className="snar-section-copy">
            <span className="snar-kicker">SLIK FUNGERER SNAR</span>
            <h2 id="how-title">Fra bestilling til reise på tre steg.</h2>
            <p>Reisen samlet i appen. Velg hentested og destinasjon, se prisestimat og bestill bil med sjåfør. Når bestillingen er akseptert, ser du hvem som henter deg.</p>
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
              <h2 id="vehicles-title">Velg bilen som passer reisen.</h2>
              <p>En tur alene, flere sammen eller litt ekstra komfort. Se tilgjengelige biler, prisestimat og forventet hentetid i appen.</p>
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
            <span className="snar-kicker">DIN REISE. DIN OVERSIKT.</span>
            <h2 id="features-title">Enklere bestilling. Bedre oversikt.</h2>
            <p>Bestill med stemmen, se hvem som henter deg og følg sjåføren i sanntid.</p>
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
              <p>SNAR Assist hjelper deg med bestillingen. Sjekk hentested, destinasjon, bilvalg og prisestimat før du bekrefter.</p>
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

        <section id="drivers" className="snar-section snar-shell" aria-labelledby="drivers-title">
          <div className="snar-section-copy">
            <span className="snar-kicker">FOR SJÅFØRER</span>
            <h2 id="drivers-title">Kjør med SNAR.</h2>
            <p>En moderne plattform for profesjonelle sjåfører. Få oversikt over bestillinger og reisen i sjåførappen.</p>
            <p>Tilgang krever gyldig kjøreseddel og godkjenning. Sjåfører knyttes til en godkjent løyvehaver.</p>
          </div>
          <div className="snar-actions">
            <button type="button" className="snar-btn snar-btn-primary" onClick={(event) => openBeta(event, "driver")}>Meld interesse som sjåfør</button>
            <Link className="snar-text-link" to="/loyvehaver">For løyvehavere →</Link>
          </div>
        </section>

        <section id="download" className="snar-beta snar-shell snar-final-cta" aria-labelledby="beta-heading">
          <Badge>OSLO FØRST</Badge>
          <h2 id="beta-heading">Bli blant de første som prøver SNAR.</h2>
          <p>Vi starter med en avgrenset beta i Oslo. Meld interesse for neste testgruppe. Vi kontakter deg når tilgang åpner.</p>
          <div className="snar-actions">
            <button className="snar-btn snar-btn-primary" type="button" onClick={openBeta}>Meld interesse for beta</button>
            <Link className="snar-text-link" to="/loyvehaver">Er du løyvehaver? →</Link>
            <Link className="snar-text-link" to="/help#faq">Spørsmål om SNAR? →</Link>
          </div>
        </section>
      </main>

      <Footer />
      <BetaWaitlist open={open} onClose={close} returnFocusTo={trigger.current} initialRole={betaRole} />
    </div>
  );
}

