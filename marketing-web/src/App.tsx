import { useEffect, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { ApplyPage } from './ApplyPage';
import PremiumHome from './PremiumHome';

const FLEET_URL = 'https://fleet.kjappapp.no';
const EMAILS = {
  hello: 'hei@kjappapp.no',
  support: 'support@kjappapp.no',
  driver: 'driver@kjappapp.no',
  fleet: 'fleet@kjappapp.no',
  partner: 'partner@kjappapp.no',
  privacy: 'privacy@kjappapp.no',
};

function PartnerWordmark() {
  return <Link className="mk-wordmark" to="/" aria-label="KJAPP forside"><span>KJ</span><em>A</em><span>PP</span></Link>;
}

function PartnerHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="mk-header mk-shell">
      <PartnerWordmark />
      <nav className={menuOpen ? 'is-open' : ''} aria-label="Hovedmeny">
        <Link to="/" onClick={() => setMenuOpen(false)}>Kunder</Link>
        <a href={`mailto:${EMAILS.driver}`} onClick={() => setMenuOpen(false)}>Sjåfører</a>
        <Link to="/loyvehaver" onClick={() => setMenuOpen(false)}>Løyvehavere</Link>
        <a href={FLEET_URL} onClick={() => setMenuOpen(false)}>Fleet Panel</a>
        <a href={`mailto:${EMAILS.support}`} onClick={() => setMenuOpen(false)}>Hjelp</a>
        <Link className="mk-pill mk-pill-gold" to="/loyvehaver/soknad" onClick={() => setMenuOpen(false)}>Bli partner</Link>
      </nav>
      <button className="mk-menu-button" type="button" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>Meny</button>
    </header>
  );
}

function PartnerDashboardPreview() {
  const tileStyle = {
    border: '1px solid #24344a',
    borderRadius: 12,
    background: '#0b1522',
    padding: '14px 14px 13px',
    minHeight: 76,
  } as const;

  return (
    <div
      aria-label="Forhåndsvisning av KJAPP Fleet Panel"
      style={{
        width: '100%',
        maxWidth: 390,
        minHeight: 510,
        justifySelf: 'center',
        border: '1px solid #26364b',
        borderRadius: 26,
        background: 'linear-gradient(160deg,#08111b,#0d1927)',
        boxShadow: '0 28px 90px rgba(0,0,0,.34)',
        padding: 24,
      }}
    >
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 18, borderBottom: '1px solid #1f3044'}}>
        <div>
          <div style={{color: '#11d9e8', fontSize: 10, fontWeight: 900, letterSpacing: '.08em'}}>KJAPP FLEET</div>
          <div style={{fontSize: 21, fontWeight: 900, marginTop: 6}}>Din flåte. Din kontroll.</div>
        </div>
        <span style={{fontSize: 10, color: '#7f91a8'}}>LIVE</span>
      </div>

      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 18}}>
        <div style={tileStyle}><span style={{color: '#7f91a8', fontSize: 9}}>SJÅFØRER</span><strong style={{display: 'block', marginTop: 13, fontSize: 15}}>Status og tilgang</strong></div>
        <div style={tileStyle}><span style={{color: '#7f91a8', fontSize: 9}}>TURER</span><strong style={{display: 'block', marginTop: 13, fontSize: 15}}>Live og historikk</strong></div>
        <div style={tileStyle}><span style={{color: '#7f91a8', fontSize: 9}}>ØKONOMI</span><strong style={{display: 'block', marginTop: 13, fontSize: 15}}>Oppgjør samlet</strong></div>
        <div style={tileStyle}><span style={{color: '#7f91a8', fontSize: 9}}>DOKUMENTER</span><strong style={{display: 'block', marginTop: 13, fontSize: 15}}>Godkjenning</strong></div>
      </div>

      <div style={{marginTop: 14, minHeight: 175, border: '1px solid #24344a', borderRadius: 14, background: 'linear-gradient(135deg,#07121e,#0b1a28)', padding: 18, position: 'relative', overflow: 'hidden'}}>
        <div style={{color: '#11d9e8', fontSize: 10, fontWeight: 800}}>LIVE FLÅTE</div>
        <div style={{position: 'absolute', inset: '50px 18px 18px', opacity: .7, backgroundImage: 'linear-gradient(26deg,transparent 48%,#1d354b 49%,#1d354b 51%,transparent 52%),linear-gradient(144deg,transparent 48%,#172c3e 49%,#172c3e 51%,transparent 52%)', backgroundSize: '64px 54px'}} />
        <span style={{position: 'absolute', left: '27%', top: '53%', width: 12, height: 12, borderRadius: '50%', background: '#11d9e8', boxShadow: '0 0 0 6px rgba(17,217,232,.12)'}} />
        <span style={{position: 'absolute', right: '27%', top: '38%', width: 9, height: 9, borderRadius: '50%', background: '#34d399'}} />
        <div style={{position: 'absolute', left: 18, right: 18, bottom: 16, color: '#7f91a8', fontSize: 10}}>Reelle flåtedata vises etter innlogging.</div>
      </div>
    </div>
  );
}

const onboardingSteps = [
  ['01', 'Send søknad', 'Firma, kontaktinformasjon, løyver og kjøretøy.'],
  ['02', 'Dokumentasjon', 'Løyvebevis, vognkort, forsikring og bankinformasjon.'],
  ['03', 'KJAPP kontrollerer', 'Søknaden og dokumentasjonen gjennomgås før aktivering.'],
  ['04', 'Fleet åpnes', 'Godkjente partnere får tilgang til fleet.kjappapp.no.'],
];

const partnerValues = [
  ['01', '14 % SERVICEAVGIFT', 'En tydelig modell. 86 % av turinntekten beholdes hos sjåfør/løyvehaver før øvrige egne kostnader.'],
  ['02', 'UKENTLIG OPPGJØR', 'Digitale betalinger kan avregnes automatisk hver uke. Kontantturer registreres separat.'],
  ['03', 'FULL OVERSIKT', 'Sjåfører, turer, økonomi og dokumentstatus samlet i Fleet Panel.'],
  ['04', 'NORSK OPPFØLGING', 'Direkte kontakt når konto, dokumentasjon eller oppgjør må avklares.'],
];

function PartnerPage() {
  useEffect(() => {
    document.title = 'KJAPP for løyvehavere — 14 % serviceavgift';
    const meta = document.querySelector('meta[name="description"]');
    meta?.setAttribute('content', 'Bli KJAPP-partner. 14 % serviceavgift, Fleet Panel for sjåfører og turer, og ukentlig oppgjør for digitale betalinger.');
  }, []);

  return (
    <main id="top" className="mk-page">
      <PartnerHeader />

      <section className="mk-hero mk-shell">
        <div className="mk-hero-copy">
          <div className="mk-eyebrow">FOR LØYVEHAVERE</div>
          <h1>DIN FLÅTE.<br />DIN KONTROLL.</h1>
          <p>KJAPP gir løyvehavere et moderne system for sjåfører, turer, økonomi og dokumentasjon — uten å ta virksomheten fra deg.</p>
          <div className="mk-actions">
            <Link className="mk-pill mk-pill-gold" to="/loyvehaver/soknad">Søk om å bli partner</Link>
            <a className="mk-pill mk-pill-dark" href={FLEET_URL}>Åpne Fleet Panel</a>
          </div>
          <div className="mk-location">14 % serviceavgift · 86 % beholdes · Fleet Panel · Norsk oppfølging</div>
        </div>
        <PartnerDashboardPreview />
      </section>

      <section className="mk-partner mk-shell">
        <div className="mk-partner-copy">
          <span>KJAPP PARTNER</span>
          <h2>Jobb mindre.<br />Behold mer.</h2>
          <p>En enkel serviceavgift og ett kontrollpanel. Ved digitale betalinger legges det opp til automatisk ukentlig avregning. Kontantturer kan registreres og avstemmes separat.</p>
          <div className="mk-actions">
            <Link className="mk-pill mk-pill-gold" to="/loyvehaver/soknad">Bli KJAPP-partner</Link>
            <a className="mk-pill mk-pill-dark" href={`mailto:${EMAILS.partner}`}>Snakk med KJAPP</a>
          </div>
        </div>
        <div className="mk-commission"><strong>14%</strong><p>serviceavgift<br />86% beholdes</p><div /><span>TYDELIG · ENKELT · UKENTLIG OPPGJØR</span></div>
      </section>

      <section className="mk-journey mk-shell">
        <div className="mk-journey-copy">
          <div className="mk-eyebrow">SLIK BLIR DU PARTNER</div>
          <h2 style={{marginTop: 26}}>Én kontrollert<br />vei inn.</h2>
          <div className="mk-step-list">
            {onboardingSteps.map(([number, title, copy]) => (
              <article className="mk-step" key={number}><span>{number}</span><div><h3>{title}</h3><p>{copy}</p></div></article>
            ))}
          </div>
        </div>
        <aside className="mk-promise">
          <span>FLEET PANEL</span>
          <h3>Alt du trenger.<br />Samlet på ett sted.</h3><div />
          <p>Sjåfører og status<br />Turer og historikk<br />Økonomi og oppgjør<br />Dokumenter og godkjenning</p>
          <a className="mk-pill mk-pill-gold" href={FLEET_URL} style={{marginTop: 18}}>Logg inn Fleet</a>
        </aside>
      </section>

      <section className="mk-why mk-shell">
        <div className="mk-why-intro">
          <div><span>BYGGET FOR LØYVEHAVEREN</span><h2>Mindre administrasjon.<br />Mer kontroll.</h2></div>
          <p>KJAPP skal gjøre det enklere å drive en moderne taxiflåte. Partneren beholder løyvet, sjåførene og virksomheten — KJAPP leverer teknologien rundt turene.</p>
        </div>
        <div className="mk-value-grid">
          {partnerValues.map(([number, title, copy]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}
        </div>
      </section>

      <section className="mk-download mk-shell">
        <div className="mk-eyebrow">KLAR FOR NESTE STEG?</div>
        <h2 style={{marginTop: 24}}>Bli KJAPP-partner.</h2>
        <p>Søknaden gir ikke automatisk tilgang. Fleet-konto aktiveres etter at KJAPP har kontrollert og godkjent dokumentasjonen.</p>
        <div className="mk-actions">
          <Link className="mk-pill mk-pill-gold" to="/loyvehaver/soknad">Start søknaden</Link>
          <a className="mk-pill mk-pill-dark" href={FLEET_URL}>Allerede godkjent? Logg inn</a>
        </div>
      </section>

      <footer className="mk-footer mk-shell">
        <div className="mk-footer-brand"><PartnerWordmark /><p>Norsk taxi. Uten omveier.</p></div>
        <nav aria-label="Bunnmeny">
          <Link to="/">Kunder</Link>
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

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PremiumHome />} />
      <Route path="/loyvehaver" element={<PartnerPage />} />
      <Route path="/loyvehaver/soknad" element={<ApplyPage />} />
      <Route path="*" element={<PremiumHome />} />
    </Routes>
  );
}
