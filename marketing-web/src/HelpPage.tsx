import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { setPageSeo } from './seo';
import { createPublicSupportTicket } from './api';
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
  return <Link className="help-wordmark" to="/" aria-label="KJAPP forside"><span>KJ</span><em>A</em><span>PP</span></Link>;
}

export default function HelpPage() {
  const [params] = useSearchParams();
  const initialTopic = params.get('topic') || 'tur';
  const [topic, setTopic] = useState(topics.some((item) => item.value === initialTopic) ? initialTopic : 'tur');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [contactError, setContactError] = useState('');
  const [sending, setSending] = useState(false);
  const [sentTicketId, setSentTicketId] = useState('');
  const [sendError, setSendError] = useState('');

  useEffect(() => {
    setPageSeo({
      title: 'KJAPP Hjelp & support',
      description: 'Få hjelp med turer, betaling, konto, sjåfør- eller løyvehaverspørsmål. KJAPP support svarer på support@kjappapp.no.',
      canonical: 'https://kjappapp.no/help',
    });
  }, []);

  const topicLabel = useMemo(() => topics.find((item) => item.value === topic)?.label || 'Annet', [topic]);

  const submitSupport = async (event: FormEvent) => {
    event.preventDefault();
    setContactError('');
    setSendError('');
    setSentTicketId('');
    if (contact.trim().length < 3) {
      setContactError('Skriv inn e-post eller telefon slik at support kan svare deg.');
      return;
    }
    if (message.trim().length < 10) {
      setSendError('Beskriv saken med minst 10 tegn.');
      return;
    }
    setSending(true);
    try {
      const result = await createPublicSupportTicket({
        topic: topic as any,
        name: name.trim() || undefined,
        contact: contact.trim(),
        message: message.trim(),
      });
      setSentTicketId(result.ticket_id || '');
      setMessage('');
    } catch (error: any) {
      setSendError(error?.message || 'Kunne ikke sende supportsaken. Prøv igjen eller bruk e-post.');
    } finally {
      setSending(false);
    }
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
          <span className="help-kicker">KJAPP SUPPORT</span>
          <h1>Hva kan vi<br />hjelpe deg med?</h1>
          <p>Velg hva saken gjelder og beskriv problemet. Saken går direkte til KJAPP Support og kan følges opp i operatørpanelet.</p>
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

        <form className="help-form" onSubmit={submitSupport}>
          <div className="help-form-head">
            <span>NY SUPPORTSAK</span>
            <h2>Send til KJAPP Support</h2>
            <p>Saken registreres direkte hos KJAPP Support. Ikke legg inn kortnummer, passord eller andre hemmeligheter.</p>
          </div>

          <label>
            <span>Kategori</span>
            <select value={topic} onChange={(event) => setTopic(event.target.value)}>
              {topics.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>

          <div className="help-form-row">
            <label><span>Navn</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ditt navn" autoComplete="name" /></label>
            <label>
              <span>E-post eller telefon</span>
              <input required value={contact} onChange={(event) => setContact(event.target.value)} placeholder="Hvordan kan vi kontakte deg?" />
              {contactError ? <small style={{ color: '#ff6b6b' }}>{contactError}</small> : null}
            </label>
          </div>

          <label>
            <span>Beskriv saken</span>
            <textarea required value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Fortell kort hva som har skjedd, gjerne med tur-ID eller annen relevant informasjon." rows={7} />
          </label>

          <button className="help-submit" type="submit" disabled={sending}>{sending ? 'Sender…' : 'Send supportsak →'}</button>
          {sentTicketId ? <small className="help-form-note" style={{ color: '#2dd4bf' }}>Supportsaken er registrert. Referanse: {sentTicketId.slice(0, 8)}.</small> : null}
          {sendError ? <small className="help-form-note" style={{ color: '#ff6b6b' }}>{sendError} <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: 'inherit' }}>Send e-post</a></small> : null}
          {!sentTicketId && !sendError ? <small className="help-form-note">Ved tekniske problemer kan du også sende e-post til {SUPPORT_EMAIL}.</small> : null}
        </form>
      </section>

      <section className="help-emergency help-shell">
        <div><span>SIKKERHET</span><h2>Akutt situasjon?</h2></div>
        <p>Ved fare for liv eller helse skal du kontakte nødetatene direkte. Supportkanalen er for KJAPP-saker og erstatter ikke nødnummer.</p>
      </section>

      <footer className="help-footer help-shell">
        <div><Wordmark /><p>Norsk taxi. Uten omveier.</p></div>
        <nav><Link to="/">Forside</Link><Link to="/loyvehaver">Løyvehaver</Link><a href={`mailto:${SUPPORT_EMAIL}`}>support@kjappapp.no</a></nav>
        <span>© 2026 KJAPP · NexoraHub AS</span>
      </footer>
    </main>
  );
}
