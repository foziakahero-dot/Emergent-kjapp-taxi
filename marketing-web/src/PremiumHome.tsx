import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './premium-home.css';
import './premium-home-v2.css';
import BetaWaitlist from './BetaWaitlist';

const FLEET_URL = 'https://fleet.kjappapp.no';
const EMAILS = {
  hello: 'hei@kjappapp.no',
  support: 'support@kjappapp.no',
  driver: 'driver@kjappapp.no',
  fleet: 'fleet@kjappapp.no',
  partner: 'partner@kjappapp.no',
  privacy: 'privacy@kjappapp.no',
};

const ENV = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const ANDROID_BETA_URL = ENV?.VITE_ANDROID_BETA_URL?.trim();
const IOS_TESTFLIGHT_URL = ENV?.VITE_IOS_TESTFLIGHT_URL?.trim();

function Wordmark() {
  return <a className="mk-wordmark" href="#top" aria-label="KJAPP forside"><span>KJ</span><em>A</em><span>PP</span></a>;
}

function MicIcon() {
  return <img src="/assets/figma/mic.svg" alt="" aria-hidden="true" />;
}

function PhoneScene() {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="mk-phone-wrap mk-phone-wrap-v2" aria-label="Interaktiv forhåndsvisning av KJAPP Customer Home">
      <div className="mk-phone-glow" aria-hidden="true" />
      <div className="mk-phone mk-phone-v2">
        <div className="mk-phone-screen mk-phone-screen-v2">
          <div className="mk-phone-island" />

          <div className="mk-app-topbar" aria-hidden="true">
            <div className="mk-app-brand">KJ<span>A</span>PP</div>
            <div className="mk-app-profile">U</div>
          </div>

          <div className="mk-home-map mk-home-map-v2" aria-hidden="true">
            <div className="mk-map-car mk-map-car-a"><span /></div>
            <div className="mk-map-car mk-map-car-b"><span /></div>
            <div className="mk-current-location mk-current-location-v2"><span /><b>DIN POSISJON</b></div>
            <div className="mk-map-road-label mk-map-road-label-a">Majorstuen</div>
            <div className="mk-map-road-label mk-map-road-label-b">Frogner</div>
          </div>

          <div className={`mk-customer-sheet mk-customer-sheet-v2 ${expanded ? 'is-expanded' : 'is-collapsed'}`}>
            {expanded ? (
              <>
                <button
                  type="button"
                  className="mk-sheet-collapse"
                  onClick={() => setExpanded(false)}
                  aria-label="Minimer søkefeltet og vis mer av kartet"
                  aria-expanded="true"
                >
                  <span />
                  <small>MINIMER</small>
                </button>

                <div className="mk-pickup-row mk-pickup-row-v2">
                  <span className="mk-pickup-dot" />
                  <div><small>HENTESTED</small><strong>Din posisjon · Oslo</strong></div>
                </div>
                <div className="mk-cars-nearby"><i />Forhåndsvisning av appen</div>

                <div className="mk-destination-card-v2">
                  <div className="mk-destination-copy-v2">
                    <small>KJAPP</small>
                    <strong>Hvor skal du?</strong>
                    <span>Søk adresse, sted eller flyplass</span>
                  </div>
                  <div className="mk-destination-actions-v2">
                    <span className="mk-voice-btn-v2" aria-hidden="true"><MicIcon /></span>
                    <span className="mk-search-btn-v2" aria-hidden="true">⌕</span>
                  </div>
                </div>

                <div className="mk-quick-places-v2" aria-hidden="true">
                  <span>⌂ Hjem</span>
                  <span>▣ Jobb</span>
                  <span>＋ Legg til</span>
                </div>
              </>
            ) : (
              <button
                type="button"
                className="mk-collapsed-search-v2"
                onClick={() => setExpanded(true)}
                aria-label="Åpne KJAPP søk og bestilling"
                aria-expanded="false"
              >
                <span className="mk-collapsed-location"><i />Din posisjon</span>
                <strong>Hvor vil du?</strong>
                <span className="mk-collapsed-actions"><b><MicIcon /></b><em>⌃</em></span>
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="mk-phone-demo-controls">
        <button type="button" className={expanded ? 'active' : ''} onClick={() => setExpanded(true)}>Åpen</button>
        <button type="button" className={!expanded ? 'active' : ''} onClick={() => setExpanded(false)}>Minimert</button>
      </div>
      <span className="mk-phone-caption">KJAPP KUNDEAPP · ILLUSTRASJON</span>
    </div>
  );
}

const steps = [
  ['01', 'Si eller skriv hvor du skal', 'Skriv inn adressen, eller bruk stemmen hvis det passer bedre.'],
  ['02', 'Velg bil og se estimatet', 'Se tilgjengelige biltyper og prisestimat før du bestemmer deg.'],
  ['03', 'Bestill og følg bilen live', 'Når en sjåfør tar turen, kan du følge bilen på kartet.'],
];

const values = [
  ['01', 'NORSK', 'Vi starter i Oslo og samarbeider med løyvehavere her.'],
  ['02', 'TYDELIG', 'Se bilvalg og prisestimat før du bekrefter turen.'],
  ['03', 'SMART', 'Søk med tekst eller stemme. Du velger selv når turen skal bestilles.'],
  ['04', 'TRYGT', 'Sjåføren er tilknyttet en løyvehaver, og du kan følge turstatus i appen.'],
];

const vehicles = [
  { name: 'KJAPP', copy: 'For hverdagsreisen', image: '/assets/figma/standard.png' },
  { name: 'KJAPP XL', copy: 'Mer plass · opptil 7 seter', image: '/assets/figma/xl.png' },
  { name: 'Premium', copy: 'Når du ønsker mer komfort', image: '/assets/figma/premium.png' },
];

function VoiceDemo() {
  return (
    <section className="mk-voice mk-shell" aria-labelledby="voice-title">
      <div className="mk-voice-copy">
        <span className="mk-section-label">STEMMESØK</span>
        <h2 id="voice-title">Skriv adressen.<br />Eller si den.</h2>
        <p>Du kan søke etter reisemålet med tekst eller stemme. Se over adresse, bilvalg og pris før du bekrefter turen.</p>
        <div className="mk-trust-row"><span>Destinasjon</span><i /> <span>Bilvalg</span><i /> <span>Estimat</span><i /> <span>Bekreft</span></div>
      </div>
      <div className="mk-voice-card" aria-label="Illustrasjon av stemmesøk i KJAPP">
        <div className="mk-voice-field"><span>Hvor vil du?</span><span aria-hidden="true"><MicIcon /></span></div>
        <div className="mk-wave" aria-hidden="true">{Array.from({ length: 16 }).map((_, index) => <i key={index} />)}</div>
        <blockquote>«Kjør meg til Gardermoen.»</blockquote>
        <div className="mk-voice-result">
          <span className="mk-result-dot" />
          <div><small>DESTINASJON FUNNET</small><strong>Oslo lufthavn, Gardermoen</strong></div>
          <b>✓</b>
        </div>
        <div className="mk-system-note">Illustrasjon. Biltilgjengelighet og pris vises i appen når du bestiller.</div>
      </div>
    </section>
  );
}

export default function PremiumHome() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const waitlistTrigger = useRef<HTMLElement | null>(null);

  function openWaitlist(event: React.MouseEvent<HTMLElement>) {
    waitlistTrigger.current = event.currentTarget;
    setMenuOpen(false);
    setWaitlistOpen(true);
  }

  return (
    <main id="top" className="mk-page mk-page-v2">
      <header className="mk-header mk-shell">
        <Wordmark />
        <nav className={menuOpen ? 'is-open' : ''} aria-label="Hovedmeny">
          <a href="#top" onClick={() => setMenuOpen(false)}>Kunder</a>
          <a href="#vehicles" onClick={() => setMenuOpen(false)}>Bilvalg</a>
          <a href="#voice" onClick={() => setMenuOpen(false)}>Voice</a>
          <Link to="/loyvehaver" onClick={() => setMenuOpen(false)}>Løyvehavere</Link>
          <a href={FLEET_URL} onClick={() => setMenuOpen(false)}>Fleet Panel</a>
          <button className="mk-pill mk-pill-primary mk-beta-trigger" type="button" onClick={openWaitlist}>Få tilgang til beta <span className="mk-beta-badge">BETA</span></button>
        </nav>
        <button className="mk-menu-button" type="button" aria-expanded={menuOpen} aria-label="Åpne hovedmeny" onClick={() => setMenuOpen((open) => !open)}>Meny</button>
      </header>

      <section className="mk-hero mk-hero-v2 mk-shell">
        <div className="mk-hero-copy">
          <div className="mk-eyebrow">BETA · OSLO FØRST</div>
          <h1>En enklere taxitur<br />i Oslo.</h1>
          <p className="mk-hero-lead">Skriv inn hvor du skal. Se bilvalg og prisestimat før du bestiller. Når sjåføren er på vei, kan du følge bilen i appen.</p>
          <div className="mk-hero-promise"><span className="mk-pulse" />Taxi med lokale løyvehavere. Vi starter i Oslo.</div>
          <div className="mk-actions">
            <button className="mk-pill mk-pill-primary mk-beta-trigger" type="button" onClick={openWaitlist}>Få tilgang til beta <span className="mk-beta-badge">BETA</span></button>
            <a className="mk-pill mk-pill-dark" href="#journey">Slik fungerer KJAPP</a>
            <Link className="mk-fleet-inline" to="/loyvehaver">For løyvehavere →</Link>
          </div>
          <div className="mk-location">Oslo først · Godkjente løyvehavere · Tydelig prisestimat</div>
        </div>
        <PhoneScene />
      </section>

      <section id="journey" className="mk-journey mk-shell">
        <div className="mk-journey-copy">
          <span className="mk-section-label">SLIK FUNGERER KJAPP</span>
          <h2>Fra adresse<br />til avreise.</h2>
          <div className="mk-step-list">
            {steps.map(([number, title, copy]) => <article className="mk-step" key={number}><span>{number}</span><div><h3>{title}</h3><p>{copy}</p></div></article>)}
          </div>
        </div>
        <aside className="mk-promise">
          <span>KJAPP BETA</span>
          <h3>Du velger turen.<br />Vi viser deg veien.</h3>
          <div />
          <p>Søk etter adresse<br />Se bilene du kan velge<br />Sjekk prisestimatet<br />Bekreft når du er klar</p>
        </aside>
      </section>

      <div id="voice"><VoiceDemo /></div>

      <section id="vehicles" className="mk-vehicles mk-shell" aria-labelledby="vehicles-title">
        <div className="mk-section-heading">
          <div><span className="mk-section-label">VELG DIN KJAPP</span><h2 id="vehicles-title">Tre måter å reise.</h2></div>
          <p>Alene, med bagasje eller flere sammen? Velg bilen som passer turen.</p>
        </div>
        <div className="mk-vehicle-grid">
          {vehicles.map((vehicle, index) => (
            <article className="mk-vehicle-card" key={vehicle.name}>
              <div className="mk-vehicle-number">0{index + 1}</div>
              <img src={vehicle.image} alt={`${vehicle.name} kjøretøykategori`} loading="lazy" />
              <div><h3>{vehicle.name}</h3><p>{vehicle.copy}</p></div>
            </article>
          ))}
        </div>
        <div className="mk-estimate-disclaimer">Tilgjengelige kategorier, estimert pris og hentetid vises i appen før bestilling.</div>
      </section>

      <section className="mk-why mk-shell">
        <div className="mk-why-intro">
          <div><span className="mk-section-label">HVORFOR KJAPP?</span><h2>En tur du har<br />oversikt over.</h2></div>
          <p>Vi bygger KJAPP sammen med løyvehavere i Oslo. I appen ser du hva turen er estimert å koste, hvem som henter deg, og hvor sjåføren er når turen er bekreftet.</p>
        </div>
        <div className="mk-value-grid">
          {values.map(([number, title, copy]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}
        </div>
      </section>

      <section className="mk-partner mk-shell">
        <div className="mk-partner-copy">
          <span>BYGGET OGSÅ FOR DE SOM KJØRER</span>
          <h2>Se sjåførene.<br />Hold orden på driften.</h2>
          <p>Som løyvehaver får du oversikt over tilknyttede sjåfører, biler, dokumenter, turer og oppgjør i flåteportalen.</p>
          <div className="mk-actions"><Link className="mk-pill mk-pill-primary" to="/loyvehaver">For løyvehavere</Link><a className="mk-pill mk-pill-dark" href={FLEET_URL}>Åpne Fleet Panel</a></div>
        </div>
        <div className="mk-partner-system" aria-label="KJAPP partnerverktøy">
          <span>FLEET PANEL</span>
          <strong>Sjåfører</strong><strong>Turer</strong><strong>Dokumenter</strong><strong>Oppgjør</strong>
          <small>Les mer om vilkår og søknad på løyvehaversiden.</small>
        </div>
      </section>

      <section id="download" className="mk-download mk-shell">
        <span className="mk-section-label">KJAPP BETA</span>
        <h2>Vil du prøve KJAPP?</h2>
        <p>Meld deg på beta i Oslo. Vi tar kontakt når vi kan gi deg tilgang. Android- og iPhone-lenker legges ut når appene er klare.</p>
        <div className="mk-actions">
          <button className="mk-pill mk-pill-primary mk-beta-trigger" type="button" onClick={openWaitlist}>Få tilgang til beta <span className="mk-beta-badge">BETA</span></button>
          {ANDROID_BETA_URL ? <a className="mk-pill mk-pill-dark" href={ANDROID_BETA_URL} rel="noreferrer">Android beta</a> : <span className="mk-pill mk-pill-disabled" aria-disabled="true">Android beta · klargjøres</span>}
          {IOS_TESTFLIGHT_URL ? <a className="mk-pill mk-pill-dark" href={IOS_TESTFLIGHT_URL} rel="noreferrer">Åpne i TestFlight</a> : <span className="mk-pill mk-pill-disabled" aria-disabled="true">iPhone beta · kommer snart</span>}
        </div>
        <a className="mk-download-contact" href={`mailto:${EMAILS.support}?subject=KJAPP%20beta`}>Spørsmål om beta? Kontakt support →</a>
      </section>

      <footer className="mk-footer mk-shell">
        <div className="mk-footer-brand"><Wordmark /><p>En enklere taxitur i Oslo.</p></div>
        <nav aria-label="Bunnmeny">
          <a href="#top">Kunder</a>
          <a href="#vehicles">Bilvalg</a>
          <Link to="/loyvehaver">Løyvehaver</Link>
          <a href={FLEET_URL}>Fleet Panel</a>
        </nav>
        <div className="mk-contact-grid" aria-label="Kontakt KJAPP">
          <a href={`mailto:${EMAILS.hello}`}>hei@kjappapp.no</a>
          <a href={`mailto:${EMAILS.support}`}>support@kjappapp.no</a>
          <a href={`mailto:${EMAILS.driver}`}>driver@kjappapp.no</a>
          <a href={`mailto:${EMAILS.fleet}`}>fleet@kjappapp.no</a>
          <a href={`mailto:${EMAILS.partner}`}>partner@kjappapp.no</a>
          <a href={`mailto:${EMAILS.privacy}`}>privacy@kjappapp.no</a>
        </div>
        <span>© 2026 KJAPP · NexoraHub AS</span>
      </footer>
      <BetaWaitlist open={waitlistOpen} onClose={() => setWaitlistOpen(false)} returnFocusTo={waitlistTrigger.current} />
    </main>
  );
}
