import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { api, apiError, FleetMe, http } from './api';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
};

type SupportCategory = 'teknisk' | 'betaling' | 'dokumenter' | 'sjåfør' | 'annet';

const QUICK_PROMPTS = [
  'Hvor mange sjåfører er online akkurat nå?',
  'Hvilke dokumenter krever oppfølging?',
  'Forklar siste payout for flåten min.',
  'Hvilke biler har utløpt GPS-status?',
];

const categoryLabels: Record<SupportCategory, string> = {
  teknisk: 'Teknisk',
  betaling: 'Betaling',
  dokumenter: 'Dokumenter',
  sjåfør: 'Sjåfør',
  annet: 'Annet',
};

function makeSession(prefix: string, fleetId?: string) {
  const key = `snar_fleet_${prefix}_session`;
  const current = sessionStorage.getItem(key);
  if (current) return current;
  const created = `${prefix}_${fleetId || 'fleet'}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  sessionStorage.setItem(key, created);
  return created;
}

export function SupportAiPage() {
  const [tab, setTab] = useState<'ai' | 'support'>('ai');
  const [fleet, setFleet] = useState<FleetMe | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [supportCategory, setSupportCategory] = useState<SupportCategory>('teknisk');
  const [supportSubject, setSupportSubject] = useState('');
  const [supportBody, setSupportBody] = useState('');
  const [supportSent, setSupportSent] = useState(false);
  const [supportSending, setSupportSending] = useState(false);
  const aiSession = useMemo(() => makeSession('ai', fleet?.id), [fleet?.id]);
  const supportSession = useMemo(() => makeSession('support', fleet?.id), [fleet?.id]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    api.fleetMe().then(setFleet).catch(() => setFleet(null));
  }, []);

  useEffect(() => {
    http.get('/ai/history', { params: { session_id: aiSession } })
      .then((r) => setMessages(Array.isArray(r.data?.messages) ? r.data.messages : []))
      .catch(() => {});
  }, [aiSession]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  const sendAi = async (text: string) => {
    const clean = text.trim();
    if (!clean || sending) return;
    setSending(true);
    setError('');
    setMessages((prev) => [...prev, { role: 'user', content: clean }]);
    setMessage('');
    try {
      const result = await http.post('/ai/chat', { message: clean, session_id: aiSession }).then((r) => r.data);
      setMessages((prev) => [...prev, { role: 'assistant', content: result?.reply || 'Jeg fikk ikke et svar akkurat nå.' }]);
    } catch (e) {
      setError(apiError(e));
      setMessages((prev) => [...prev, { role: 'assistant', content: 'SNAR AI er midlertidig utilgjengelig. Prøv igjen om litt.' }]);
    } finally {
      setSending(false);
    }
  };

  const submitAi = (event: FormEvent) => {
    event.preventDefault();
    void sendAi(message);
  };

  const submitSupport = async (event: FormEvent) => {
    event.preventDefault();
    if (!supportSubject.trim() || !supportBody.trim() || supportSending) return;
    setSupportSending(true);
    setSupportSent(false);
    setError('');
    const structured = [
      '[FLEET_SUPPORT]',
      `Kategori: ${categoryLabels[supportCategory]}`,
      `Emne: ${supportSubject.trim()}`,
      `Flåte: ${fleet?.name || 'Ukjent'}${fleet?.org_number ? ` (${fleet.org_number})` : ''}`,
      `Kontakt: ${fleet?.contact_email || 'Ikke registrert'}`,
      '',
      supportBody.trim(),
    ].join('\n');
    try {
      // Reuse the authenticated SNAR conversation backend so the message is persisted
      // under the fleet owner's account instead of creating a parallel data store.
      await http.post('/ai/chat', { message: structured, session_id: supportSession });
      setSupportSent(true);
      setSupportSubject('');
      setSupportBody('');
    } catch (e) {
      setError(apiError(e));
    } finally {
      setSupportSending(false);
    }
  };

  return <div className="figma-page support-ai-page">
    <div className="figma-page-head">
      <div>
        <span className="figma-kicker">MELDINGER</span>
        <h1>SNAR AI & support</h1>
        <p>Spør om flåten din eller send en melding til SNAR fra samme arbeidsflate.</p>
      </div>
      <div className="figma-head-status"><i /> System online</div>
    </div>

    <div className="figma-tabs" role="tablist">
      <button className={tab === 'ai' ? 'active' : ''} onClick={() => setTab('ai')}>✦ SNAR AI</button>
      <button className={tab === 'support' ? 'active' : ''} onClick={() => setTab('support')}>Meld SNAR</button>
    </div>

    {tab === 'ai' ? <div className="support-ai-layout">
      <section className="figma-card ai-chat-card">
        <div className="ai-chat-head">
          <div className="ai-orb">✦</div>
          <div><strong>SNAR AI</strong><span>Assistent for drift og flåte</span></div>
          <span className="ai-live"><i /> Online</span>
        </div>
        <div className="ai-messages" ref={scrollRef}>
          {!messages.length ? <div className="ai-welcome">
            <div className="ai-orb large">✦</div>
            <h2>Hva vil du vite om flåten?</h2>
            <p>Bruk SNAR AI for raske forklaringer og hjelp. Kritiske handlinger skal fortsatt bekreftes av deg.</p>
          </div> : null}
          {messages.map((item, index) => <div key={`${item.role}-${index}`} className={`ai-message ${item.role}`}>
            <span>{item.content}</span>
          </div>)}
          {sending ? <div className="ai-message assistant typing"><b /><b /><b /></div> : null}
        </div>
        <form className="ai-composer" onSubmit={submitAi}>
          <textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Skriv til SNAR AI…" />
          <button type="submit" disabled={sending || !message.trim()}>Send</button>
        </form>
      </section>

      <aside className="figma-card ai-side-card">
        <span className="figma-kicker">FORSLAG</span>
        <h2>Spør om driften</h2>
        <div className="ai-prompts">
          {QUICK_PROMPTS.map((prompt) => <button key={prompt} onClick={() => void sendAi(prompt)}>{prompt}<span>→</span></button>)}
        </div>
        <div className="ai-safety-note"><strong>Handlinger krever bekreftelse</strong><p>SNAR AI skal ikke deaktivere sjåfører, endre utbetaling eller gjøre andre sensitive handlinger automatisk.</p></div>
      </aside>
    </div> : null}

    {tab === 'support' ? <div className="support-contact-layout">
      <form className="figma-card support-form-card" onSubmit={submitSupport}>
        <span className="figma-kicker">KONTAKT SNAR</span>
        <h2>Send melding til oss</h2>
        <p className="figma-muted">Meldingen lagres i den autentiserte SNAR-samtalen for flåtekontoen.</p>
        <div className="support-form-grid">
          <label>Kategori<select value={supportCategory} onChange={(e) => setSupportCategory(e.target.value as SupportCategory)}>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Flåte<input value={fleet?.name || 'SNAR Fleet'} readOnly /></label>
        </div>
        <label>Emne<input value={supportSubject} onChange={(e) => setSupportSubject(e.target.value)} placeholder="Kort beskrivelse" maxLength={120} required /></label>
        <label>Melding<textarea rows={8} value={supportBody} onChange={(e) => setSupportBody(e.target.value)} placeholder="Beskriv hva du trenger hjelp med…" maxLength={3000} required /></label>
        {supportSent ? <div className="support-success">✓ Meldingen er registrert i SNAR-systemet.</div> : null}
        {error ? <div className="figma-error">{error}</div> : null}
        <div className="support-form-actions"><span>{fleet?.contact_email || 'Kontakt-e-post ikke registrert'}</span><button type="submit" disabled={supportSending}>{supportSending ? 'Sender…' : 'Send til SNAR'}</button></div>
      </form>

      <aside className="figma-card support-meta-card">
        <span className="figma-kicker">STATUS</span>
        <h2>Flåtekonto</h2>
        <dl>
          <div><dt>Firma</dt><dd>{fleet?.name || '—'}</dd></div>
          <div><dt>Org.nr</dt><dd>{fleet?.org_number || '—'}</dd></div>
          <div><dt>Status</dt><dd><span className="figma-status good">Aktiv</span></dd></div>
          <div><dt>Kanal</dt><dd>Autentisert Fleet</dd></div>
        </dl>
        <div className="support-note"><strong>Ved kritiske hendelser</strong><p>Bruk ordinære nød- og sikkerhetsrutiner. Denne meldingsflaten erstatter ikke 112 eller akutt varsling.</p></div>
      </aside>
    </div> : null}
  </div>;
}

export default SupportAiPage;
