import React from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { ApplyPage } from './ApplyPage';
import PremiumHome from './PremiumHome';

const FLEET_URL = 'https://fleet.kjappapp.no';

function Logo() {
  return <Link to="/" className="brand" aria-label="KJAPP forside">KJAPP</Link>;
}

function Header({ partner = false }: { partner?: boolean }) {
  return (
    <header className="site-header shell">
      <Logo />
      <nav className="desktop-nav" aria-label="Hovedmeny">
        <Link to="/">Kunder</Link>
        <Link to="/loyvehaver">Løyvehavere</Link>
        <a href="mailto:support@kjappapp.no">Hjelp</a>
      </nav>
      {partner ? <a className="small-outline" href={FLEET_URL}>Partner-login</a> : null}
      <Link className="mobile-menu" to={partner ? '/' : '/loyvehaver'}>{partner ? 'Kunder' : 'Løyvehaver'}</Link>
    </header>
  );
}

function Footer() {
  return (
    <footer className="footer shell">
      <Logo />
      <div className="footer-links">
        <Link to="/">Kunder</Link>
        <Link to="/loyvehaver">Løyvehavere</Link>
        <a href="mailto:support@kjappapp.no">Hjelp</a>
        <a href="mailto:personvern@kjappapp.no">Personvern</a>
        <a href="mailto:hei@kjappapp.no">Kontakt</a>
      </div>
      <div className="footer-meta">© KJAPP</div>
    </footer>
  );
}

function AppPreview() {
  return (
    <div className="phone-preview" aria-label="KJAPP app forhåndsvisning">
      <div className="phone-brand">KJAPP</div>
      <div className="phone-title">Hvor skal du?</div>
      <div className="phone-field">Fra · Nåværende posisjon</div>
      <div className="phone-field muted">Til · Søk destinasjon</div>
      <div className="map-placeholder">
        <span className="map-dot one" />
        <span className="map-dot two" />
        <span className="map-line" />
      </div>
      <div className="phone-row"><strong>Standard</strong><span>Fra 189 kr</span></div>
      <div className="gold-btn full">Bestill KJAPP</div>
    </div>
  );
}

function HomePage() {
  return (
    <main>
      <Header />
      <section className="hero shell">
        <div className="hero-copy">
          <div className="eyebrow">NORSK TAXI · MODERNE BESTILLING</div>
          <h1>Taxi.<br />Enklere.</h1>
          <p className="lead">Bestill taxi på sekunder. Norske løyvehavere. Tydelig pris. Ingen unødvendig styr.</p>
          <div className="actions">
            <a className="gold-btn" href="#app">Last ned KJAPP</a>
            <Link className="outline-btn" to="/loyvehaver">Er du løyvehaver?</Link>
          </div>
        </div>
        <div id="app"><AppPreview /></div>
      </section>

      <Divider />
      <section className="section shell">
        <h2>Bygget for hverdagen.</h2>
        <p className="muted-copy">Tre steg. Ingen friksjon.</p>
        <div className="steps-grid">
          <Step no="01" title="Velg hvor du skal">Åpne KJAPP og skriv inn destinasjonen din.</Step>
          <Step no="02" title="Se pris og bil">Velg kategorien som passer før du bestiller.</Step>
          <Step no="03" title="Følg sjåføren">Se bilen på kartet frem til hentestedet.</Step>
        </div>
      </section>

      <Divider />
      <section className="section shell">
        <div className="eyebrow">HVORFOR KJAPP</div>
        <h2 className="wide-heading">Lokalt nok til å bry seg.<br />Moderne nok til å være enkelt.</h2>
        <div className="feature-grid">
          <Feature title="Norske løyvehavere">KJAPP kobler kunder med godkjente lokale løyvehavere.</Feature>
          <Feature title="Tydelige priser">Pris og bilvalg presenteres før bestilling.</Feature>
          <Feature title="Verifiserte sjåfører">Dokumentasjon og tilgang styres gjennom KJAPP-systemet.</Feature>
          <Feature title="Norsk support">En enklere vei til hjelp når noe faktisk skjer.</Feature>
        </div>
      </section>

      <Divider />
      <section className="assist shell">
        <div className="assist-copy">
          <div className="eyebrow">KJAPP ASSIST · KOMMER SNART</div>
          <h2>Bestill slik du faktisk snakker.</h2>
          <p className="quote">«Bestill en taxi fra Majorstua til Gardermoen kl. 06:00 i morgen.»</p>
        </div>
        <div className="assist-card">
          <div className="eyebrow">KJAPP ASSIST</div>
          <div className="chat user">Majorstua → Gardermoen<br />i morgen kl. 06:00</div>
          <div className="chat assistant">Klart. Standard eller Premium?</div>
          <div className="tiny">Kommer snart i KJAPP</div>
        </div>
      </section>

      <Divider />
      <section className="partner-cta shell">
        <div>
          <div className="eyebrow">FOR LØYVEHAVERE</div>
          <h2>Ditt løyve.<br />Din virksomhet.</h2>
          <p>KJAPP gir deg kundeetterspørsel og et enkelt partnerverktøy — uten å ta kontrollen fra deg.</p>
          <div className="actions">
            <Link className="gold-btn" to="/loyvehaver/soknad">Bli KJAPP-partner</Link>
            <a className="outline-btn" href={FLEET_URL}>Logg inn</a>
          </div>
        </div>
        <div className="commission-block">
          <div className="commission">12%</div>
          <p>KJAPP-provisjon for godkjente løyvehavere</p>
          <span>Sjåfører · Turer · Økonomi · Bedrift</span>
        </div>
      </section>

      <section className="closing shell">
        <h2>KJAPP for Norge.</h2>
        <p>Vi trenger ikke være størst. Vi skal være enklere å forstå, enklere å bruke og bedre tilpasset norske løyvehavere.</p>
        <a className="gold-btn" href="#app">Last ned KJAPP</a>
      </section>
      <Footer />
    </main>
  );
}

function PartnerPage() {
  return (
    <main>
      <Header partner />
      <section className="partner-hero shell">
        <div>
          <div className="eyebrow">FOR LØYVEHAVERE</div>
          <h1>Ditt løyve.<br />Din virksomhet.</h1>
          <p className="lead">KJAPP gir deg en enkel vei til nye turer og et eget partnerverktøy — uten å ta kontrollen fra deg.</p>
          <div className="actions">
            <Link className="gold-btn" to="/loyvehaver/soknad">Søk om å bli partner</Link>
            <a className="outline-btn" href={FLEET_URL}>Logg inn</a>
          </div>
        </div>
        <div className="rate-card">
          <div className="eyebrow">KJAPP PARTNER</div>
          <div className="rate"><strong>12%</strong><span>provisjon</span></div>
          <p>En tydelig modell for godkjente løyvehavere.</p>
        </div>
      </section>

      <Divider />
      <section className="section shell">
        <div className="eyebrow">BYGGET FOR LØYVEHAVEREN</div>
        <h2>Mindre administrasjon.<br />Mer kontroll.</h2>
        <div className="feature-grid">
          <Feature title="Lav og tydelig provisjon">12 % KJAPP-provisjon. Ingen kompliserte nivåer i første versjon.</Feature>
          <Feature title="Du beholder kontrollen">Ditt løyve, dine sjåfører og din virksomhet.</Feature>
          <Feature title="Eget kontrollpanel">Se sjåfører, turer, økonomi og bedriftsinformasjon samlet.</Feature>
          <Feature title="Norsk oppfølging">Direkte kontakt når dokumentasjon, konto eller oppgjør må avklares.</Feature>
        </div>
      </section>

      <Divider />
      <section className="section shell">
        <div className="eyebrow">SLIK BLIR DU KJAPP-PARTNER</div>
        <h2>Én kontrollert vei inn.</h2>
        <div className="process-list">
          <Process no="01" title="Send søknad">Firma, kontaktinformasjon, antall løyver og biler.</Process>
          <Process no="02" title="Last opp dokumentasjon">Firmaattest, løyvebevis, vognkort, forsikring og bankdokumentasjon.</Process>
          <Process no="03" title="KJAPP kontrollerer">Superadmin går gjennom søknaden og dokumentene.</Process>
          <Process no="04" title="Tilgang aktiveres">Først etter godkjenning opprettes partnerkonto og tilgang til fleet.kjappapp.no.</Process>
        </div>
      </section>

      <Divider />
      <section className="portal-preview-section shell">
        <div>
          <div className="eyebrow">ETTER GODKJENNING</div>
          <h2>Alt du trenger.<br />Ikke et helt ERP-system.</h2>
          <p className="lead small">Partnerportalen er bevisst enkel og viser bare det som hjelper deg å drive flåten.</p>
        </div>
        <PortalPreview />
      </section>

      <section className="documents shell">
        <div className="eyebrow">DOKUMENTASJON</div>
        <h2>Dette må være klart før godkjenning.</h2>
        <div className="docs-grid">
          {['Firmaattest', 'Løyvebevis', 'Vognkort', 'Forsikringsdokumentasjon', 'Bankdokumentasjon'].map((x) => <div className="doc-chip" key={x}><span>✓</span>{x}</div>)}
        </div>
      </section>

      <Divider />
      <section className="final-cta shell">
        <div>
          <div className="eyebrow">KLAR FOR Å SØKE?</div>
          <h2>Bli KJAPP-partner.</h2>
          <p>Søknaden gir ikke automatisk tilgang. Partnerkontoen aktiveres først etter at KJAPP har kontrollert og godkjent dokumentasjonen.</p>
        </div>
        <div className="final-actions">
          <Link className="gold-btn full" to="/loyvehaver/soknad">Start løyvehaversøknad</Link>
          <span>Allerede godkjent?</span>
          <a href={FLEET_URL}>Logg inn på fleet.kjappapp.no →</a>
        </div>
      </section>
      <Footer />
    </main>
  );
}

function PortalPreview() {
  return (
    <div className="portal-preview">
      <div className="portal-side"><strong>KJAPP PARTNER</strong><span>Oversikt</span><span>Sjåfører</span><span>Turer</span><span>Økonomi</span><span>Bedrift</span></div>
      <div className="portal-content">
        <div className="metric-row"><div><span>TURER I DAG</span><strong>12</strong></div><div><span>NETTO I DAG</span><strong>4 820 kr</strong></div></div>
        <div className="live-card"><span>LIVE FLÅTE</span><div className="live-dots">● &nbsp; ● &nbsp;&nbsp;&nbsp; ●</div><small>4 biler pålogget</small></div>
      </div>
    </div>
  );
}

function Divider() { return <div className="divider shell" />; }
function Step({ no, title, children }: React.PropsWithChildren<{ no: string; title: string }>) { return <div className="step"><span>{no}</span><h3>{title}</h3><p>{children}</p></div>; }
function Feature({ title, children }: React.PropsWithChildren<{ title: string }>) { return <article className="feature"><h3>{title}</h3><p>{children}</p></article>; }
function Process({ no, title, children }: React.PropsWithChildren<{ no: string; title: string }>) { return <div className="process"><span>{no}</span><h3>{title}</h3><p>{children}</p></div>; }

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
