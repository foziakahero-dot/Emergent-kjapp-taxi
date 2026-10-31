import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { createFleetDraft, submitFleetApplication, uploadFleetDocument, type FleetDraft, type UploadedDocument } from './api';
import { useServiceFee, serviceFeeLabel } from './platformConfig';
import { FLEET_URL } from './siteConfig';

const EMAILS = {
  support: 'support@kjappapp.no',
  fleet: 'fleet@kjappapp.no',
  partner: 'partner@kjappapp.no',
};

const REQUIRED_DOCS = [
  { key: 'firmaattest', label: 'Firmaattest', detail: 'Fra Brønnøysundregistrene' },
  { key: 'loyvebevis', label: 'Løyvebevis', detail: 'Alle aktive drosjeløyver · samle i én PDF hvis du har flere' },
  { key: 'vognkort', label: 'Vognkort', detail: 'Vognkort for alle biler · samle i én PDF hvis du har flere' },
  { key: 'forsikring', label: 'Forsikringsdokumentasjon', detail: 'Gyldig forsikringsbevis for alle biler' },
  { key: 'bank', label: 'Bankdokumentasjon', detail: 'Kontobekreftelse som viser bedriftens bankkonto' },
] as const;

type FormState = Omit<FleetDraft, 'license_count' | 'vehicle_count'> & {
  license_count: number | '';
  vehicle_count: number | '';
};

const INITIAL: FormState = {
  company_name: '',
  org_number: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  license_count: '',
  vehicle_count: '',
  bank_account: '',
  notes: '',
  accepted_terms: false,
};

export function ApplyPage() {
  const serviceFee = useServiceFee();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [token, setToken] = useState('');
  const [docs, setDocs] = useState<Record<string, UploadedDocument>>({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'SNAR Partner — løyvehaversøknad';
    const description = 'Søk om å bli SNAR-partner. Last opp firmaattest, løyvebevis, vognkort, forsikring og bankdokumentasjon før Fleet-tilgang aktiveres.';
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', description);
  }, []);

  const completed = useMemo(() => REQUIRED_DOCS.filter((d) => docs[d.key]).length, [docs]);
  const update = (key: keyof FormState, value: any) => setForm((f) => ({ ...f, [key]: value }));

  async function next() {
    setError('');
    if (!form.company_name.trim() || !form.org_number.trim() || !form.contact_name.trim() || !form.contact_email.trim() || !form.contact_phone.trim()) {
      setError('Fyll ut firmanavn, organisasjonsnummer, kontaktperson, e-post og telefon.');
      return;
    }
    if (!form.license_count || !form.vehicle_count) {
      setError('Oppgi antall løyver og antall biler.');
      return;
    }
    if (!String(form.bank_account || '').trim()) {
      setError('Bankkonto må fylles ut før du går videre.');
      return;
    }
    if (!form.accepted_terms) {
      setError('Godta partnervilkårene og personvernerklæringen før du fortsetter.');
      return;
    }
    setBusy(true);
    try {
      const result = await createFleetDraft({
        ...form,
        license_count: Number(form.license_count),
        vehicle_count: Number(form.vehicle_count),
      });
      setToken(result.upload_token);
      setStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      setError(e?.message || 'Kunne ikke opprette søknaden.');
    } finally {
      setBusy(false);
    }
  }

  async function upload(key: string, file: File) {
    if (!token) return;
    setUploading(key);
    setError('');
    try {
      const out = await uploadFleetDocument(file, token);
      setDocs((d) => ({
        ...d,
        [key]: {
          path: out.storage_path,
          original_filename: out.original_filename,
          content_type: out.content_type,
        },
      }));
    } catch (e: any) {
      setError(e?.message || 'Dokumentopplasting feilet.');
    } finally {
      setUploading(null);
    }
  }

  async function submit() {
    setError('');
    const missing = REQUIRED_DOCS.filter((d) => !docs[d.key]);
    if (missing.length) {
      setError(`Mangler: ${missing.map((d) => d.label).join(', ')}`);
      return;
    }
    setBusy(true);
    try {
      await submitFleetApplication(token, docs);
      setStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      setError(e?.message || 'Kunne ikke sende inn søknaden.');
    } finally {
      setBusy(false);
    }
  }

  if (step === 3) return <Submitted email={form.contact_email} />;

  return (
    <main className="apply2-page">
      <ApplyStyles />
      <header className="apply2-header apply2-shell">
        <Link to="/" className="apply2-wordmark" aria-label="SNAR forside"><span>SNAR</span></Link>
        <nav aria-label="Søknadsmeny">
          <Link to="/">Forside</Link>
          <Link to="/loyvehaver">Løyvehavere</Link>
          <a href={FLEET_URL}>Fleet Panel</a>
          <a href={`mailto:${EMAILS.partner}`}>Kontakt</a>
        </nav>
      </header>

      <section className="apply2-hero apply2-shell">
        <div className="apply2-hero-copy">
          <div className="apply2-eyebrow">SNAR PARTNER · STEG {step} AV 2</div>
          <h1>{step === 1 ? 'Søk om Fleet-tilgang.' : 'Last opp dokumentasjonen.'}</h1>
          <p>{step === 1
            ? 'Søk med virksomheten, drosjeløyvene og bilene dine. Tilgang til SNAR Fleet åpnes etter at dokumentasjonen er kontrollert og godkjent.'
            : 'Alle fem dokumenttyper må være klare før søknaden sendes videre til manuell kontroll.'}</p>
          <div className="apply2-trust-row">
            <span>{serviceFeeLabel(serviceFee)}</span>
            <span>Din egen virksomhet</span>
            <span>Ukentlig digitalt oppgjør</span>
          </div>
        </div>
        <aside className="apply2-side-card" aria-label="SNAR partnermodell">
          <div className="apply2-side-top"><span>SNAR</span><strong>Partner</strong></div>
          <div className="apply2-rate">{serviceFee === null ? '—' : `${new Intl.NumberFormat('nb-NO', {maximumFractionDigits:2}).format(serviceFee)}%`}</div>
          <p>Standard serviceavgift for plattformen. Din avtalte sats vises i Fleet. Oppgjør går gjennom Stripe etter bekreftelse av konto og bank.</p>
          <div className="apply2-side-lines"><span>Søknad</span><span>Dokumentasjon</span><span>Kontroll</span><span>Fleet</span></div>
        </aside>
      </section>

      <section className="apply2-content apply2-shell">
        <div className="apply2-panel">
          <div className="apply2-panel-head">
            <div>
              <span>SØKNADSSKJEMA</span>
              <h2>{step === 1 ? 'Virksomhet og kontakt' : 'Dokumenter som må godkjennes'}</h2>
            </div>
            <div className="apply2-progress"><strong>{step === 1 ? '01' : '02'}</strong><span>/ 02</span></div>
          </div>

          {error ? <div className="apply2-error" role="alert">{error}</div> : null}

          {step === 1 ? (
            <>
              <div className="apply2-grid">
                <Field label="Firmanavn" value={form.company_name} onChange={(v) => update('company_name', v)} />
                <Field label="E-post" type="email" value={form.contact_email} onChange={(v) => update('contact_email', v)} />
                <Field label="Organisasjonsnummer" value={form.org_number} onChange={(v) => update('org_number', v)} inputMode="numeric" />
                <Field label="Telefon" type="tel" value={form.contact_phone} onChange={(v) => update('contact_phone', v)} />
                <Field label="Kontaktperson" value={form.contact_name} onChange={(v) => update('contact_name', v)} />
                <div className="apply2-split">
                  <Field label="Antall løyver" type="number" min="1" value={form.license_count} onChange={(v) => update('license_count', v ? Number(v) : '')} />
                  <Field label="Antall biler" type="number" min="1" value={form.vehicle_count} onChange={(v) => update('vehicle_count', v ? Number(v) : '')} />
                </div>
                <Field label="Norsk bankkonto (11 sifre eller norsk IBAN) *" value={form.bank_account || ''} onChange={(v) => update('bank_account', v)} />
                <label className="apply2-field"><span>Kort notat (valgfritt)</span><textarea rows={4} value={form.notes || ''} onChange={(e) => update('notes', e.target.value)} placeholder="Kort om virksomheten, flåten eller ønsket oppstart" /></label>
              </div>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 24, fontSize: 14 }}>
                <input type="checkbox" checked={form.accepted_terms} onChange={(e) => update('accepted_terms', e.target.checked)} />
                <span>Jeg godtar <Link to="/vilkar" target="_blank" rel="noopener noreferrer">partner-/plattformvilkårene</Link> og <Link to="/personvern" target="_blank" rel="noopener noreferrer">personvernerklæringen</Link>.</span>
              </label>
              <div className="apply2-bottom">
                <span>Tilgang opprettes først etter manuell partnerkontroll.</span>
                <button className="apply2-button apply2-primary" disabled={busy || !form.accepted_terms} onClick={next}>{busy ? 'Oppretter…' : 'Neste · dokumenter'}</button>
              </div>
            </>
          ) : (
            <>
              <div className="apply2-doc-list">
                {REQUIRED_DOCS.map((doc) => <DocumentRow key={doc.key} doc={doc} value={docs[doc.key]} busy={uploading === doc.key} onUpload={(file) => upload(doc.key, file)} onRemove={() => setDocs((current) => { const next = { ...current }; delete next[doc.key]; return next; })} />)}
              </div>
              <div className="apply2-bottom apply2-bottom-docs">
                <button className="apply2-text-button" onClick={() => setStep(1)}>← Tilbake</button>
                <span>{completed}/5 dokumenter klare</span>
                <button className="apply2-button apply2-primary" disabled={busy || completed !== 5} onClick={submit}>{busy ? 'Sender…' : 'Send til godkjenning'}</button>
              </div>
            </>
          )}
        </div>

        <aside className="apply2-info-stack">
          <article>
            <span>01</span>
            <h3>Send søknad</h3>
            <p>Firma, kontaktperson, løyver og biler registreres først.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Last opp dokumenter</h3>
            <p>Firmaattest, alle løyvebevis, vognkort for alle biler, forsikring for bilene og bankgrunnlag.</p>
          </article>
          <article>
            <span>03</span>
            <h3>SNAR kontrollerer</h3>
            <p>SNAR kontrollerer dokumentasjonen før Fleet-tilgang åpnes.</p>
          </article>
          <article className="apply2-info-highlight">
            <h3>Trenger du hjelp?</h3>
            <p>Kontakt partnerteamet hvis noe stopper i søknaden.</p>
            <a href={`mailto:${EMAILS.partner}`}>{EMAILS.partner}</a>
          </article>
        </aside>
      </section>
    </main>
  );
}

function Field(props: { label: string; value: string | number; onChange: (v: string) => void; type?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']; min?: string }) {
  return <label className="apply2-field"><span>{props.label}</span><input type={props.type || 'text'} value={props.value} inputMode={props.inputMode} min={props.min} onChange={(e) => props.onChange(e.target.value)} /></label>;
}

function DocumentRow({ doc, value, busy, onUpload, onRemove }: { doc: { key: string; label: string; detail: string }; value?: UploadedDocument; busy: boolean; onUpload: (file: File) => void; onRemove: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className={`apply2-doc-row ${value ? 'is-complete' : ''}`}>
      <div className="apply2-doc-state">{value ? '✓' : '—'}</div>
      <div className="apply2-doc-copy"><strong>{doc.label}</strong><span>{value?.original_filename || doc.detail}</span></div>
      {value ? <button className="apply2-text-button" onClick={onRemove}>Fjern</button> : <button className="apply2-button apply2-secondary" disabled={busy} onClick={() => ref.current?.click()}>{busy ? 'Laster…' : 'Last opp'}</button>}
      <input ref={ref} className="apply2-hidden-input" type="file" accept="application/pdf,image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) onUpload(file); e.currentTarget.value = ''; }} />
    </div>
  );
}

function Submitted({ email }: { email: string }) {
  useEffect(() => {
    document.title = 'SNAR Partner — søknad mottatt';
  }, []);

  return (
    <main className="apply2-page apply2-submitted-page">
      <ApplyStyles />
      <div className="apply2-submitted-card">
        <div className="apply2-success-ring">✓</div>
        <div className="apply2-eyebrow">SØKNAD MOTTATT</div>
        <h1>Venter på godkjenning.</h1>
        <p>SNAR går gjennom virksomheten og dokumentasjonen. Du får tilgang til SNAR Fleet etter at søknaden er godkjent.</p>
        <div className="apply2-submitted-email">Svar sendes til <strong>{email}</strong></div>
        <div className="apply2-submitted-actions"><Link className="apply2-button apply2-primary" to="/">Til forsiden</Link><Link className="apply2-button apply2-secondary" to="/loyvehaver">Om SNAR Partner</Link><a className="apply2-button apply2-secondary" href={FLEET_URL}>Fleet Panel</a></div>
      </div>
    </main>
  );
}

function ApplyStyles() {
  return <style>{`
    .apply2-page{--bg:var(--snar-bg);--panel:var(--snar-surface);--panel2:var(--snar-subtle);--line:var(--snar-line);--text:var(--snar-navy);--copy:var(--snar-secondary);--muted:var(--snar-secondary);--accent:var(--snar-red-deep);--ok:#178346;min-height:100vh;background:var(--bg);color:var(--text);font-family:Inter,system-ui,sans-serif;overflow-x:hidden}.apply2-page *{box-sizing:border-box}.apply2-page a{color:inherit;text-decoration:none}.apply2-page button,.apply2-page input,.apply2-page textarea{font:inherit}.apply2-shell{width:min(1240px,calc(100% - 80px));margin-inline:auto}.apply2-header{height:88px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between}.apply2-wordmark{display:inline-flex;align-items:baseline;font-size:24px;line-height:1;font-weight:600;letter-spacing:-.055em}.apply2-wordmark em{color:var(--accent);font-style:normal}.apply2-header nav{display:flex;gap:26px;align-items:center;color:var(--copy);font-size:13px;font-weight:700}.apply2-header nav a:hover{color:var(--accent)}.apply2-eyebrow{display:inline-flex;border:1px solid var(--accent);border-radius:999px;padding:7px 12px;color:var(--accent);font-size:10px;font-weight:600;letter-spacing:.06em}.apply2-hero{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:88px;align-items:center;min-height:540px;padding:72px 0 58px}.apply2-hero h1{margin:30px 0 0;font-size:68px;line-height:1.02;letter-spacing:-.055em;font-weight:600}.apply2-hero p{max-width:660px;margin:24px 0 0;color:var(--copy);font-size:18px;line-height:1.55}.apply2-trust-row{display:flex;flex-wrap:wrap;gap:10px;margin-top:30px}.apply2-trust-row span{border:1px solid rgba(255,0,0,.24);background:rgba(255,0,0,.07);border-radius:999px;padding:10px 13px;color:var(--copy);font-size:12px;font-weight:800}.apply2-side-card{min-height:390px;border:1px solid var(--line);border-radius:28px;background:var(--panel);padding:34px;box-shadow:none;position:relative;overflow:hidden}.apply2-side-card:before{content:'';position:absolute;inset:-35% -20% auto auto;width:250px;height:250px;border-radius:50%;background:rgba(255,0,0,.13);filter:blur(20px)}.apply2-side-top{position:relative;display:flex;justify-content:space-between;align-items:center}.apply2-side-top span{color:var(--accent);font-size:11px;font-weight:600;letter-spacing:.08em}.apply2-side-top strong{font-size:12px;color:var(--copy)}.apply2-rate{position:relative;color:var(--accent);font-size:92px;font-weight:600;line-height:1;margin-top:52px;letter-spacing:-.07em}.apply2-side-card p{position:relative;color:var(--copy);font-size:14px;line-height:1.55;margin:18px 0 0}.apply2-side-lines{position:relative;display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:34px}.apply2-side-lines span{border:1px solid var(--line);border-radius:12px;padding:11px 12px;color:var(--copy);font-size:11px;font-weight:800}.apply2-content{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:32px;align-items:start;padding:30px 0 96px}.apply2-panel{border:1px solid var(--line);border-radius:30px;background:var(--panel);padding:34px;box-shadow:none}.apply2-panel-head{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;border-bottom:1px solid var(--line);padding-bottom:28px;margin-bottom:32px}.apply2-panel-head span{display:block;color:var(--accent);font-size:10px;font-weight:600;letter-spacing:.08em}.apply2-panel-head h2{margin:12px 0 0;font-size:30px;line-height:1.1;letter-spacing:-.035em}.apply2-progress strong{font-size:32px;color:var(--accent)}.apply2-progress span{color:var(--muted);font-weight:800}.apply2-error{margin-bottom:24px;padding:14px 16px;border-radius:14px;background:rgba(239,68,68,.09);border:1px solid rgba(239,68,68,.28);color:#9f1414;font-size:14px}.apply2-grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}.apply2-field{display:flex;flex-direction:column;gap:9px}.apply2-field>span{color:var(--muted);font-size:11px;font-weight:800}.apply2-field input,.apply2-field textarea{width:100%;border-radius:14px;border:1px solid var(--line);background:var(--panel);color:var(--text);padding:15px 16px;outline:0}.apply2-field input{height:54px}.apply2-field textarea{min-height:112px;resize:vertical}.apply2-field input:focus,.apply2-field textarea:focus{border-color:rgba(255,0,0,.75);box-shadow:0 0 0 3px rgba(255,0,0,.09)}.apply2-split{display:grid;grid-template-columns:1fr 1fr;gap:16px}.apply2-bottom{display:flex;align-items:center;justify-content:space-between;gap:18px;border-top:1px solid var(--line);margin-top:34px;padding-top:26px}.apply2-bottom>span{color:var(--muted);font-size:13px}.apply2-button{min-height:48px;border-radius:999px;border:1px solid var(--line);padding:0 20px;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;cursor:pointer;transition:transform .18s ease,border-color .18s ease,background .18s ease}.apply2-button:hover:not(:disabled){transform:translateY(-1px)}.apply2-button:disabled{opacity:.55;cursor:wait}.apply2-primary{background:var(--accent);border-color:var(--accent);color:white!important;box-shadow:0 10px 30px rgba(255,0,0,.12)}.apply2-secondary{background:var(--panel);color:var(--text)!important}.apply2-secondary:hover:not(:disabled){border-color:var(--copy)}.apply2-text-button{border:0;background:transparent;color:var(--accent);font-size:13px;font-weight:600;cursor:pointer}.apply2-info-stack{display:grid;gap:14px}.apply2-info-stack article{border:1px solid var(--line);border-radius:20px;background:var(--panel);padding:22px}.apply2-info-stack article>span{color:var(--accent);font-size:12px;font-weight:600}.apply2-info-stack h3{margin:16px 0 0;font-size:18px}.apply2-info-stack p{margin:10px 0 0;color:var(--muted);font-size:13px;line-height:1.5}.apply2-info-highlight{background:var(--snar-red-soft)!important}.apply2-info-highlight a{display:inline-flex;margin-top:14px;color:var(--accent);font-size:13px;font-weight:600}.apply2-doc-list{display:grid;gap:14px}.apply2-doc-row{min-height:82px;border:1px solid var(--line);border-radius:18px;background:var(--panel);display:grid;grid-template-columns:38px 1fr auto;gap:16px;align-items:center;padding:16px}.apply2-doc-row.is-complete{border-color:rgba(52,211,153,.45);background:rgba(52,211,153,.045)}.apply2-doc-state{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;border:1px solid var(--line);color:var(--muted);font-weight:600}.apply2-doc-row.is-complete .apply2-doc-state{border-color:rgba(52,211,153,.65);color:var(--ok)}.apply2-doc-copy strong,.apply2-doc-copy span{display:block}.apply2-doc-copy strong{font-size:15px}.apply2-doc-copy span{margin-top:4px;color:var(--muted);font-size:12px}.apply2-hidden-input{display:none}.apply2-bottom-docs{align-items:center}.apply2-submitted-page{display:grid;place-items:center;padding:40px 20px}.apply2-submitted-card{width:min(760px,100%);border:1px solid var(--line);border-radius:32px;background:var(--panel);padding:52px;text-align:center;box-shadow:none}.apply2-success-ring{width:72px;height:72px;border-radius:50%;margin:0 auto 26px;display:grid;place-items:center;border:1px solid rgba(52,211,153,.55);color:var(--ok);font-size:34px;font-weight:600;background:rgba(52,211,153,.08)}.apply2-submitted-card h1{margin:28px 0 0;font-size:54px;letter-spacing:-.05em;line-height:1.02}.apply2-submitted-card p{margin:22px auto 0;max-width:560px;color:var(--copy);line-height:1.6}.apply2-submitted-email{margin:28px auto 0;padding:15px 18px;border:1px solid var(--line);border-radius:14px;width:max-content;max-width:100%;color:var(--muted)}.apply2-submitted-email strong{color:var(--text)}.apply2-submitted-actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:32px}@media(max-width:900px){.apply2-shell{width:calc(100% - 40px)}.apply2-header{height:auto;min-height:70px;align-items:flex-start;padding:22px 0;gap:18px;flex-direction:column}.apply2-header nav{flex-wrap:wrap;gap:14px 20px;font-size:12px}.apply2-hero{display:block;min-height:auto;padding:42px 0 40px}.apply2-hero h1{font-size:42px;margin-top:24px}.apply2-hero p{font-size:16px}.apply2-side-card{margin-top:34px;min-height:310px;padding:26px}.apply2-rate{font-size:70px;margin-top:38px}.apply2-content{display:block;padding-bottom:70px}.apply2-panel{padding:22px;border-radius:24px}.apply2-panel-head{align-items:flex-start}.apply2-panel-head h2{font-size:25px}.apply2-grid{grid-template-columns:1fr;gap:18px}.apply2-split{grid-template-columns:1fr 1fr}.apply2-bottom{align-items:stretch;flex-direction:column}.apply2-bottom .apply2-button{width:100%}.apply2-info-stack{margin-top:24px}.apply2-doc-row{grid-template-columns:34px 1fr;gap:12px}.apply2-doc-row .apply2-button,.apply2-doc-row .apply2-text-button{grid-column:1/-1;width:100%}.apply2-submitted-card{padding:34px 22px}.apply2-submitted-card h1{font-size:38px}.apply2-submitted-email{width:100%}.apply2-submitted-actions{display:grid}.apply2-submitted-actions .apply2-button{width:100%}}
  `}</style>;
}


