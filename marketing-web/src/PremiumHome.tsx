import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './premium-home.css';
import './snar-landing.css';
import BetaWaitlist from './BetaWaitlist';

const FLEET_URL = 'https://fleet.kjappapp.no';
const EMAILS = {
  support: 'support@kjappapp.no',
  privacy: 'privacy@kjappapp.no',
};

const ENV = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const ANDROID_BETA_URL = ENV?.VITE_ANDROID_BETA_URL?.trim();
const IOS_TESTFLIGHT_URL = ENV?.VITE_IOS_TESTFLIGHT_URL?.trim();

function SnarBrand({ compact = false }: { compact?: boolean }) {
  return (
    <a className={compact ? 'snar-brand snar-brand-compact' : 'snar-brand'} href="#top" aria-label="SNAR forside">
      <span className="snar-mark" aria-hidden="true"><i /><b /></span>
      <strong>SNAR</strong>
    </a>
  );
}

function CarMarker({ className }: { className: string }) {
  return <span className={'snar-map-car ' + className} aria-hidden="true"><i /><b /></span>;
}

function PhoneDemo() {
  const [collapsed, setCollapsed] = useState(false);
  const [stage, setStage] = useState<'browse' | 'matching' | 'driver'>('browse');

  return (
    <div className="snar-phone-stage">
      <div className="snar-phone-glow" aria-hidden="true" />
      <div className="snar-phone" aria-label="Interaktiv forhåndsvisning av SNAR kundeapp">
        <div className="snar-phone-screen">
          <div className="snar-island" aria-hidden="true" />
          <div className="snar-map">
            <div className="snar-map-text snar-map-majorstuen">MAJORSTUEN</div>
            <div className="snar-map-text snar-map-frogner">FROGNER</div>
            <div className="snar-route" aria-hidden="true" />
            <div className="snar-location" aria-label="Din posisjon"><i /></div>
            <CarMarker className="car-one" />
            <CarMarker className="car-two" />
            <CarMarker className="car-three" />
            {stage === 'driver' && <CarMarker className="car-assigned" />}
          </div>

          <div className="snar-phone-top">
            <span className="snar-mini-brand"><span className="snar-mark"><i /><b /></span><strong>SNAR</strong></span>
            <span className="snar-avatar">U</span>
          </div>

          <button className="snar-search" type="button" onClick={() => setCollapsed(false)}>
            <span className="snar-search-dot">⌕</span>
            <span>Hvor skal du?</span>
          </button>

          <div className={'snar-ride-sheet ' + (collapsed ? 'is-collapsed' : '')}>
            <button className="snar-sheet-handle" type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Åpne turpanel' : 'Minimer turpanel'}>
              <span />
            </button>

            {collapsed ? (
              <button className="snar-active-pill" type="button" onClick={() => setCollapsed(false)}>
                <span><small>AKTIV TUR</small><strong>{stage === 'driver' ? 'Sjåfør 3 min unna' : 'Hvor vil du?'}</strong></span>
                <b>⌃</b>
              </button>
            ) : (
              <>
                <div className="snar-sheet-heading">
                  <div><small>{stage === 'browse' ? 'VELG TUR' : stage === 'matching' ? 'SØKER' : 'SJÅFØR PÅ VEI'}</small>
                  <strong>{stage === 'browse' ? 'Reis på din måte' : stage === 'matching' ? 'Vi finner nærmeste bil' : 'Amir er 3 min unna'}</strong></div>
                  <span className="snar-live-dot"><i /> LIVE</span>
                </div>

                {stage === 'browse' ? (
                  <div className="snar-options">
                    <button className="snar-option selected" type="button">
                      <img src="/assets/figma/standard.png" alt="" />
                      <span><strong>SNAR</strong><small>2 min · opptil 4</small></span>
                      <b>149–169 kr</b>
                    </button>
                    <button className="snar-option" type="button">
                      <img src="/assets/figma/xl.png" alt="" />
                      <span><strong>SNAR XL</strong><small>4 min · mer plass</small></span>
                      <b>189–219 kr</b>
                    </button>
                    <button className="snar-option" type="button">
                      <img src="/assets/figma/premium.png" alt="" />
                      <span><strong>Premium</strong><small>6 min · mer komfort</small></span>
                      <b>329–379 kr</b>
                    </button>
                  </div>
                ) : stage === 'matching' ? (
                  <div className="snar-matching">
                    <span className="snar-radar"><i /><b /><em /></span>
                    <p>Matcher deg med en ledig sjåfør i nærheten.</p>
                  </div>
                ) : (
                  <div className="snar-driver-card">
                    <span className="snar-driver-avatar">A</span>
                    <span><strong>Amir H.</strong><small>⭐ 4,9 · Tesla Model Y · SNAR01</small></span>
                    <button type="button" aria-label="Kontakt sjåfør">☎</button>
                  </div>
                )}

                <button className="snar-demo-primary" type="button" onClick={() => setStage(stage === 'browse' ? 'matching' : stage === 'matching' ? 'driver' : 'browse')}>
                  {stage === 'browse' ? 'Bestill SNAR' : stage === 'matching' ? 'Vis matchet sjåfør' : 'Se bilvalg igjen'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <p className="snar-product-note">Interaktiv produktdemo · designet etter SNAR kundeappen</p>
    </div>
  );
}

const vehicles = [
  { name: 'SNAR', eyebrow: 'FOR HVERDAGSREISEN', copy: 'Enkelt, fra A til B.', image: '/assets/figma/standard.png', meta: 'Opptil 4' },
  { name: 'SNAR XL', eyebrow: 'MER PLASS', copy: 'Når dere trenger litt mer rom.', image: '/assets/figma/xl.png', meta: 'Opptil 7' },
  { name: 'Premium', eyebrow: 'MER KOMFORT', copy: 'Det lille ekstra når du ønsker det.', image: '/assets/figma/premium.png', meta: 'Premiumbil' },
];

const values = [
  ['NORSK', 'Bygget for norske passasjerer, lokale løyvehavere og norsk kundestøtte.'],
  ['TYDELIG', 'Biltype, hentetid og prisestimat før du bekrefter bestillingen.'],
  ['TRYGT', 'Lisensierte sjåfører, live turstatus og sikkerhetsfunksjoner under reisen.'],
  ['ENKELT', 'Søk, bestill, følg bilen og betal i én sammenhengende opplevelse.'],
];

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
    <main id="top" className="snar-page">
      <header className="snar-header">
        <SnarBrand />
        <nav className={menuOpen ? 'is-open' : ''} aria-label="Hovedmeny">
          <a href="#how" onClick={() => setMenuOpen(false)}>Slik fungerer det</a>
          <a href="#vehicles" onClick={() => setMenuOpen(false)}>Bilvalg</a>
          <Link to="/loyvehaver" onClick={() => setMenuOpen(false)}>For løyvehavere</Link>
          <Link to="/help" onClick={() => setMenuOpen(false)}>Hjelp</Link>
        </nav>
        <div className="snar-header-actions">
          <a className="snar-btn snar-btn-secondary" href={FLEET_URL}>Partnerlogg inn</a>
          <button className="snar-btn snar-btn-primary" type="button" onClick={openWaitlist}>Få tilgang til beta</button>
        </div>
        <button className="snar-menu" type="button" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>Meny</button>
      </header>

      <section className="snar-hero snar-shell">
        <div className="snar-hero-copy">
          <span className="snar-beta-label"><i /> OSLO-BETA</span>
          <h1>Hei, Oslo.<br />Hvor skal du?</h1>
          <p className="snar-lead">Se bilvalg og prisestimat før du bestiller. Følg sjåføren når turen er bekreftet.</p>
          <p className="snar-supporting">Hjem fra middag. Til et tidlig møte. Eller bare videre. SNAR bygges sammen med lokale løyvehavere, og vi inviterer nå de første passasjerene i Oslo.</p>
          <div className="snar-actions">
            <button className="snar-btn snar-btn-primary" type="button" onClick={openWaitlist}>Få tilgang til beta</button>
            <a className="snar-btn snar-btn-secondary" href="#how">Se hvordan det fungerer</a>
          </div>
          <small>Oslo først · Med lokale løyvehavere</small>
        </div>
        <PhoneDemo />
      </section>

      <section id="how" className="snar-how snar-shell">
        <div className="snar-section-copy">
          <span className="snar-kicker">SLIK FUNGERER DET</span>
          <h2>Fra tanke til tur.<br />Uten omveier.</h2>
          <p>SNAR holder bestillingen enkel. Destinasjon, bilvalg og turstatus ligger der du forventer dem.</p>
        </div>
        <div className="snar-step-grid">
          <article><span>01</span><h3>Si eller skriv hvor du skal</h3><p>Søk etter destinasjon eller bruk stemmen. SNAR finner stedet og gjør reisen klar.</p></article>
          <article><span>02</span><h3>Velg bil og se estimatet</h3><p>Velg SNAR, SNAR XL eller Premium og se estimert hentetid og pris før bestilling.</p></article>
          <article><span>03</span><h3>Bestill og følg bilen live</h3><p>Når sjåføren har akseptert ser du navn, bil, skilt, ETA og bevegelsen på kartet.</p></article>
        </div>
      </section>

      <section id="vehicles" className="snar-vehicles">
        <div className="snar-shell">
          <div className="snar-section-copy row">
            <div><span className="snar-kicker">BILVALG</span><h2>Velg det som passer turen.</h2></div>
            <p>Samme enkle SNAR-opplevelse. Ulik plass og komfort. Faktisk bil, registreringsnummer og sjåfør vises når turen er matchet.</p>
          </div>
          <div className="snar-vehicle-grid">
            {vehicles.map((vehicle) => (
              <article className="snar-vehicle-card" key={vehicle.name}>
                <div className="snar-car-stage"><img src={vehicle.image} alt={vehicle.name + ' kjøretøykategori'} loading="lazy" /></div>
                <span>{vehicle.eyebrow}</span>
                <div className="snar-vehicle-title"><h3>{vehicle.name}</h3><small>{vehicle.meta}</small></div>
                <p>{vehicle.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="snar-voice snar-shell">
        <div className="snar-voice-card">
          <span className="snar-kicker">SNAR ASSIST</span>
          <h2>Bare si hvor du skal.</h2>
          <p>Stemmen er en snarvei inn i bestillingen — ikke en chatbot som står i veien. Pris og hentetid kommer fortsatt fra den faktiske turen.</p>
          <div className="snar-voice-demo"><span>“Kjør meg til Gardermoen.”</span><b>Oslo lufthavn · funnet ✓</b></div>
        </div>
        <div className="snar-trust-card">
          <span className="snar-kicker">SAMME FLYT HELE VEIEN</span>
          <ol><li>Destinasjon</li><li>Bilvalg</li><li>Estimat</li><li>Bekreft</li></ol>
        </div>
      </section>

      <section className="snar-values snar-shell">
        <div className="snar-section-copy">
          <span className="snar-kicker">HVORFOR SNAR</span>
          <h2>Norsk mobilitet,<br />gjort tydelig.</h2>
        </div>
        <div className="snar-value-grid">
          {values.map(([title, copy], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{copy}</p></article>)}
        </div>
      </section>

      <section className="snar-partner snar-shell">
        <div>
          <span className="snar-kicker">FOR LØYVEHAVERE</span>
          <h2>Din flåte.<br />Din kontroll.</h2>
          <p>Fleet Panel samler sjåfører, kjøretøy, dokumenter, turer og oppgjør. SNAR leverer teknologien rundt virksomheten — løyvehaveren beholder kontrollen.</p>
          <div className="snar-actions">
            <Link className="snar-btn snar-btn-primary" to="/loyvehaver">Bli SNAR-partner</Link>
            <a className="snar-btn snar-btn-secondary" href={FLEET_URL}>Logg inn Fleet</a>
          </div>
        </div>
        <div className="snar-fleet-preview">
          <div className="snar-fleet-head"><SnarBrand compact /><span>FLEET · LIVE</span></div>
          <div className="snar-fleet-metrics"><article><small>SJÅFØRER</small><strong>48</strong><span>41 online</span></article><article><small>TURER I DAG</small><strong>126</strong><span>Live oversikt</span></article></div>
          <div className="snar-fleet-list"><span>Dokumenter <b>Oppdatert</b></span><span>Ukentlig oppgjør <b>Klar</b></span><span>Kjøretøy <b>12 aktive</b></span></div>
        </div>
      </section>

      <section className="snar-beta snar-shell">
        <span className="snar-beta-label"><i /> OSLO-BETA</span>
        <h2>Klar når du er.</h2>
        <p>Meld interesse som passasjer, sjåfør eller løyvehaver. Vi kontakter deg når beta-tilgang åpner for din gruppe.</p>
        <div className="snar-actions">
          <button className="snar-btn snar-btn-primary" type="button" onClick={openWaitlist}>Få tilgang til beta</button>
          {ANDROID_BETA_URL ? <a className="snar-btn snar-btn-secondary" href={ANDROID_BETA_URL}>Android beta</a> : null}
          {IOS_TESTFLIGHT_URL ? <a className="snar-btn snar-btn-secondary" href={IOS_TESTFLIGHT_URL}>TestFlight</a> : null}
        </div>
      </section>

      <footer className="snar-footer snar-shell">
        <div><SnarBrand /><p>Norsk taxi. Uten omveier.</p></div>
        <nav><a href="#how">Slik fungerer det</a><a href="#vehicles">Bilvalg</a><Link to="/loyvehaver">Løyvehaver</Link><Link to="/help">Hjelp</Link><a href={FLEET_URL}>Fleet Panel</a></nav>
        <div className="snar-footer-meta"><span>© 2026 SNAR · NexoraHub AS</span><a href={'mailto:' + EMAILS.support}>support@kjappapp.no</a><a href={'mailto:' + EMAILS.privacy}>privacy@kjappapp.no</a></div>
      </footer>

      <BetaWaitlist open={waitlistOpen} onClose={() => setWaitlistOpen(false)} returnFocusTo={waitlistTrigger.current} />
    </main>
  );
}
