import { useState } from 'react';
import { Link } from 'react-router-dom';
import './premium-home.css';

const FLEET_URL = 'https://fleet.kjappapp.no';

const assets = {
  logo: 'https://www.figma.com/api/mcp/asset/6c5a157b-7016-42d7-930a-4897eefe7fc8.svg',
  chevron: 'https://www.figma.com/api/mcp/asset/3e50c9aa-7707-4fba-8d16-3eb0cc67fdbc.svg',
  shieldCheck: 'https://www.figma.com/api/mcp/asset/9361a9c9-4ad7-4534-a054-0e13e2a9593b.svg',
  search: 'https://www.figma.com/api/mcp/asset/70e373f4-90b1-4c5d-aa38-f3ec563e64b2.svg',
  check: 'https://www.figma.com/api/mcp/asset/6ce6f108-7880-421b-9f25-f2282d18bf4d.svg',
  mic: 'https://www.figma.com/api/mcp/asset/1949801c-6dca-46d4-a3cd-fc922e79af65.svg',
  micSmall: 'https://www.figma.com/api/mcp/asset/595b0f98-ab59-471f-b08a-a2ac3b5bc41a.svg',
  shield: 'https://www.figma.com/api/mcp/asset/b5ea90e6-0dfa-49bf-bc0c-f1bcd1dac8d5.svg',
  plus: 'https://www.figma.com/api/mcp/asset/e3256b6f-43d5-4c58-a69b-02459f6f3288.svg',
  heroMap: 'https://www.figma.com/api/mcp/asset/7463016a-0bab-414c-97b8-3a0b58480bee.png',
  passenger: 'https://www.figma.com/api/mcp/asset/05016276-a2c1-4301-ab46-e0675a329ab0.png',
  driver: 'https://www.figma.com/api/mcp/asset/678d6352-5ad3-42ea-be06-08c5c003086d.png',
  fleet: 'https://www.figma.com/api/mcp/asset/fe2a62b0-6a72-47a3-9aaa-f9b83d073acc.png',
  flow1: 'https://www.figma.com/api/mcp/asset/3fc4f31c-dd59-43e8-b030-d37a698e0db1.png',
  flow2: 'https://www.figma.com/api/mcp/asset/fc8fb513-cd58-47d9-bab2-3f3da4d3cfaf.png',
  flow3: 'https://www.figma.com/api/mcp/asset/061a13b1-17ef-4c4f-b30c-105cdad8963e.png',
  flow4: 'https://www.figma.com/api/mcp/asset/1ad06903-72bd-4da5-b95c-8d3253d45a94.png',
  standard: 'https://www.figma.com/api/mcp/asset/65d177ca-a5cf-432e-833a-594be0c51743.png',
  xl: 'https://www.figma.com/api/mcp/asset/6791996e-0d54-4d6a-bcaa-d443e9e3f4fd.png',
  premium: 'https://www.figma.com/api/mcp/asset/7ce9de16-f717-4fba-94d6-960830d175ed.png',
};

type ButtonProps = { children: React.ReactNode; href: string; secondary?: boolean; className?: string };
function Button({ children, href, secondary = false, className = '' }: ButtonProps) {
  return <a className={`ph-button ${secondary ? 'ph-button-secondary' : ''} ${className}`} href={href}>{children}</a>;
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="ph-badge">{children}</span>;
}

function Brand() {
  return (
    <a className="ph-brand" href="#top" aria-label="KJAPP forside">
      <span className="ph-brand-icon"><img src={assets.logo} alt="" /></span>
      <strong>KJAPP<span>APP</span></strong>
    </a>
  );
}

const faqs = [
  ['Hva er KJAPP?', 'KJAPP er en helnorsk transportplattform utviklet spesifikt for norske kjøreforhold, regler og løyvekrav.'],
  ['Hvor kan jeg bruke KJAPP?', 'Vi starter beta-lanseringen i Oslo og Stor-Oslo, og ruller fortløpende ut til andre store byer.'],
  ['Hvordan bestiller jeg?', 'Åpne KJAPP, skriv inn eller si destinasjonen din med stemmen, velg biltype og bekreft turen.'],
  ['Hvor stor er serviceavgiften?', 'KJAPP-modellen er bygget rundt 12 % serviceavgift for godkjente samarbeidspartnere.'],
  ['Hvordan blir jeg sjåfør?', 'Sjåfører knyttes til en godkjent løyvehaver og må levere nødvendig dokumentasjon før tilgang aktiveres.'],
  ['Kan løyvehavere ha flere biler?', 'Ja. KJAPP Fleet er bygget for å administrere flere biler og sjåfører fra ett samlet panel.'],
  ['Hva er fordelen med KJAPP Fleet?', 'Du får samlet oversikt over biler, sjåfører, turer, dokumentasjon og økonomi.'],
  ['Er KJAPP tilgjengelig for iPhone og Android?', 'KJAPP utvikles for både iPhone og Android. Godkjente betatestere får tilgang når den aktuelle testversjonen er klar.'],
];

export default function PremiumHome() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  return (
    <main id="top" className="ph-page">
      <header className="ph-nav">
        <Brand />
        <nav className={menuOpen ? 'is-open' : ''} aria-label="Hovedmeny">
          <a href="#slik" onClick={() => setMenuOpen(false)}>Slik fungerer det</a>
          <a href="#sjafor" onClick={() => setMenuOpen(false)}>For sjåfører</a>
          <a href="#fleet" onClick={() => setMenuOpen(false)}>For løyvehavere</a>
          <a href="#sikkerhet" onClick={() => setMenuOpen(false)}>Sikkerhet</a>
          <a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a>
        </nav>
        <div className="ph-nav-actions">
          <a className="ph-driver-link" href="#sjafor">Bli sjåfør</a>
          <Button href="#download">Last ned KJAPP</Button>
          <button className="ph-menu" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label="Åpne meny"><span /><span /><span /></button>
        </div>
      </header>

      <section className="ph-hero">
        <div className="ph-hero-copy">
          <Badge>Norges nye utfordrer</Badge>
          <div>
            <h1>Kjør smartere.<em>Tjen mer.</em></h1>
            <p>En smartere taxiplattform for Norge. Rask bestilling for passasjeren, 12% serviceavgift for sjåføren og full kontroll for løyvehaveren.</p>
          </div>
          <div className="ph-hero-actions">
            <Button href="#download">Last ned KJAPP</Button>
            <Button href="#sjafor" secondary>Bli sjåfør</Button>
            <a className="ph-text-link" href="#fleet">For løyvehavere <img src={assets.chevron} alt="" /></a>
          </div>
          <div className="ph-proof"><img src={assets.shieldCheck} alt="" />Bygget sammen med norske sjåfører og løyvehavere.</div>
        </div>
        <div className="ph-phone-wrap">
          <div className="ph-phone-glow" />
          <div className="ph-phone">
            <div className="ph-map"><img className="ph-map-image" src={assets.heroMap} alt="Kartvisning i KJAPP" />
              <div className="ph-map-search"><img src={assets.search} alt="" /><span>Karl Johans gate 12 → Oslo lufthavn</span></div>
              <div className="ph-pin ph-pin-a"><i />HENT</div><div className="ph-pin ph-pin-b"><i />MÅL</div>
              <div className="ph-order-sheet"><div><span><b>KJAPP Standard</b><small>Elbil · 4 min unna</small></span><strong>189 kr</strong></div><button>BESTILL KJAPP</button></div>
            </div>
          </div>
        </div>
      </section>

      <section className="ph-section ph-paths" id="slik">
        <div className="ph-section-heading center"><Badge>Fleksibilitet i alle ledd</Badge><h2>Én KJAPP. Tre måter å bruke den på.</h2></div>
        <div className="ph-three-grid">
          {[ [assets.passenger,'PASSASJER','Jeg skal reise','Bestill trygg transport på sekunder. Betal automatisk med kort eller Vipps.'], [assets.driver,'SJÅFØR','Jeg kjører taxi','Behold 88% av omsetningen din. Raske, ukentlige utbetalinger direkte til bank.'], [assets.fleet,'LØYVEHAVER','Jeg driver en flåte','Full sanntidsoversikt over biler, sjåfører og løyvegodkjenninger på ett sted.'] ].map(([image,label,title,text]) => <article className="ph-role-card" key={label}><img src={image} alt="" /><div><Badge>{label}</Badge><h3>{title}</h3><p>{text}</p></div></article>)}
        </div>
      </section>

      <section className="ph-split ph-passenger">
        <div>
          <div className="ph-section-heading"><Badge>For passasjerer</Badge><h2>Bestill på sekunder.</h2></div>
          <div className="ph-steps">
            {[['01','Velg hentested','Søk opp adresse eller bruk gjeldende posisjon.'],['02','Velg destinasjon','Få fastpris og estimert ankomsttid umiddelbart.'],['03','Velg biltype','Velg mellom Standard, XL eller Premium klasser.'],['04','Følg turen live','Se sjåførens posisjon i sanntid helt fram til døren.']].map(([no,title,text]) => <div className="ph-step" key={no}><b>{no}</b><span><strong>{title}</strong><small>{text}</small></span></div>)}
          </div>
        </div>
        <div className="ph-flow"><div><img src={assets.flow1} alt="Velg hentested" /></div><div><img src={assets.flow2} alt="Velg destinasjon" /></div><div><img src={assets.flow3} alt="Velg biltype" /></div><div><img src={assets.flow4} alt="Følg bilen" /></div></div>
      </section>

      <section className="ph-section ph-vehicles">
        <div className="ph-section-heading center"><Badge>Vår flåte</Badge><h2>Velg klassen som passer deg</h2></div>
        <div className="ph-three-grid">
          {[ [assets.standard,'KJAPP · Standard taxi','189 kr','4 pers · 3 min unna','Miljøvennlige og moderne elbiler til dagligdagse reiser.'], [assets.xl,'KJAPP XL · Mer plass','299 kr','6 pers · 6 min unna','Romslige biler perfekt for grupper, familier eller mye bagasje.'], [assets.premium,'KJAPP Premium · Ekstra komfort','349 kr','4 pers · 5 min unna','Eksklusive biler med det lille ekstra for forretningsreiser.'] ].map(([image,title,price,meta,text]) => <article className="ph-vehicle-card" key={title}><img src={image} alt="" /><div><h3><span>{title}</span><b>{price}</b></h3><small>{meta}</small><p>{text}</p></div></article>)}
        </div>
      </section>

      <section className="ph-split ph-driver" id="sjafor">
        <div className="ph-driver-demo"><strong>Dagens status</strong><div className="ph-earning"><small>DAGENS INNTEKT</small><b>2 840 kr</b></div><hr/><div className="ph-demo-stats"><span><small>TURER</small><b>14</b></span><span><small>ONLINE TID</small><b>6t 42m</b></span><span><small>STATUS</small><b className="cyan">ONLINE</b></span></div><hr/><div className="ph-trip"><small>NY TUR FORESLÅTT</small><b>Solli plass → Oslo S</b><span>Estimert ankomst: 4 min · Fastpris: 210 kr</span></div></div>
        <div className="ph-driver-copy"><Badge>For sjåfører</Badge><div><h2>12 % serviceavgift. Mer av turen blir hos deg.</h2><p>Hos KjappApp beholder du 88% av omsetningen din. Vi jobber for en mer rettferdig delingsøkonomi i det norske taximarkedet.</p></div><ul>{[['12% fast serviceavgift','Markedets laveste gebyr betyr mer lønn utbetalt.'],['Ukentlige direkteutbetalinger','Få opptjent omsetning rett inn på din konto hver mandag.'],['Null bindingstid','Du bestemmer helt selv når du ønsker å være online.']].map(([title,text]) => <li key={title}><img src={assets.check} alt=""/><span><b>{title}</b><small>{text}</small></span></li>)}</ul><Button href="#download">Bli KJAPP-sjåfør</Button></div>
      </section>

      <section className="ph-section ph-fleet" id="fleet">
        <div className="ph-fleet-header"><div><Badge>Løyvehaver plattform</Badge><h2>Hele flåten. Ett sted.</h2><p>Administrer kjøretøy, godkjenn sjåfører og følg flåten fra vårt skreddersydde flåtepanel. Høyere kontroll, mindre administrasjonsarbeid.</p></div><div><Link className="ph-button" to="/loyvehaver/soknad">Registrer som løyvehaver</Link><a className="ph-button ph-button-secondary" href={FLEET_URL}>Logg inn i Fleet</a></div></div>
        <div className="ph-dashboard"><div className="ph-metrics">{[['Biler aktive','12'],['Sjåfører online nå','8'],['Turer i dag','4'],['Dagens omsetning','18 420 kr']].map(([label,value],i)=><div key={label}><small>{label}</small><b className={i===1||i===3?'cyan':''}>{value}</b></div>)}</div><h4>Flåteoversikt</h4><div className="ph-table"><div className="head"><span>SJÅFØR</span><span>STATUS</span><span>BILNUMMER</span><span>TURER</span><span>INNTEKT</span></div><div><span>Morten Hansen</span><span className="cyan">AKTIV</span><span>EL 98214</span><span>12</span><span>3 120 kr</span></div><div><span>Lars Johansen</span><span>PAUSE</span><span>EL 41259</span><span>8</span><span>1 940 kr</span></div></div></div>
      </section>

      <section className="ph-split ph-ai"><div><Badge>Neste generasjons booking</Badge><h2>Bare si hvor du skal.</h2><p>Lei av å taste inn adresser? Trykk på mikrofonen i KJAPP-appen og bestill med stemmen på naturlig norsk. Vår integrerte AI tolker forespørselen din.</p><div className="ph-mic-link"><img src={assets.mic} alt=""/>Prøv stemmestyring i appen</div></div><div className="ph-voice"><div className="ph-voice-title"><span><img src={assets.micSmall} alt=""/></span><b>KJAPP TALE-AI</b></div><div className="ph-bubble user">“Kjør meg til Gardermoen klokken 07 i morgen.”</div><div className="ph-bubble ai">“Klart. Foreslått henting kl. 06:55. Standard bil til fastpris 690 kr.”</div><div className="ph-voice-actions"><button>BEKREFT</button><button>ENDRE</button></div></div></section>

      <section className="ph-section ph-trust" id="sikkerhet"><div className="ph-section-heading center"><Badge>Trygghet i høysetet</Badge><h2>Taxi skal føles trygt.</h2></div><div className="ph-trust-grid">{[['Verifiserte sjåfører','Hver eneste sjåfør må ha gyldig dokumentasjon og godkjenning før tilgang aktiveres.'],['Godkjente løyvehavere','Vi samarbeider med profesjonelle aktører som oppfyller norske løyvekrav.'],['Følg reisen','Følg reisen live og del turinformasjon med venner og familie.'],['Norsk support','Få hjelp fra KJAPP når konto, dokumentasjon eller tur må avklares.']].map(([title,text]) => <article key={title}><span><img src={assets.shield} alt=""/></span><h3>{title}</h3><p>{text}</p></article>)}</div></section>

      <section className="ph-section ph-faq" id="faq"><div className="ph-section-heading center"><Badge>Ofte stilte spørsmål</Badge><h2>Alt du trenger å vite</h2></div><div className="ph-faq-list">{faqs.map(([q,a],i)=><button key={q} className={faqOpen===i?'open':''} onClick={()=>setFaqOpen(faqOpen===i?null:i)} aria-expanded={faqOpen===i}><span>{q}<img src={assets.plus} alt=""/></span><p>{a}</p></button>)}</div></section>

      <section className="ph-section ph-final" id="download"><div className="ph-section-heading center"><Badge>Klar for KJAPP?</Badge><h2>Opplev fremtidens taxiplattform</h2></div><div className="ph-three-grid"><article><h3>For passasjerer</h3><Button href="#top">Last ned appen</Button></article><article><h3>For sjåfører</h3><Button href="#sjafor">Bli sjåfør</Button></article><article><h3>For løyvehavere</h3><Link className="ph-button" to="/loyvehaver/soknad">Registrer flåten</Link></article></div></section>

      <footer className="ph-footer"><div className="ph-footer-top"><div className="ph-footer-brand"><Brand/><p>Norges nye rettferdige transportplattform. Mer penger til sjåføren, bedre opplevelser for deg.</p></div><div><b>Passasjer</b><a href="#slik">Bestill tur</a><a href="#sikkerhet">Sikkerhet</a></div><div><b>Kjør med oss</b><a href="#sjafor">Bli sjåfør</a><a href="#sjafor">Sjåfør-app</a></div><div><b>Løyvehaver</b><Link to="/loyvehaver">Flåtestyring</Link><a href={FLEET_URL}>Logg inn</a></div><div><b>Selskap</b><a href="mailto:hei@kjappapp.no">Kontakt</a><a href="mailto:support@kjappapp.no">Support</a></div></div><div className="ph-footer-bottom"><span>© 2026 KJAPP. Alle rettigheter reservert.</span><span>Utviklet med ⚡ i Norge</span></div></footer>
      <a className="ph-sticky" href="#download">Last ned KJAPP</a>
    </main>
  );
}
