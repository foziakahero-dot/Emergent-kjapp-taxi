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

function Wordmark() {
  return <a className="mk-wordmark" href="#top" aria-label="KJAPP forside"><span>KJ</span><em>A</em><span>PP</span></a>;
}

function PhoneScene() {
  return (
    <div className="mk-phone" aria-label="Animert forhåndsvisning av en KJAPP-bil på vei til hentested i Oslo">
      <div className="mk-phone-screen">
        <div className="mk-phone-island" />
        <div className="mk-phone-topline">
          <span className="mk-live-dot" />
          <div><strong>Sjåføren er på vei</strong><small>Henting i Oslo sentrum</small></div>
          <b>2 min</b>
        </div>

        <div className="mk-map-oslo" aria-hidden="true">
          <svg className="mk-route-svg" viewBox="0 0 320 390" role="presentation">
            <path className="mk-route-shadow" d="M54 304 C78 260 105 244 130 225 C160 202 186 184 207 151 C226 122 240 93 268 64" />
            <path className="mk-route-path" d="M54 304 C78 260 105 244 130 225 C160 202 186 184 207 151 C226 122 240 93 268 64" />
          </svg>
          <span className="mk-pickup-marker"><i />HENT</span>
          <span className="mk-car-marker" aria-hidden="true">
            <svg viewBox="0 0 40 40" width="25" height="25" role="presentation">
              <rect x="11" y="6" width="18" height="28" rx="7" fill="#f7f9fb" />
              <rect x="14" y="10" width="12" height="7" rx="3" fill="#11d9e8" />
              <rect x="14" y="20" width="12" height="8" rx="3" fill="#0b1722" />
              <rect x="8" y="12" width="4" height="7" rx="2" fill="#11d9e8" />
              <rect x="28" y="12" width="4" height="7" rx="2" fill="#11d9e8" />
              <rect x="8" y="23" width="4" height="7" rx="2" fill="#11d9e8" />
              <rect x="28" y="23" width="4" height="7" rx="2" fill="#11d9e8" />
              <circle cx="15" cy="32" r="1.5" fill="#11d9e8" />
              <circle cx="25" cy="32" r="1.5" fill="#11d9e8" />
            </svg>
          </span>
        </div>

        <div className="mk-trip-status">
          <div className="mk-trip-head"><span>KJAPP</span><strong>På vei til deg</strong></div>
          <div className="mk-trip-route"><i /><div><b>Hentested</b><span>Karl Johans gate · Oslo</span></div></div>
          <div className="mk-trip-meta"><span>Lisensiert sjåfør</span><span>Live sporing</span><span>Ca. 2 min</span></div>
          <button type="button">FØLG BILEN LIVE</button>
        </div>
      </div>
      <span className="mk-phone-index" aria-hidden="true">01</span>
    </div>
  );
}

const steps = [
  ['01', 'Velg hvor du skal', 'Søk etter adresse eller bruk et lagret sted.'],
  ['02', 'Se bilen og prisen', 'Velg kategori med tydelig estimat før du bestiller.'],
  ['03', 'Følg bilen live', 'Se bilen bevege seg på kartet helt frem til hentestedet.'],
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
          <a href={`mailto:${EMAILS.driver}`} onClick={() => setMenuOpen(false)}>Sjåfører</a>
          <Link to="/loyvehaver" onClick={() => setMenuOpen(false)}>Løyvehavere</Link>
          <a href={FLEET_URL} onClick={() => setMenuOpen(false)}>Fleet Panel</a>
          <a href={`mailto:${EMAILS.support}`} onClick={() => setMenuOpen(false)}>Hjelp</a>
          <a className="mk-pill mk-pill-gold" href="#download" onClick={() => setMenuOpen(false)}>Last ned KJAPP</a>
        </nav>
        <button className="mk-menu-button" type="button" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>Meny</button>
      </header>

      <section className="mk-hero mk-shell">
        <div className="mk-hero-copy">
          <div className="mk-eyebrow">NORSK TAXI — PÅ DINE PREMISSER</div>
          <h1>NORSK TAXI,<br />UTEN OMVEIER.</h1>
          <p>Bestill på sekunder. Følg bilen live. Reis med lokale, lisensierte sjåfører.</p>
          <div className="mk-actions">
            <a className="mk-pill mk-pill-gold" href="#download">Last ned KJAPP</a>
            <a className="mk-pill mk-pill-dark" href={`mailto:${EMAILS.driver}`}>Bli sjåfør</a>
            <a className="mk-fleet-inline" href={FLEET_URL}>For løyvehavere →</a>
          </div>
          <Link className="mk-mobile-partner" to="/loyvehaver">For løyvehavere →</Link>
          <div className="mk-location">Lisensierte sjåfører · Live sporing · Tydelig pris · Norsk support</div>
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
          <span>FOR SJÅFØRER OG LØYVEHAVERE</span><h2>Jobb mindre.<br />Behold mer.</h2>
          <p>KJAPP gir sjåføren en lavere serviceavgift og løyvehaveren et moderne kontrollpanel for sjåfører, aktivitet og oppgjør.</p>
          <div className="mk-actions"><Link className="mk-pill mk-pill-gold" to="/loyvehaver/soknad">Bli KJAPP-partner</Link><a className="mk-pill mk-pill-dark" href={FLEET_URL}>Åpne Fleet Panel</a></div>
        </div>
        <div className="mk-commission"><strong>14%</strong><p>serviceavgift<br />86% beholdes</p><div /><span>SJÅFØRER · TURER · OPPGJØR</span></div>
      </section>

      <section id="download" className="mk-download mk-shell">
        <h2>Klar når du er.</h2><p>Last ned KJAPP og bestill din neste tur.</p>
        <div className="mk-actions"><a className="mk-pill mk-pill-gold" href={`mailto:${EMAILS.hello}?subject=KJAPP%20for%20iPhone`}>App Store</a><a className="mk-pill mk-pill-dark" href={`mailto:${EMAILS.hello}?subject=KJAPP%20for%20Android`}>Google Play</a></div>
      </section>

      <footer className="mk-footer mk-shell">
        <div className="mk-footer-brand"><Wordmark /><p>Norsk taxi. Uten omveier.</p></div>
        <nav aria-label="Bunnmeny">
          <a href="#top">Kunder</a>
          <a href={`mailto:${EMAILS.driver}`}>Sjåfør</a>
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
