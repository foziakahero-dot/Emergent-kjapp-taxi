import { useState } from 'react';
import { Link } from 'react-router-dom';
import './premium-home.css';

const FLEET_URL = 'https://fleet.kjappapp.no';

function Wordmark() {
  return <a className="mk-wordmark" href="#top" aria-label="KJAPP forside"><span>KJ</span><em>A</em><span>PP</span></a>;
}

function PhoneScene() {
  return (
    <div className="mk-phone" aria-label="Forhåndsvisning av KJAPP-appen">
      <div className="mk-phone-screen">
        <div className="mk-phone-island" />
        <div className="mk-map-lines" aria-hidden="true">
          <i /><i /><i /><i /><i /><i /><i />
          <b className="pin pin-one" /><b className="pin pin-two" /><b className="pin pin-three" />
        </div>
        <div className="mk-booking-card">
          <span>God kveld</span><strong>Hvor vil du?</strong>
          <div className="mk-destination">Søk etter destinasjon</div>
          <button type="button">Bestill</button>
        </div>
      </div>
      <span className="mk-phone-index" aria-hidden="true">01</span>
    </div>
  );
}

const steps = [
  ['01', 'Velg hvor du skal', 'Søk etter adresse eller bruk et lagret sted.'],
  ['02', 'Se bilen og prisen', 'Velg kategori med tydelig estimat før du bestiller.'],
  ['03', 'Følg turen', 'Se sjåføren på kartet frem til hentested og destinasjon.'],
];

const values = [
  ['01', 'LOKALT', 'Turer utføres av godkjente løyvehavere og sjåfører.'],
  ['02', 'TYDELIG', 'Pris og biltype vises før bestilling.'],
  ['03', 'TRYGT', 'Sjåfør, bil og turstatus følger samme system.'],
  ['04', 'NORSK', 'Support og partneroppfølging i Norge.'],
];

export default function PremiumHome() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <main id="top" className="mk-page">
      <header className="mk-header mk-shell">
        <Wordmark />
        <nav className={menuOpen ? 'is-open' : ''} aria-label="Hovedmeny">
          <a href="#top" onClick={() => setMenuOpen(false)}>Kunder</a>
          <Link to="/loyvehaver" onClick={() => setMenuOpen(false)}>Løyvehavere</Link>
          <a href="mailto:support@kjappapp.no" onClick={() => setMenuOpen(false)}>Hjelp</a>
          <a className="mk-pill mk-pill-gold" href="#download" onClick={() => setMenuOpen(false)}>Last ned KJAPP</a>
        </nav>
        <button className="mk-menu-button" type="button" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>Meny</button>
      </header>

      <section className="mk-hero mk-shell">
        <div className="mk-hero-copy">
          <h1>NORSK TAXI,<br />UTEN OMVEIER.</h1>
          <p>Bestill taxi på sekunder. Lokale løyvehavere, tydelig pris og en roligere måte å komme frem på.</p>
          <div className="mk-actions">
            <a className="mk-pill mk-pill-gold" href="#download">Last ned KJAPP</a>
            <Link className="mk-pill mk-pill-dark" to="/loyvehaver">Er du løyvehaver?</Link>
          </div>
          <Link className="mk-mobile-partner" to="/loyvehaver">Er du løyvehaver? →</Link>
          <div className="mk-location">OSLO · NORGE</div>
        </div>
        <PhoneScene />
      </section>

      <section className="mk-journey mk-shell">
        <div className="mk-journey-copy">
          <h2>Én reise.<br />Tre enkle steg.</h2>
          <div className="mk-step-list">
            {steps.map(([number, title, copy]) => <article className="mk-step" key={number}><span>{number}</span><div><h3>{title}</h3><p>{copy}</p></div></article>)}
          </div>
        </div>
        <aside className="mk-promise">
          <span>KJAPP</span><h3>Tydelig. Lokalt.<br />Bygget for Norge.</h3><div />
          <p>Verifiserte sjåfører<br />Lokale løyvehavere<br />Norsk kundestøtte<br />Tydelig pris</p>
        </aside>
      </section>

      <section className="mk-why mk-shell">
        <div className="mk-why-intro">
          <div><span>Hvorfor KJAPP?</span><h2>Ikke større.<br />Bare nærmere.</h2></div>
          <p>KJAPP er laget for et norsk marked: lokale løyvehavere, forståelige priser og direkte kontakt når noe faktisk må løses.</p>
        </div>
        <div className="mk-value-grid">
          {values.map(([number, title, copy]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}
        </div>
      </section>

      <section className="mk-partner mk-shell">
        <div className="mk-partner-copy">
          <span>FOR LØYVEHAVERE</span><h2>Ditt løyve.<br />Din virksomhet.</h2>
          <p>KJAPP gir deg en moderne kanal for turer og et enkelt kontrollpanel for sjåfører, aktivitet og oppgjør.</p>
          <div className="mk-actions"><Link className="mk-pill mk-pill-gold" to="/loyvehaver/soknad">Bli KJAPP-partner</Link><a className="mk-pill mk-pill-dark" href={FLEET_URL}>Logg inn</a></div>
        </div>
        <div className="mk-commission"><strong>12%</strong><p>eksempel på enkel<br />plattformprovisjon</p><div /><span>SJÅFØRER · TURER · OPPGJØR</span></div>
      </section>

      <section id="download" className="mk-download mk-shell">
        <h2>Klar når du er.</h2><p>Last ned KJAPP og bestill din neste tur.</p>
        <div className="mk-actions"><a className="mk-pill mk-pill-gold" href="mailto:hei@kjappapp.no?subject=KJAPP%20for%20iPhone">App Store</a><a className="mk-pill mk-pill-dark" href="mailto:hei@kjappapp.no?subject=KJAPP%20for%20Android">Google Play</a></div>
      </section>

      <footer className="mk-footer mk-shell">
        <Wordmark />
        <nav aria-label="Bunnmeny"><a href="#top">Kunder</a><Link to="/loyvehaver">Løyvehavere</Link><a href="mailto:hei@kjappapp.no">Sjåfører</a><a href="mailto:support@kjappapp.no">Hjelp</a><a href="mailto:personvern@kjappapp.no">Personvern</a><a href="mailto:hei@kjappapp.no?subject=Vilkår">Vilkår</a></nav>
        <span>© 2026 KJAPP</span>
      </footer>
    </main>
  );
}
