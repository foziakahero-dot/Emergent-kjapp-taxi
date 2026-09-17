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
    border: '1px solid #20313d',
    borderRadius: 12,
    background: '#0d1721',
    padding: '14px 14px 13px',
    minHeight: 76,
  } as const;

  return (
    <div
      aria-label="Forhåndsvisning av KJAPP Fleet produktgrensesnitt"
      style={{
        width: '100%',
        maxWidth: 430,
        minHeight: 510,
        justifySelf: 'center',
        border: '1px solid #20313d',
        borderRadius: 24,
        background: '#091119',
        boxShadow: '0 28px 90px rgba(0,0,0,.28)',
        overflow: 'hidden',
      }}
    >
      <div style={{display: 'grid', gridTemplateColumns: '112px 1fr', minHeight: 510}}>
        <aside style={{padding: '22px 14px', background: '#071019', borderRight: '1px solid #172733'}}>
          <div style={{fontSize: 16, fontWeight: 900, letterSpacing: '.05em'}}>KJ<span style={{color: '#00e5f5'}}>A</span>PP</div>
          <div style={{fontSize: 8, color: '#00e5f5', letterSpacing: '.18em', marginTop: 7}}>FLEET</div>
          <div style={{height: 1, background: '#172733', margin: '18px 0'}} />
          {['Oversikt', 'Sjåfører', 'Turer', 'Økonomi', 'Bedrift'].map((item, index) => (
            <div key={item} style={{fontSize: 9, color: index === 0 ? '#f8fafc' : '#718398', padding: '8px 7px', marginBottom: 4, borderRadius: 7, background: index === 0 ? 'rgba(0,229,245,.07)' : 'transparent', borderLeft: index === 0 ? '2px solid #00e5f5' : '2px solid transparent'}}>{item}</div>
          ))}
        </aside>
        <div style={{padding: 20}}>
          <div style={{color: '#91a3b8', fontSize: 9, fontWeight: 800, letterSpacing: '.12em'}}>FLEET OVERVIEW</div>
          <div style={{fontSize: 21, fontWeight: 800, marginTop: 7}}>Driften samlet.</div>
          <div style={{fontSize: 10, color: '#718398', marginTop: 6}}>Ekte virksomhetsdata etter innlogging.</div>

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 18}}>
            <div style={tileStyle}><span style={{color: '#91a3b8', fontSize: 8}}>SJÅFØRER</span><strong style={{display: 'block', marginTop: 12, fontSize: 13}}>Status og tilgang</strong></div>
            <div style={tileStyle}><span style={{color: '#91a3b8', fontSize: 8}}>KJØRETØY</span><strong style={{display: 'block', marginTop: 12, fontSize: 13}}>Flåte og dokumenter</strong></div>
            <div style={tileStyle}><span style={{color: '#91a3b8', fontSize: 8}}>TURER</span><strong style={{display: 'block', marginTop: 12, fontSize: 13}}>Aktivitet og historikk</strong></div>
            <div style={tileStyle}><span style={{color: '#91a3b8', fontSize: 8}}>ØKONOMI</span><strong style={{display: 'block', marginTop: 12, fontSize: 13}}>Oppgjør samlet</strong></div>
          </div>

          <div style={{marginTop: 12, border: '1px solid #20313d', borderRadius: 12, background: '#0d1721', padding: 14}}>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
              <span style={{fontSize: 8, color: '#00e5f5', fontWeight: 800, letterSpacing: '.1em'}}>OPERASJON</span>
              <span style={{fontSize: 8, color: '#718398'}}>SANNTID NÅR DATA FINNES</span>
            </div>
            <div style={{height: 1, background: '#172733', margin: '12px 0'}} />
            <div style={{display: 'grid', gap: 8}}>
              {['Aktive sjåfører og posisjoner', 'Turer og statusendringer', 'Dokument- og godkjenningsstatus'].map((item) => (
                <div key={item} style={{display: 'flex', alignItems: 'center', gap: 9, color: '#a7b6c7', fontSize: 9}}><span style={{width: 6, height: 6, borderRadius: 99, background: '#39e58c'}} />{item}</div>
              ))}
            </div>
          </div>
        </div>
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
    document.title = 'KJAPP Fleet for løyvehavere';
    const meta = document.querySelector('meta[name="description"]');
    meta?.setAttribute('content', 'KJAPP Fleet samler sjåfører, kjøretøy, dokumenter, turer og oppgjør for løyvehavere i ett system.');
  }, []);

  return (
    <main id="top" className="mk-page">
      <PartnerHeader />

      <section className="mk-hero mk-shell">
        <div className="mk-hero-copy">
          <div className="mk-eyebrow">FOR LØYVEHAVERE</div>
          <h1>DIN FLÅTE.<br />ETT SYSTEM.</h1>
          <p>Administrer sjåfører, kjøretøy, dokumenter, turer og oppgjør fra KJAPP Fleet.</p>
          <div className="mk-actions">
            <Link className="mk-pill mk-pill-gold" to="/loyvehaver/soknad">Bli KJAPP-partner</Link>
            <a className="mk-pill mk-pill-dark" href={FLEET_URL}>Åpne Fleet</a>
          </div>
          <div className="mk-location">Sjåfører · Kjøretøy · Turer · Økonomi · Dokumenter</div>
        </div>
        <PartnerDashboardPreview />
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
          <p>Sjåfører og status<br />Kjøretøy og dokumenter<br />Turer og historikk<br />Økonomi og oppgjør</p>
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

      <section className="mk-partner mk-shell">
        <div className="mk-partner-copy">
          <span>PARTNERMODELL</span>
          <h2>Tydelig modell.<br />Samlet drift.</h2>
          <p>Serviceavgiften er kommersiell partnerinformasjon. I Fleet ser løyvehaveren de faktiske turene, oppgjørene og økonomiske linjene som gjelder virksomheten.</p>
          <div className="mk-actions">
            <Link className="mk-pill mk-pill-gold" to="/loyvehaver/soknad">Bli KJAPP-partner</Link>
            <a className="mk-pill mk-pill-dark" href={`mailto:${EMAILS.partner}`}>Snakk med KJAPP</a>
          </div>
        </div>
        <div className="mk-commission"><strong>14%</strong><p>serviceavgift<br />86% beholdes</p><div /><span>PARTNERMODELL · UKENTLIG OPPGJØR</span></div>
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
