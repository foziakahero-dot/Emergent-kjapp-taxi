'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';



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

function MicIcon() {
  return <img src="https://kjappapp.no/assets/figma/mic.svg" alt="" aria-hidden="true" />;
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
                <div className="mk-cars-nearby"><i />Forhåndsvisning · ingen sanntidsdata</div>

                <div className="mk-destination-card-v2">
                  <div className="mk-destination-copy-v2">
                    <small>KJAPP</small>
                    <strong>Hvor skal du?</strong>
                    <span>Søk adresse, sted eller flyplass</span>
                  </div>
                  <div className="mk-destination-actions-v2">
                    <button type="button" className="mk-voice-btn-v2" aria-label="Bestill med stemmen"><MicIcon /></button>
                    <button type="button" className="mk-search-btn-v2" aria-label="Åpne destinasjonssøk">⌕</button>
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
      <span className="mk-phone-caption">KJAPP · APPFORHÅNDSVISNING</span>
    </div>
  );
}

const steps = [
  ['01', 'Si eller skriv hvor du skal', 'Søk etter destinasjon eller bruk stemmen. KJAPP gjør reisen klar.'],
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
  { name: 'KJAPP Standard', copy: 'Rask og enkel', example: 'Fra 99 kr · Oslo S → Gardermoen fra 399 kr', image: 'https://kjappapp.no/assets/figma/standard.png' },
  { name: 'KJAPP XL', copy: 'Mer plass · opptil 7 seter', example: 'Fra 149 kr · Opptil 7 passasjerer', image: 'https://kjappapp.no/assets/figma/xl.png' },
  { name: 'Premium', copy: 'Premium komfort', example: 'Fra 199 kr · Premium komfort og luksusbil', image: 'https://kjappapp.no/assets/figma/premium.png' },
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
  const [audience, setAudience] = useState<'passenger' | 'partner'>('passenger');
  const [modalOpen, setModalOpen] = useState(false);
  const [cookieConsent, setCookieConsent] = useState<'accepted' | 'declined' | null>(null);
  useEffect(() => { setCookieConsent(localStorage.getItem('kjapp-cookie-consent') as 'accepted' | 'declined' | null); }, []);
  function setConsent(value: 'accepted' | 'declined') { localStorage.setItem('kjapp-cookie-consent', value); setCookieConsent(value); }
  function choosePartner() { setAudience('partner'); setMenuOpen(false); document.getElementById('partner')?.scrollIntoView({ behavior: 'smooth' }); }
  function choosePassenger() { setAudience('passenger'); setMenuOpen(false); document.getElementById('top')?.scrollIntoView({ behavior: 'smooth' }); }
  function openModal() { setModalOpen(true); setMenuOpen(false); }

  return (
    <main id="top" className="mk-page mk-page-v2">
      <header className="mk-header mk-shell">
        <div className="mk-header-start"><div className="mk-audience" role="group" aria-label="Velg målgruppe"><button type="button" aria-pressed={audience === 'passenger'} onClick={choosePassenger}>Passasjer</button><button type="button" aria-pressed={audience === 'partner'} onClick={choosePartner}>Sjåfør &amp; Løyvehaver</button></div><Wordmark /></div>
        <nav className={menuOpen ? 'is-open' : ''} aria-label="Hovedmeny">
          <a href="#top" onClick={() => setMenuOpen(false)}>Kunder</a>
          <a href="#vehicles" onClick={() => setMenuOpen(false)}>Bilvalg</a>
          <a href="#voice" onClick={() => setMenuOpen(false)}>Voice</a>
          <Link href="https://kjappapp.no/loyvehaver" onClick={() => setMenuOpen(false)}>Løyvehavere</Link>
          <a href={FLEET_URL} onClick={() => setMenuOpen(false)}>Fleet Panel</a>
          <BetaButton onClick={openModal} />
        </nav>
        <button className="mk-menu-button" type="button" aria-expanded={menuOpen} aria-label="Åpne hovedmeny" onClick={() => setMenuOpen((open) => !open)}>Meny</button>
      </header>

      <section className="mk-hero mk-hero-v2 mk-shell">
        <div className="mk-hero-copy">
          <div className="mk-eyebrow">NORSK TAXI — PÅ DINE PREMISSER</div>
          <h1>NORSK TAXI,<br />UTEN OMVEIER.</h1>
          <p className="mk-hero-lead">Kartet først. Bestill med tekst eller stemme. Velg bilen som passer, se estimatet før du bekrefter — og følg reisen live.</p>
          <div className="mk-hero-promise"><span className="mk-pulse" />Si hvor du skal. KJAPP ordner resten.</div>
          <div className="mk-actions">
            <BetaButton onClick={openModal} />
            <a className="mk-pill mk-pill-dark" href="#voice">Se voice booking</a>
            <Link className="mk-fleet-inline" href="https://kjappapp.no/loyvehaver">For løyvehavere →</Link>
          </div>
          <div className="mk-location">Lisensierte sjåfører · Tydelig estimat · Live sporing · Norsk support</div>
        </div>
        <PhoneScene />
      </section>

      <section className="mk-proof mk-shell" aria-labelledby="proof-title"><span className="mk-section-label" id="proof-title">KLAR FOR LANSERING</span><div className="mk-proof-grid"><article>For lisensierte sjåfører</article><article>Beta planlegges i Oslo</article><article>Gi oss din tilbakemelding i beta</article></div></section>

      <section id="how" className="mk-journey mk-shell">
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
              <Image src={vehicle.image} alt={`${vehicle.name} kjøretøykategori`} width={560} height={300} sizes="(max-width: 900px) 100vw, 33vw" />
              <div><h3>{vehicle.name}</h3><p>{vehicle.copy}</p><p className="mk-price-example" title="Illustrativt eksempel – ikke et pristilbud">{vehicle.example}*</p></div>
            </article>
          ))}
        </div>
        <div className="mk-estimate-disclaimer">*Illustrative priseksempler, ikke et bindende pristilbud. Prisene varierer etter tid og sted. Du ser estimat før du bestiller.</div>
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

      <section id="partner" className={`mk-partner mk-shell ${audience === 'partner' ? 'mk-partner-selected' : ''}`}>
        <div className="mk-partner-copy">
          <span>BYGGET OGSÅ FOR DE SOM KJØRER</span>
          <h2>Din virksomhet.<br />Moderne verktøy rundt turene.</h2>
          <p>KJAPP gir sjåfører og løyvehavere et samlet økosystem for turer, aktivitet, dokumentasjon og oppgjør — uten at partnerbudskapet tar over kundeopplevelsen.</p>
          <div className="mk-actions"><BetaButton onClick={openModal} /><a className="mk-pill mk-pill-dark" href={FLEET_URL}>Åpne Fleet Panel</a></div>
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
        <p>Vi er i beta. Meld din interesse, så gir vi beskjed når du kan teste KJAPP der du bor.</p>
        <div className="mk-actions"><BetaButton onClick={openModal} /></div>
      </section>

      <footer className="mk-footer mk-shell">
        <div className="mk-footer-brand"><Wordmark /><p>Norsk taxi. Uten omveier.</p><small>NexoraHub AS · organisasjonsnummer oppgis etter verifisering</small></div>
        <nav aria-label="Bunnmeny" className="mk-footer-columns">
          <div><strong>For kunder</strong><a href="#how">Hvordan det fungerer</a><a href="#vehicles">Bilvalg</a><a href="#vehicles">Priser</a><a href="https://kjappapp.no/help">FAQ</a></div>
          <div><strong>For sjåfører</strong><a href="#partner">Bli sjåfør</a><Link href="https://kjappapp.no/loyvehaver">Løyvehaver</Link><a href={FLEET_URL}>Fleet Panel</a></div>
          <div><strong>Kontakt</strong><a href={`mailto:${EMAILS.support}`}>support@kjappapp.no</a><Link href="/personvern">Personvernerklæring</Link><Link href="/vilkar">Bruksvilkår</Link></div>
        </nav><span>© 2026 KJAPP · NexoraHub AS</span>
      </footer>
      {cookieConsent === null && <aside className="mk-cookie" aria-label="Informasjonskapsler"><p>Vi bruker kun nødvendige informasjonskapsler. Valgfrie analysekapsler lastes først hvis du samtykker. <Link href="/personvern">Les personvern</Link>.</p><div><button onClick={() => setConsent('accepted')}>Aksepter</button><button onClick={() => setConsent('declined')}>Avslå</button></div></aside>}
      {modalOpen && <WaitlistModal onClose={() => setModalOpen(false)} />}
    </main>
  );
}


function BetaButton({ onClick }: { onClick: () => void }) {
  return <button type="button" className="mk-pill mk-pill-primary mk-beta-cta" onClick={onClick}>Få tilgang til beta<span className="mk-beta-badge">BETA</span></button>;
}

function WaitlistModal({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<'idle'|'sending'|'success'|'error'>('idle');
  const [error, setError] = useState('');
  const firstField = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    firstField.current?.focus();
    function escape(event: KeyboardEvent) { if (event.key === 'Escape') onClose(); }
    document.addEventListener('keydown', escape);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', escape); previous?.focus(); };
  }, [onClose]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setState('sending'); setError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch('/api/waitlist', { method:'POST', headers: { 'Content-Type':'application/json' }, body:JSON.stringify(data) });
      const body: { error?: string } = await response.json();
      if (!response.ok) throw new Error(body.error || 'Påmeldingen kunne ikke lagres. Prøv igjen senere.');
      setState('success');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Noe gikk galt.'); setState('error'); }
  }
  return <div className="mk-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="mk-modal" role="dialog" aria-modal="true" aria-labelledby="waitlist-title">
      <button type="button" className="mk-modal-close" aria-label="Lukk" onClick={onClose}>×</button>
      <span className="mk-section-label">KJAPP BETA</span><h2 id="waitlist-title">Få tilgang til beta</h2>
      {state === 'success' ? <div role="status"><p>Takk! Påmeldingen er mottatt. Vi kontakter deg når KJAPP er klar i din by.</p><button className="mk-pill mk-pill-primary" onClick={onClose}>Lukk</button></div> : <form onSubmit={submit}>
        <label>Navn<input ref={firstField} name="name" required minLength={2} maxLength={100} autoComplete="name" /></label>
        <label>Telefon<input name="phone" type="tel" required minLength={8} maxLength={30} autoComplete="tel" /></label>
        <label>E-post (valgfri)<input name="email" type="email" maxLength={254} autoComplete="email" /></label>
        <label>Hva er du?<select name="role" required defaultValue=""><option value="" disabled>Velg rolle</option><option value="passenger">Passasjer</option><option value="driver">Sjåfør</option><option value="fleet_owner">Løyvehaver</option></select></label>
        <label>Hvilken by bor du i?<input name="city" required minLength={2} maxLength={100} autoComplete="address-level2" /></label>
        {state === 'error' && <p role="alert" className="mk-form-error">{error}</p>}
        <button className="mk-pill mk-pill-primary" type="submit" disabled={state === 'sending'}>{state === 'sending' ? 'Sender…' : 'Meld meg på'}</button>
        <p className="mk-form-privacy">Vi sender deg en varsling når KJAPP er klar i din by. Les hvordan vi behandler opplysningene dine i <Link href="/personvern">personvernerklæringen</Link>.</p>
      </form>}
    </div>
  </div>;
}
