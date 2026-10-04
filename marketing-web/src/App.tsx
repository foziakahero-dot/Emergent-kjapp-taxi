import { useEffect, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { ApplyPage } from './ApplyPage';
import PremiumHome from './PremiumHome';
import { TripSharePage } from './TripSharePage';

const FLEET_URL = 'https://fleet.kjappapp.no';
const EMAILS = {
  support: 'support@kjappapp.no',
  driver: 'driver@kjappapp.no',
  partner: 'partner@kjappapp.no',
  privacy: 'privacy@kjappapp.no',
};

function SnarLinkBrand() {
  return (
    <Link className="snar-brand" to="/" aria-label="SNAR forside">
      <span className="snar-mark" aria-hidden="true"><i /><b /></span>
      <strong>SNAR</strong>
    </Link>
  );
}

function PartnerHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="snar-header">
      <SnarLinkBrand />
      <nav className={menuOpen ? 'is-open' : ''} aria-label="Hovedmeny">
        <Link to="/" onClick={() => setMenuOpen(false)}>Kunder</Link>
        <a href={`mailto:${EMAILS.driver}`} onClick={() => setMenuOpen(false)}>Sjåfører</a>
        <Link to="/loyvehaver" onClick={() => setMenuOpen(false)}>Løyvehavere</Link>
        <Link to="/help" onClick={() => setMenuOpen(false)}>Hjelp</Link>
      </nav>
      <div className="snar-header-actions">
        <a className="snar-btn snar-btn-secondary" href={FLEET_URL}>Logg inn Fleet</a>
        <Link className="snar-btn snar-btn-primary" to="/loyvehaver/soknad">Bli partner</Link>
      </div>
      <button className="snar-menu" type="button" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>Meny</button>
    </header>
  );
}

function PartnerDashboardPreview() {
  return (
    <div className="snar-partner-dashboard" aria-label="Forhåndsvisning av SNAR Fleet Panel">
      <div className="snar-partner-dashboard-head">
        <span><span className="snar-mark" aria-hidden="true"><i /><b /></span><strong>SNAR Fleet</strong></span>
        <small>PARTNERPANEL</small>
      </div>
      <div className="snar-partner-dashboard-grid">
        <article><small>SJÅFØRER</small><strong>Status og tilgang</strong><span>Se hvem som er aktive og godkjent.</span></article>
        <article><small>TURER</small><strong>Live og historikk</strong><span>Følg aktivitet og tidligere turer.</span></article>
        <article><small>DOKUMENTER</small><strong>Kontroll samlet</strong><span>Hold oversikt over krav og gyldighet.</span></article>
        <article><small>OPPGJØR</small><strong>Ukentlig oversikt</strong><span>Samlet grunnlag for digitale oppgjør.</span></article>
      </div>
      <div className="snar-partner-dashboard-note">Reelle flåtedata vises først etter innlogging.</div>
    </div>
  );
}

const onboardingSteps = [
  ['01', 'Send søknad', 'Firma, kontaktinformasjon, løyver og kjøretøy.'],
  ['02', 'Dokumentasjon', 'Løyvebevis, vognkort, forsikring og bankinformasjon.'],
  ['03', 'SNAR kontrollerer', 'Søknaden og dokumentasjonen gjennomgås før aktivering.'],
  ['04', 'Fleet åpnes', 'Godkjente partnere får tilgang til fleet.kjappapp.no.'],
];

const partnerValues = [
  ['10 %', 'SERVICEAVGIFT', 'En tydelig modell for beta. 90 % av turinntekten beholdes hos sjåfør/løyvehaver før øvrige egne kostnader.'],
  ['7 DAG', 'UKENTLIG OPPGJØR', 'Digitale betalinger kan avregnes automatisk hver uke.'],
  ['ÉN', 'SAMLET OVERSIKT', 'Sjåfører, turer, kjøretøy, økonomi og dokumentstatus i Fleet Panel.'],
  ['NO', 'NORSK OPPFØLGING', 'Direkte kontakt når konto, dokumentasjon eller oppgjør må avklares.'],
];

function PartnerPage() {
  useEffect(() => {
    document.title = 'SNAR for løyvehavere — Fleet Panel og norsk oppfølging';
    const meta = document.querySelector('meta[name="description"]');
    meta?.setAttribute('content', 'Bli SNAR-partner. Fleet Panel samler sjåfører, kjøretøy, turer, dokumentasjon og oppgjør for norske løyvehavere.');
  }, []);

  return (
    <main id="top" className="snar-page snar-partner-page">
      <PartnerHeader />

      <section className="snar-partner-hero snar-shell">
        <div>
          <span className="snar-kicker">FOR LØYVEHAVERE</span>
          <h1>Din flåte.<br />Din kontroll.</h1>
          <p>SNAR gir løyvehavere et moderne system for sjåfører, turer, kjøretøy, dokumentasjon og oppgjør — uten å ta virksomheten fra deg.</p>
          <div className="snar-actions">
            <Link className="snar-btn snar-btn-primary" to="/loyvehaver/soknad">Søk om å bli partner</Link>
            <a className="snar-btn snar-btn-secondary" href={FLEET_URL}>Åpne Fleet Panel</a>
          </div>
          <small>10 % serviceavgift i beta · Ukentlig digitalt oppgjør · Norsk oppfølging</small>
        </div>
        <PartnerDashboardPreview />
      </section>

      <section className="snar-partner-values snar-shell">
        <div className="snar-section-copy">
          <span className="snar-kicker">PARTNERMODELL</span>
          <h2>Mindre administrasjon.<br />Mer kontroll.</h2>
          <p>SNAR skal gjøre det enklere å drive en moderne taxiflåte. Partneren beholder løyvet, sjåførene og virksomheten. SNAR leverer teknologien rundt turene.</p>
        </div>
        <div className="snar-partner-value-grid">
          {partnerValues.map(([metric, title, copy]) => (
            <article key={title}>
              <strong>{metric}</strong>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="snar-partner-onboarding">
        <div className="snar-shell">
          <div className="snar-section-copy row">
            <div><span className="snar-kicker">SLIK BLIR DU PARTNER</span><h2>Én kontrollert vei inn.</h2></div>
            <p>Tilgang til Fleet åpnes først etter at firma og dokumentasjon er kontrollert. Det gir en ryddig onboarding for både SNAR og løyvehaveren.</p>
          </div>
          <div className="snar-onboarding-grid">
            {onboardingSteps.map(([number, title, copy]) => (
              <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>
            ))}
          </div>
        </div>
      </section>

      <section className="snar-partner-cta snar-shell">
        <div>
          <span className="snar-kicker">KLAR FOR NESTE STEG?</span>
          <h2>Bli SNAR-partner.</h2>
          <p>Søknaden gir ikke automatisk tilgang. Fleet-konto aktiveres etter kontroll og godkjenning av dokumentasjonen.</p>
        </div>
        <div className="snar-actions">
          <Link className="snar-btn snar-btn-primary" to="/loyvehaver/soknad">Start søknaden</Link>
          <a className="snar-btn snar-btn-secondary" href={`mailto:${EMAILS.partner}`}>Kontakt partnerteamet</a>
        </div>
      </section>

      <footer className="snar-footer snar-shell">
        <div><SnarLinkBrand /><p>Norsk taxi. Uten omveier.</p></div>
        <nav>
          <Link to="/">Kunder</Link>
          <a href={`mailto:${EMAILS.driver}`}>Sjåfør</a>
          <Link to="/loyvehaver">Løyvehaver</Link>
          <Link to="/help">Hjelp</Link>
          <a href={FLEET_URL}>Fleet Panel</a>
        </nav>
        <div className="snar-footer-meta">
          <span>© 2026 SNAR · NexoraHub AS</span>
          <a href={`mailto:${EMAILS.support}`}>support@kjappapp.no</a>
          <a href={`mailto:${EMAILS.privacy}`}>privacy@kjappapp.no</a>
        </div>
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
      <Route path="/tur/:token" element={<TripSharePage />} />
      <Route path="*" element={<PremiumHome />} />
    </Routes>
  );
}
