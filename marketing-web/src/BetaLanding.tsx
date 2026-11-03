import { useCallback, useRef, useState, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import BetaWaitlist from "./BetaWaitlist";
import { Brand, SnarMark } from "./SnarUI";
import "./beta-launch.css";

const journey = [
  {
    number: "01",
    title: "Meld interesse",
    description: "Oppgi navn, telefonnummer og e-post. Søknaden legges på SNARs eksisterende venteliste.",
  },
  {
    number: "02",
    title: "Vi velger testgruppen",
    description: "Vi inviterer kunder gradvis, basert på tilgjengelige biler og kapasitet i Oslo.",
  },
  {
    number: "03",
    title: "Få privat tilgang",
    description: "Utvalgte deltakere mottar installasjonsinformasjon for Android eller iPhone.",
  },
  {
    number: "04",
    title: "Test og gi tilbakemelding",
    description: "Hjelp oss å forbedre bestilling, henting og reiseopplevelsen før offentlig lansering.",
  },
];

const questions = [
  {
    title: "Er dette en offentlig lansering?",
    answer: "Nei. SNAR starter med en lukket testgruppe i Oslo. En registrering er en interessepåmelding, ikke en bekreftet invitasjon.",
  },
  {
    title: "Må jeg ha appen for å søke?",
    answer: "Nei. Du søker på nettsiden. Hvis du blir invitert, får du informasjon om hvordan du kan installere testversjonen.",
  },
  {
    title: "Hva koster det å delta?",
    answer: "Det er gratis å melde interesse. Eventuelle turpriser og kampanjefordeler blir opplyst før du bestiller en tur.",
  },
  {
    title: "Hva skjer med opplysningene mine?",
    answer: "Vi bruker kontaktopplysningene for å følge opp beta-påmeldingen. Du kan lese mer i personvernerklæringen.",
  },
];

export default function BetaLanding() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);
  const close = useCallback(() => setOpen(false), []);

  const openWaitlist = (event: MouseEvent<HTMLButtonElement>) => {
    trigger.current = event.currentTarget;
    setOpen(true);
  };

  return (
    <div className="snar-page beta-launch">
      <a className="beta-skip" href="#beta-content">Hopp til innhold</a>
      <header className="beta-header">
        <div className="beta-wrap beta-header-inner">
          <Brand />
          <nav aria-label="Beta-navigasjon">
            <a href="#slik-fungerer-det">Slik fungerer det</a>
            <a href="#beta-faq">Spørsmål</a>
            <Link to="/">Om SNAR</Link>
          </nav>
          <button type="button" className="beta-button beta-button-small" onClick={openWaitlist}>
            Søk om tilgang <span aria-hidden="true">↗</span>
          </button>
        </div>
      </header>

      <main id="beta-content">
        <section className="beta-hero beta-wrap" aria-labelledby="beta-title">
          <div className="beta-hero-copy">
            <span className="beta-eyebrow"><span className="beta-live-dot" /> OSLO · LUKKET BETA</span>
            <h1 id="beta-title">Oslo beveger seg <em>SNARere.</em></h1>
            <p className="beta-lead">
              Bli med blant de første som tester SNAR — en enklere måte å
              bestille og følge reisen på. Vi starter med en liten gruppe i Oslo.
            </p>
            <div className="beta-actions">
              <button type="button" className="beta-button" onClick={openWaitlist}>
                Søk om beta-tilgang <span aria-hidden="true">↗</span>
              </button>
              <a href="#slik-fungerer-det" className="beta-button beta-button-secondary">
                Slik fungerer det <span aria-hidden="true">↓</span>
              </a>
            </div>
            <p className="beta-legal-note">Gratis å søke · Begrensede plasser · Invitasjon kreves</p>
          </div>

          <div className="beta-hero-art" aria-label="Illustrasjon av SNARs beta-program">
            <div className="beta-art-label">SNAR / OSLO <span>BETA 01</span></div>
            <div className="beta-orbit beta-orbit-one" aria-hidden="true" />
            <div className="beta-orbit beta-orbit-two" aria-hidden="true" />
            <div className="beta-path" aria-hidden="true" />
            <div className="beta-pin beta-pin-one" aria-hidden="true" />
            <div className="beta-pin beta-pin-two" aria-hidden="true" />
            <div className="beta-art-center" aria-hidden="true"><SnarMark size={132} /></div>
            <div className="beta-art-bottom">
              <span>ET NYTT KAPITTEL FOR MOBILITET I OSLO</span>
              <strong>Du kan være med fra starten.</strong>
            </div>
          </div>
        </section>

        <section className="beta-founded beta-wrap" aria-labelledby="beta-founding">
          <div className="beta-founded-emblem" aria-hidden="true"><span>FOUNDING</span><strong>500</strong></div>
          <div>
            <span className="beta-label">TIDLIG TILGANG</span>
            <h2 id="beta-founding">SNAR Founding 500</h2>
            <p>
              Vi planlegger å invitere opptil 500 tidlige deltakere i etapper.
              Første testgruppe blir mindre, slik at vi kan gi hver kunde en god opplevelse.
            </p>
          </div>
          <button type="button" className="beta-text-link" onClick={openWaitlist}>
            Bli vurdert for beta <span aria-hidden="true">↗</span>
          </button>
        </section>

        <section id="slik-fungerer-det" className="beta-section beta-wrap" aria-labelledby="beta-steps-title">
          <div className="beta-section-heading">
            <span className="beta-label">ENKELT OG KONTROLLERT</span>
            <h2 id="beta-steps-title">Fire steg inn i betaen.</h2>
            <p>Vi åpner gradvis og inviterer bare så mange kunder som vi kan følge opp.</p>
          </div>
          <div className="beta-steps">
            {journey.map((step) => (
              <article className="beta-step" key={step.number}>
                <span className="beta-step-number">{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="beta-join" aria-labelledby="beta-join-title">
          <div className="beta-wrap beta-join-inner">
            <div>
              <span className="beta-label">OSLO BETA</span>
              <h2 id="beta-join-title">Vær med og form SNAR.</h2>
              <p>Vi ser etter mennesker som vil prøve noe nytt og gi ærlige tilbakemeldinger.</p>
            </div>
            <button type="button" className="beta-button" onClick={openWaitlist}>
              Meld interesse <span aria-hidden="true">↗</span>
            </button>
          </div>
        </section>

        <section id="beta-faq" className="beta-section beta-faq beta-wrap" aria-labelledby="beta-faq-title">
          <div className="beta-section-heading">
            <span className="beta-label">DET DU LURER PÅ</span>
            <h2 id="beta-faq-title">Spørsmål og svar.</h2>
          </div>
          <div className="beta-faq-list">
            {questions.map((question) => (
              <details key={question.title}>
                <summary>{question.title}<span aria-hidden="true">+</span></summary>
                <p>{question.answer}</p>
              </details>
            ))}
          </div>
          <p className="beta-privacy-copy">
            Ved å melde interesse samtykker du til kontakt om betaen.
            Les vår <Link to="/personvern">personvernerklæring</Link>.
          </p>
        </section>
      </main>

      <footer className="beta-footer">
        <div className="beta-wrap beta-footer-inner">
          <Brand />
          <p>© SNAR · Smartere mobilitet.</p>
          <div>
            <Link to="/personvern">Personvern</Link>
            <Link to="/vilkar">Vilkår</Link>
            <Link to="/">Til forsiden</Link>
          </div>
        </div>
      </footer>
      <BetaWaitlist open={open} onClose={close} returnFocusTo={trigger.current} initialRole="passenger" />
    </div>
  );
}
