import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { setPageSeo } from './seo';
import './help.css';

const SUPPORT_EMAIL = 'support@kjappapp.no';

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
      title: 'SNAR Hjelp & support',
      description: 'Få hjelp med turer, betaling, konto, sjåfør- eller løyvehaverspørsmål. SNAR support svarer på support@kjappapp.no.',
      canonical: 'https://kjappapp.no/help',
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
      'Sendt fra kjappapp.no/help',
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

      <section className="help-emergency help-shell">
        <div><span>SIKKERHET</span><h2>Akutt situasjon?</h2></div>
        <p>Ved fare for liv eller helse skal du kontakte nødetatene direkte. Supportkanalen er for SNAR-saker og erstatter ikke nødnummer.</p>
      </section>

      <footer className="help-footer help-shell">
        <div><Wordmark /><p>Appen som kobler deg med selvstendige løyvehavere.</p></div>
        <nav><Link to="/">Forside</Link><Link to="/loyvehaver">Løyvehaver</Link><a href={`mailto:${SUPPORT_EMAIL}`}>support@kjappapp.no</a></nav>
        <span>© 2026 SNAR · NexoraHub AS</span>
      </footer>
    </main>
  );
}

