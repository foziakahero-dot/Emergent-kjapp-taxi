import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import BetaWaitlist from "./BetaWaitlist";
import ProductPreview from "./ProductPreview";
import { Badge, Card, Footer, Header } from "./SnarUI";

const steps = [
  [
    "01",
    "Si eller skriv hvor du skal",
    "Søk etter destinasjon eller bruk stemmen. SNAR finner stedet og gjør reisen klar.",
  ],
  [
    "02",
    "Velg bil og se estimatet",
    "SNAR, SNAR XL eller Premium. Se estimert pris og hentetid før du bestiller.",
  ],
  [
    "03",
    "Bestill og følg bilen live",
    "Bekreft turen og følg sjåføren på kartet helt frem til hentestedet.",
  ],
];
const values = [
  [
    "01",
    "NORSK",
    "Bygget rundt norske reisende, lokale løyvehavere og norsk kundestøtte.",
  ],
  [
    "02",
    "TYDELIG",
    "Biltype, prisestimat og turstatus vises før og under reisen.",
  ],
  [
    "03",
    "SMART",
    "Skriv eller si destinasjonen. Teknologien hjelper deg videre uten å stå i veien.",
  ],
  [
    "04",
    "TRYGT",
    "Lisensierte sjåfører, live sporing og samme system fra bestilling til fullført tur.",
  ],
];
const vehicles = [
  ["SNAR", "Rask og enkel", "/assets/snar/standard-3d.svg"],
  ["SNAR XL", "Mer plass · opptil 7 seter", "/assets/snar/xl-3d.svg"],
  ["Premium", "Premium komfort", "/assets/snar/premium-3d.svg"],
];
const env = import.meta.env;
export default function PremiumHome() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);
  const close = useCallback(() => setOpen(false), []);
  function openBeta(event: React.MouseEvent<HTMLElement>) {
    trigger.current = event.currentTarget;
    setOpen(true);
  }
  return (
    <div id="top" className="snar-page">
      <Header onBeta={openBeta} />
      <main id="content">
        <section className="snar-hero snar-shell" aria-labelledby="hero-title">
          <div className="snar-hero-copy">
            <Badge>OSLO FØRST · BETA</Badge>
            <h1 id="hero-title">
              Norsk taxi,
              <br />
              uten omveier.
            </h1>
            <p className="snar-lead">
              Skriv eller si hvor du skal. Velg bil, se prisestimatet
              og følg reisen i appen.
            </p>
            <div className="snar-actions">
              <button
                type="button"
                className="snar-btn snar-btn-primary"
                onClick={openBeta}
              >
                Få tilgang til beta <span aria-hidden="true">↗</span>
              </button>
              <Link className="snar-btn snar-btn-secondary" to="/loyvehaver">
                For løyvehavere
              </Link>
            </div>
            <a className="snar-voice-link" href="#voice">
              Utforsk stemmebestilling →
            </a>
            <p className="snar-hero-note">
              Beta i Oslo. Vi kontakter deg når du får tilgang.
            </p>
          </div>
          <ProductPreview />
        </section>
        <div className="snar-trust-strip snar-shell" aria-label="Dette får du med SNAR">
          <span>Lisensierte sjåfører</span>
          <span>Tydelig prisestimat</span>
          <span>Live sporing</span>
          <span>Norsk support</span>
        </div>
        <section
          id="how"
          className="snar-section snar-shell"
          aria-labelledby="how-title"
        >
          <div className="snar-section-copy">
            <span className="snar-kicker">SLIK FUNGERER SNAR</span>
            <h2 id="how-title">
              Én reise.
              <br />
              Tre enkle steg.
            </h2>
          </div>
          <div className="snar-step-grid">
            {steps.map(([n, title, copy]) => (
              <Card key={n}>
                <span className="snar-number">{n}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </Card>
            ))}
          </div>
        </section>
        <section
          id="voice"
          className="snar-section snar-shell snar-voice"
          aria-labelledby="voice-title"
        >
          <div>
            <span className="snar-kicker">SNAR ASSIST</span>
            <h2 id="voice-title">
              Si hvor du skal.
              <br />
              SNAR ordner resten.
            </h2>
            <p>
              Fortell hvor du vil reise. SNAR gjør bestillingen klar,
              og du ser over destinasjon, bilvalg og prisestimat
              før du bekrefter.
            </p>
          </div>
          <Card className="snar-voice-card">
            <img src="/assets/figma/mic.svg" width="40" height="40" alt="" />
            <blockquote>«Kjør meg til Gardermoen.»</blockquote>
            <div className="snar-voice-wave" aria-hidden="true">{[18, 30, 46, 26, 56, 38, 22, 44, 28, 16, 34, 20].map((height, i) => <i key={i} style={{ height, animationDelay: `${i * 70}ms` }} />)}</div>
            <p>Si destinasjonen. Se over. Bekreft.</p>
          </Card>
        </section>
        <section
          id="vehicles"
          className="snar-section snar-vehicles"
          aria-labelledby="vehicles-title"
        >
          <div className="snar-shell">
            <div className="snar-section-copy">
              <span className="snar-kicker">VELG DIN SNAR</span>
              <h2 id="vehicles-title">Tre måter å reise.</h2>
              <p>
                Til hverdagen, når dere er flere, eller når du ønsker
                litt ekstra komfort. Velg bilen som passer reisen.
              </p>
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
              Tilgjengelige kategorier, estimert pris og hentetid vises i appen
              før bestilling.
            </p>
          </div>
        </section>
        <section
          className="snar-section snar-shell"
          aria-labelledby="why-title"
        >
          <div className="snar-section-copy">
            <span className="snar-kicker">HVORFOR SNAR?</span>
            <h2 id="why-title">
              Ikke større.
              <br />
              Bare smartere og nærmere.
            </h2>
            <p>
              Lokale løyvehavere. Lisensierte sjåfører. En enklere
              bestilling bygget for norske reisende.
            </p>
          </div>
          <div className="snar-value-grid">
            {values.map(([n, title, copy]) => (
              <article key={n}>
                <span className="snar-number">{n}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>
        <section
          className="snar-partner snar-shell"
          aria-labelledby="partner-title"
        >
          <div>
            <span className="snar-kicker">BYGGET OGSÅ FOR DE SOM KJØRER</span>
            <h2 id="partner-title">
              Din virksomhet.
              <br />
              Moderne verktøy rundt turene.
            </h2>
            <p>
              Samle sjåfører, turer, dokumentasjon og oppgjør i Fleet Panel.
              Få oversikt over driften og norsk oppfølging som SNAR-partner.
            </p>
            <div className="snar-actions">
              <Link className="snar-btn snar-btn-primary" to="/loyvehaver">
                For løyvehavere
              </Link>
              <a
                className="snar-btn snar-btn-secondary"
                href="https://fleet.kjappapp.no"
              >
                Åpne Fleet Panel
              </a>
            </div>
          </div>
          <div className="snar-partner-system">
            <span className="snar-kicker">FLEET PANEL</span>
            {["Sjåfører", "Turer", "Dokumenter", "Oppgjør"].map((x) => (
              <strong key={x}>
                {x}
                <span aria-hidden="true">↗</span>
              </strong>
            ))}
            <small>
              Partnerøkonomi og serviceavgift forklares på løyvehaversiden.
            </small>
          </div>
        </section>
        <section
          id="download"
          className="snar-beta snar-shell"
          aria-labelledby="beta-heading"
        >
          <Badge>OSLO FØRST · BETA</Badge>
          <h2 id="beta-heading">Bli med på de første turene.</h2>
          <p>
            Vi starter i Oslo. Meld interesse som passasjer, sjåfør
            eller løyvehaver, så kontakter vi deg når beta-tilgang åpner
            for din gruppe.
          </p>
          <div className="snar-actions">
            <button
              className="snar-btn snar-btn-primary"
              type="button"
              onClick={openBeta}
            >
              Få tilgang til beta
            </button>
            {env.VITE_ANDROID_BETA_URL?.trim() && (
              <a
                className="snar-btn snar-btn-secondary"
                href={env.VITE_ANDROID_BETA_URL}
              >
                Android beta
              </a>
            )}
            {env.VITE_IOS_TESTFLIGHT_URL?.trim() && (
              <a
                className="snar-btn snar-btn-secondary"
                href={env.VITE_IOS_TESTFLIGHT_URL}
              >
                Åpne i TestFlight
              </a>
            )}
          </div>
          <a
            className="snar-beta-support"
            href="mailto:support@kjappapp.no?subject=SNAR%20beta"
          >
            Spørsmål om beta? Kontakt support →
          </a>
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
