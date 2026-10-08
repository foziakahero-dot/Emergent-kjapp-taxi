import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { setPageSeo } from './seo';
import './help.css';

const SUPPORT_EMAIL = 'support@kjappapp.no';

const faq = [
  ['Hva er SNAR?', 'SNAR er en norsk mobilitetsplattform for enkel bestilling av persontransport. Du bestiller bil med sjåfør, følger sjåføren og betaler direkte i appen.'],
  ['Hvordan bestiller jeg en reise?', 'Velg hentested og destinasjon i appen. Se tilgjengelige biler, prisestimat og forventet hentetid før du bekrefter bestillingen.'],
  ['Ser jeg prisen før jeg bestiller?', 'Du ser et prisestimat før du bekrefter. Se prisinformasjonen i bestillingen for hva som gjelder for reisen din.'],
  ['Hvem kjører med SNAR?', 'Profesjonelle sjåfører med gyldig kjøreseddel, knyttet til godkjente løyvehavere. Tilgang til plattformen åpnes etter kontroll og godkjenning.'],
  ['Kan jeg følge sjåføren?', 'Når bestillingen er akseptert, ser du sjåføren, bilen og registreringsnummeret. Du kan følge sjåførens posisjon frem til hentestedet i sanntid.'],
  ['Hvordan betaler jeg?', 'Du betaler digitalt i appen. Tilgjengelige betalingsmåter vises når du bestiller.'],
  ['Kan jeg bruke SNAR nå?', 'SNAR starter med en avgrenset beta i Oslo. Meld interesse på forsiden. Vi kontakter deg når din testgruppe får tilgang.'],
  ['Hvordan blir jeg sjåfør eller løyvehaver på SNAR?', 'Sjåfører kan melde interesse på forsiden og må ha gyldig kjøreseddel. Løyvehavere søker med virksomhet, drosjeløyver og nødvendig dokumentasjon. Tilgang krever godkjenning.'],
];

const topics = [
  { value: 'tur', label: 'Tur eller bestilling' },
  { value: 'betaling', label: 'Betaling eller kvittering' },
  { value: 'konto', label: 'Konto eller innlogging' },
  { value: 'sjafor', label: 'Sjåfør' },
  { value: 'loyvehaver', label: 'Løyvehaver / Fleet' },
  { value: 'annet', label: 'Annet' },
];

function Wordmark() {
  return <Link className="help-wordmark" to="/" aria-label="SNAR forside"><span>SNAR</span></Link>;
}

export default function HelpPage() {
  const [params] = useSearchParams();
  const initialTopic = params.get('topic') || 'tur';
  const [topic, setTopic] = useState(topics.some((item) => item.value === initialTopic) ? initialTopic : 'tur');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setPageSeo({
      title: 'SNAR | Spørsmål, hjelp og support',
      description: 'Svar på spørsmål om SNAR, bestilling, prisestimat, sjåfører, betaling og Oslo-beta. Få hjelp som kunde, sjåfør eller løyvehaver.',
      canonical: 'https://snarapp.no/help',
    });
  }, []);

  const topicLabel = useMemo(() => topics.find((item) => item.value === topic)?.label || 'Annet', [topic]);

  const sendSupportEmail = (event: FormEvent) => {
    event.preventDefault();
    const subject = `[SNAR Support] ${topicLabel}`;
    const body = [
      `Kategori: ${topicLabel}`,
      `Navn: ${name || '-'}`,
      `Kontakt: ${contact || '-'}`,
      '',
      'Beskrivelse:',
      message || '-',
      '',
      'Sendt fra snarapp.no/help',
    ].join('\n');

    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <main className="help-page">
      <header className="help-header help-shell">
        <Wordmark />
        <nav aria-label="Hjelpemeny">
          <Link to="/">Forside</Link>
          <Link to="/loyvehaver">Løyvehaver</Link>
          <a href={`mailto:${SUPPORT_EMAIL}`}>E-post support</a>
          <a href="#faq">Spørsmål om SNAR</a>
        </nav>
      </header>

      <section className="help-hero help-shell">
        <div>
          <span className="help-kicker">SNAR SUPPORT</span>
          <h1>Hva kan vi<br />hjelpe deg med?</h1>
          <p>Velg hva saken gjelder og beskriv problemet. E-posten blir automatisk adressert til <strong>{SUPPORT_EMAIL}</strong>.</p>
        </div>
        <aside className="help-status">
          <span className="help-status-dot" />
          <div><small>SUPPORTKANAL</small><strong>{SUPPORT_EMAIL}</strong><p>For kunde-, sjåfør- og partnerhenvendelser.</p></div>
        </aside>
      </section>

      <section className="help-content help-shell">
        <div className="help-topics" aria-label="Supportkategorier">
          {topics.map((item, index) => (
            <button
              key={item.value}
              type="button"
              className={topic === item.value ? 'active' : ''}
              onClick={() => setTopic(item.value)}
            >
              <span>0{index + 1}</span>
              <strong>{item.label}</strong>
            </button>
          ))}
        </div>

        <form className="help-form" onSubmit={sendSupportEmail}>
          <div className="help-form-head">
            <span>NY SUPPORTSAK</span>
            <h2>Send til SNAR Support</h2>
            <p>Vi fyller inn mottaker og saksinformasjon automatisk. Du godkjenner og sender fra ditt eget e-postprogram.</p>
          </div>

          <label>
            <span>Kategori</span>
            <select value={topic} onChange={(event) => setTopic(event.target.value)}>
              {topics.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>

          <div className="help-form-row">
            <label><span>Navn</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ditt navn" autoComplete="name" /></label>
            <label><span>E-post eller telefon</span><input value={contact} onChange={(event) => setContact(event.target.value)} placeholder="Hvordan kan vi kontakte deg?" /></label>
          </div>

          <label>
            <span>Beskriv saken</span>
            <textarea required value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Fortell kort hva som har skjedd, gjerne med tur-ID eller annen relevant informasjon." rows={7} />
          </label>

          <button className="help-submit" type="submit">Åpne e-post til support →</button>
          <small className="help-form-note">Ingenting sendes uten at du selv trykker «Send» i e-postprogrammet ditt.</small>
        </form>
      </section>

      <section id="faq" className="help-content help-shell" aria-labelledby="faq-title">
        <div className="help-form-head">
          <span className="help-kicker">SPØRSMÅL OM SNAR</span>
          <h2 id="faq-title">Dette lurer mange på.</h2>
          <p>Om bestilling, reisen og hvordan du får tilgang.</p>
        </div>
        <div className="help-form">
          {faq.map(([question, answer]) => (
            <details key={question} className="help-form-head">
              <summary><h3>{question}</h3></summary>
              <p>{answer}</p>
            </details>
          ))}
          <Link to="/">Meld interesse for beta →</Link>
          <br />
          <Link to="/loyvehaver/soknad">Søk som løyvehaver →</Link>
        </div>
      </section>

      <section className="help-emergency help-shell">
        <div><span>SIKKERHET</span><h2>Akutt situasjon?</h2></div>
        <p>Ved fare for liv eller helse skal du kontakte nødetatene direkte. Supportkanalen er for SNAR-saker og erstatter ikke nødnummer.</p>
      </section>

      <footer className="help-footer help-shell">
        <div><Wordmark /><p>SNAR er en norsk mobilitetsplattform for enkel bestilling av persontransport.</p></div>
        <nav><Link to="/">Forside</Link><Link to="/loyvehaver">Løyvehaver</Link><a href={`mailto:${SUPPORT_EMAIL}`}>support@kjappapp.no</a></nav>
        <span>© 2026 SNAR · NexoraHub AS</span>
      </footer>
    </main>
  );
}

