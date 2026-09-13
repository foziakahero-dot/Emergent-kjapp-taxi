import React, { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { createFleetDraft, submitFleetApplication, uploadFleetDocument, type FleetDraft, type UploadedDocument } from './api';

const REQUIRED_DOCS = [
  { key: 'firmaattest', label: 'Firmaattest', detail: 'Fra Brønnøysundregistrene' },
  { key: 'loyvebevis', label: 'Løyvebevis', detail: 'Gyldig drosjeløyve' },
  { key: 'vognkort', label: 'Vognkort', detail: 'For bilene som skal kobles til KJAPP' },
  { key: 'forsikring', label: 'Forsikringsdokumentasjon', detail: 'Gyldig forsikringsbevis' },
  { key: 'bank', label: 'Bankdokumentasjon', detail: 'For utbetalinger' },
] as const;

type FormState = Omit<FleetDraft, 'license_count' | 'vehicle_count'> & { license_count: number | ''; vehicle_count: number | '' };

const INITIAL: FormState = {
  company_name: '', org_number: '', contact_name: '', contact_email: '', contact_phone: '',
  license_count: '', vehicle_count: '', bank_account: '', notes: '',
};

export function ApplyPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [token, setToken] = useState('');
  const [docs, setDocs] = useState<Record<string, UploadedDocument>>({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const completed = useMemo(() => REQUIRED_DOCS.filter((d) => docs[d.key]).length, [docs]);
  const update = (key: keyof FormState, value: any) => setForm((f) => ({ ...f, [key]: value }));

  async function next() {
    setError('');
    if (!form.company_name.trim() || !form.org_number.trim() || !form.contact_name.trim() || !form.contact_email.trim() || !form.contact_phone.trim()) {
      setError('Fyll ut firmanavn, organisasjonsnummer, kontaktperson, e-post og telefon.'); return;
    }
    if (!form.license_count || !form.vehicle_count) { setError('Oppgi antall løyver og antall biler.'); return; }
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
    } catch (e: any) { setError(e?.message || 'Kunne ikke opprette søknaden.'); }
    finally { setBusy(false); }
  }

  async function upload(key: string, file: File) {
    if (!token) return;
    setUploading(key); setError('');
    try {
      const out = await uploadFleetDocument(file, token);
      setDocs((d) => ({ ...d, [key]: { path: out.storage_path, original_filename: out.original_filename, content_type: out.content_type } }));
    } catch (e: any) { setError(e?.message || 'Dokumentopplasting feilet.'); }
    finally { setUploading(null); }
  }

  async function submit() {
    setError('');
    const missing = REQUIRED_DOCS.filter((d) => !docs[d.key]);
    if (missing.length) { setError(`Mangler: ${missing.map((d) => d.label).join(', ')}`); return; }
    setBusy(true);
    try {
      await submitFleetApplication(token, docs);
      setStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) { setError(e?.message || 'Kunne ikke sende inn søknaden.'); }
    finally { setBusy(false); }
  }

  if (step === 3) return <Submitted email={form.contact_email} />;

  return (
    <main className="apply-page">
      <div className="apply-shell">
        <div className="apply-brand"><Link to="/">KJAPP</Link><span>LØYVEHAVERSØKNAD</span></div>
        <div className="eyebrow">Steg {step} av 2</div>
        <h1>{step === 1 ? 'Fortell oss om virksomheten.' : 'Last opp dokumentasjonen.'}</h1>
        <p className="apply-intro">{step === 1
          ? 'Dette er første del av partnerkontrollen. Tilgang opprettes ikke før dokumentasjonen er godkjent.'
          : 'Alle fem dokumenttyper må lastes opp før søknaden kan sendes til superadmin.'}</p>

        {error ? <div className="form-error" role="alert">{error}</div> : null}

        {step === 1 ? (
          <>
            <div className="application-grid">
              <Field label="Firmanavn" value={form.company_name} onChange={(v) => update('company_name', v)} />
              <Field label="E-post" type="email" value={form.contact_email} onChange={(v) => update('contact_email', v)} />
              <Field label="Organisasjonsnummer" value={form.org_number} onChange={(v) => update('org_number', v)} inputMode="numeric" />
              <Field label="Telefon" type="tel" value={form.contact_phone} onChange={(v) => update('contact_phone', v)} />
              <Field label="Kontaktperson" value={form.contact_name} onChange={(v) => update('contact_name', v)} />
              <div className="split-fields">
                <Field label="Antall løyver" type="number" min="1" value={form.license_count} onChange={(v) => update('license_count', v ? Number(v) : '')} />
                <Field label="Antall biler" type="number" min="1" value={form.vehicle_count} onChange={(v) => update('vehicle_count', v ? Number(v) : '')} />
              </div>
              <Field label="Bankkonto (valgfritt i steg 1)" value={form.bank_account || ''} onChange={(v) => update('bank_account', v)} inputMode="numeric" />
              <label className="field"><span>Kort notat (valgfritt)</span><textarea rows={4} value={form.notes || ''} onChange={(e) => update('notes', e.target.value)} placeholder="Kort om virksomheten eller flåten" /></label>
            </div>
            <div className="apply-bottom">
              <span>12% KJAPP-provisjon ved godkjent partnerskap.</span>
              <button className="gold-btn form-button" disabled={busy} onClick={next}>{busy ? 'Oppretter…' : 'Neste · dokumenter'}</button>
            </div>
          </>
        ) : (
          <>
            <div className="document-list">
              {REQUIRED_DOCS.map((doc) => <DocumentRow key={doc.key} doc={doc} value={docs[doc.key]} busy={uploading === doc.key} onUpload={(file) => upload(doc.key, file)} onRemove={() => setDocs((current) => { const next = { ...current }; delete next[doc.key]; return next; })} />)}
            </div>
            <div className="apply-bottom document-bottom">
              <button className="text-button" onClick={() => setStep(1)}>← Tilbake</button>
              <span>{completed}/5 dokumenter klare</span>
              <button className="gold-btn form-button" disabled={busy || completed !== 5} onClick={submit}>{busy ? 'Sender…' : 'Send til godkjenning'}</button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Field(props: { label: string; value: string | number; onChange: (v: string) => void; type?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']; min?: string }) {
  return <label className="field"><span>{props.label}</span><input type={props.type || 'text'} value={props.value} inputMode={props.inputMode} min={props.min} onChange={(e) => props.onChange(e.target.value)} /></label>;
}

function DocumentRow({ doc, value, busy, onUpload, onRemove }: { doc: { key: string; label: string; detail: string }; value?: UploadedDocument; busy: boolean; onUpload: (file: File) => void; onRemove: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className={`document-row ${value ? 'complete' : ''}`}>
      <div className="doc-state">{value ? '✓' : '—'}</div>
      <div className="doc-copy"><strong>{doc.label}</strong><span>{value?.original_filename || doc.detail}</span></div>
      {value ? <button className="text-button" onClick={onRemove}>Fjern</button> : <button className="outline-btn upload-btn" disabled={busy} onClick={() => ref.current?.click()}>{busy ? 'Laster…' : 'Last opp'}</button>}
      <input ref={ref} className="hidden-input" type="file" accept="application/pdf,image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) onUpload(file); e.currentTarget.value = ''; }} />
    </div>
  );
}

function Submitted({ email }: { email: string }) {
  return (
    <main className="submitted-page">
      <div className="submitted-card">
        <div className="success-ring">✓</div>
        <div className="eyebrow">SØKNAD MOTTATT</div>
        <h1>Venter på godkjenning.</h1>
        <p>KJAPP går gjennom virksomheten og dokumentasjonen manuelt. Det opprettes ingen Fleet-tilgang før superadmin har godkjent søknaden.</p>
        <div className="submitted-email">Svar sendes til <strong>{email}</strong></div>
        <div className="submitted-actions"><Link className="gold-btn" to="/">Til forsiden</Link><Link className="outline-btn" to="/loyvehaver">Om KJAPP Partner</Link></div>
      </div>
    </main>
  );
}
