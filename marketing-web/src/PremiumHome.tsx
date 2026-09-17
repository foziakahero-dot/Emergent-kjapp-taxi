import { useState } from 'react';
import { Link } from 'react-router-dom';
import './premium-home.css';

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
  return (
    <div className="mk-phone-wrap" aria-label="Forhåndsvisning av KJAPP Customer Home">
      <div className="mk-phone-glow" aria-hidden="true" />
      <div className="mk-phone">
        <div className="mk-phone-screen">
          <div className="mk-phone-island" />
          <div className="mk-home-map" aria-hidden="true">
            <div className="mk-current-location"><span /><b>DIN POSISJON</b></div>
          </div>

          <div className="mk-customer-sheet">
            <div className="mk-product-kicker">KJAPP</div>
            <h3>Hvor vil du?</h3>
            <div className="mk-destination-field">
              <span className="mk-search-dot" />
              <span>Søk etter destinasjon</span>
              <button type="button" aria-label="Bestill med stemmen"><MicIcon /></button>
            </div>
            <div className="mk-pickup-row"><span className="mk-pickup-dot" /><div><small>HENTESTED</small><strong>Din nåværende posisjon</strong></div></div>
            <div className="mk-mini-vehicles" aria-label="KJAPP bilkategorier">
              <span>KJAPP</span><span>KJAPP XL</span><span>Premium</span>
            </div>
            <div className="mk-estimate-note">Pris og hentetid vises før du bekrefter.</div>
          </div>
        </div>
      </div>
      <span className="mk-phone-caption">CUSTOMER · GOLD</span>
    </div>
  );
}

const steps = [
  ['01', 'Si eller skriv hvor du skal', 'Søk etter destinasjon eller bruk stemmen. KJAPP finner stedet og gjør reisen klar.'],
  ['02', 'Velg bil og se estimatet', 'KJAPP, KJAPP XL eller Premium. Se estimert pris og hentetid før du bestiller.'],
  ['03', 'Bestill og følg bilen live', 'Bekreft turen og følg sjåføren på kartet helt frem til hentestedet.'],
];

const values = [
  ['01', 'NORSK', 'Bygget rundt norske reisende, lokale løyvehavere og norsk kundestøtte.'],
  ['02', 'TYDELIG', 'Biltype, prisestimat og turstatus vises før og under reisen.'],
  ['03', 'SMART', 'Skriv eller si destinasjonen. Teknologien hjelper deg videre uten å stå i veien.'],
  ['04', 'TRYGT', 'Lisensierte sjåfører, live sporing og samme system fra bestilling til fullført tur.'],
];

const vehicles = [
  { name: 'KJAPP', copy: 'Rask og enkel', image: '/assets/figma/standard.png' },
  { name: 'KJAPP XL', copy: 'Mer plass · opptil 7 seter', image: '/assets/figma/xl.png' },
  { name: 'Premium', copy: 'Premium komfort', image: '/assets/figma/premium.png' },
];

function VoiceDemo() {
  return (
    <section className="mk-voice mk-shell" aria-labelledby="voice-title">
      <div className="mk-voice-copy">
        <span className="mk-section-label">VOICE BOOKING</span>
        <h2 id="voice-title">Si hvor du skal.<br />KJAPP ordner resten.</h2>
        <p>Stemmen er en snarvei inn i bestillingen, ikke en egen chatbot. KJAPP finner destinasjonen og gjør turen klar, mens pris og hentetid alltid kommer fra selve KJAPP-systemet.</p>
        <div className="mk-trust-row"><span>Destinasjon</span><i /> <span>Bilvalg</span><i /> <span>Estimat</span><i /> <span>Bekreft</span></div>
      </div>
      <div className="mk-voice-card" aria-label="Eksempel på KJAPP voice booking">
        <div className="mk-voice-field"><span>Hvor vil du?</span><button type="button" aria-label="Mikrofon"><MicIcon /></button></div>
        <div className="mk-wave" aria-hidden="true">{Array.from({ length: 16 }).map((_, index) => <i key={index} />)}</div>
        <blockquote>«Kjør meg til Gardermoen.»</blockquote>
        <div className="mk-voice-result">
          <span className="mk-result-dot" />
          <div><small>DESTINASJON FUNNET</small><strong>Oslo lufthavn, Gardermoen</strong></div>
          <b>✓</b>
        </div>
        <div className="mk-system-note">KJAPP-systemet henter tilgjengelige biler, pris og hentetid før bestilling.</div>
      </div>
    </section>
  );
}

export default function PremiumHome() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main id="top" className="mk-page">
      <header className="mk-header mk-shell">
        <Wordmark />
        <nav className={menuOpen ? 'is-open' : ''} aria-label="Hovedmeny">
          <a href="#top" onClick={() => setMenuOpen(false)}>Kunder</a>
          <a href="#vehicles" onClick={() => setMenuOpen(false)}>Bilvalg</a>
          <a href="#voice" onClick={() => setMenuOpen(false)}>Voice</a>
          <Link to="/loyvehaver" onClick={() => setMenuOpen(false)}>Løyvehavere</Link>
          <a href={FLEET_URL} onClick={() => setMenuOpen(false)}>Fleet Panel</a>
          <a className="mk-pill mk-pill-primary" href="#download" onClick={() => setMenuOpen(false)}>Få KJAPP</a>
        </nav>
        <button className="mk-menu-button" type="button" aria-expanded={menuOpen} aria-label="Åpne hovedmeny" onClick={() => setMenuOpen((open) => !open)}>Meny</button>
      </header>

      <section className="mk-hero mk-shell">
        <div className="mk-hero-copy">
          <div className="mk-eyebrow">NORSK TAXI — PÅ DINE PREMISSER</div>
          <h1>NORSK TAXI,<br />UTEN OMVEIER.</h1>
          <p className="mk-hero-lead">Bestill med tekst eller stemme. Velg bilen som passer. Se estimatet før du bekrefter — og følg reisen live.</p>
          <div className="mk-hero-promise"><span className="mk-pulse" />Si hvor du skal. KJAPP ordner resten.</div>
          <div className="mk-actions">
            <a className="mk-pill mk-pill-primary" href="#download">Få KJAPP</a>
            <a className="mk-pill mk-pill-dark" href="#voice">Se voice booking</a>
            <Link className="mk-fleet-inline" to="/loyvehaver">For løyvehavere →</Link>
          </div>
          <div className="mk-location">Lisensierte sjåfører · Tydelig estimat · Live sporing · Norsk support</div>
        </div>
        <PhoneScene />
      </section>

      <section className="mk-journey mk-shell">
        <div className="mk-journey-copy">
          <span className="mk-section-label">SLIK FUNGERER KJAPP</span>
          <h2>Én reise.<br />Tre enkle steg.</h2>
          <div className="mk-step-list">
            {steps.map(([number, title, copy]) => <article className="mk-step" key={number}><span>{number}</span><div><h3>{title}</h3><p>{copy}</p></div></article>)}
          </div>
        </div>
        <aside className="mk-promise">
          <span>KJAPP GOLD</span>
          <h3>Mobilitet først.<br />Teknologien i bakgrunnen.</h3>
          <div />
          <p>Destinasjon først<br />Voice når du trenger det<br />Tydelig bilvalg<br />Pris og hentetid før bekreftelse</p>
        </aside>
      </section>

      <div id="voice"><VoiceDemo /></div>

      <section id="vehicles" className="mk-vehicles mk-shell" aria-labelledby="vehicles-title">
        <div className="mk-section-heading">
          <div><span className="mk-section-label">VELG DIN KJAPP</span><h2 id="vehicles-title">Tre måter å reise.</h2></div>
          <p>Samme tydelige bestilling. Ulik plass og komfort. Velg kategori etter reisen — ikke etter kompliserte produktnavn.</p>
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
          <div><span className="mk-section-label">HVORFOR KJAPP?</span><h2>Ikke større.<br />Bare smartere og nærmere.</h2></div>
          <p>KJAPP kombinerer lokale løyvehavere og lisensierte sjåfører med en moderne bestillingsopplevelse bygget for Norge. Teknologien skal gjøre turen enklere — ikke gjøre appen mer komplisert.</p>
        </div>
        <div className="mk-value-grid">
          {values.map(([number, title, copy]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}
        </div>
      </section>

      <section className="mk-partner mk-shell">
        <div className="mk-partner-copy">
          <span>BYGGET OGSÅ FOR DE SOM KJØRER</span>
          <h2>Din virksomhet.<br />Moderne verktøy rundt turene.</h2>
          <p>KJAPP gir sjåfører og løyvehavere et samlet økosystem for turer, aktivitet, dokumentasjon og oppgjør — uten at partnerbudskapet tar over kundeopplevelsen.</p>
          <div className="mk-actions"><Link className="mk-pill mk-pill-primary" to="/loyvehaver">For løyvehavere</Link><a className="mk-pill mk-pill-dark" href={FLEET_URL}>Åpne Fleet Panel</a></div>
        </div>
        <div className="mk-partner-system" aria-label="KJAPP partnerverktøy">
          <span>FLEET PANEL</span>
          <strong>Sjåfører</strong><strong>Turer</strong><strong>Dokumenter</strong><strong>Oppgjør</strong>
          <small>Partnerøkonomi og serviceavgift forklares på løyvehaversiden.</small>
        </div>
      </section>

      <section id="download" className="mk-download mk-shell">
        <span className="mk-section-label">KJAPP BETA</span>
        <h2>Klar når du er.</h2>
        <p>Vi gjør distribusjonen like ryddig som produktet. Ingen falske butikk-knapper: ekte lenker vises først når de er aktive.</p>
        <div className="mk-actions">
          {ANDROID_BETA_URL ? <a className="mk-pill mk-pill-primary" href={ANDROID_BETA_URL} rel="noreferrer">Last ned Android beta</a> : <span className="mk-pill mk-pill-disabled" aria-disabled="true">Android beta · klargjøres</span>}
          {IOS_TESTFLIGHT_URL ? <a className="mk-pill mk-pill-dark" href={IOS_TESTFLIGHT_URL} rel="noreferrer">Åpne i TestFlight</a> : <span className="mk-pill mk-pill-disabled" aria-disabled="true">iPhone · kommer snart</span>}
        </div>
        <a className="mk-download-contact" href={`mailto:${EMAILS.hello}?subject=KJAPP%20beta`}>Vil du teste? Kontakt KJAPP →</a>
      </section>

      <footer className="mk-footer mk-shell">
        <div className="mk-footer-brand"><Wordmark /><p>Norsk taxi. Uten omveier.</p></div>
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
    </main>
  );
}
