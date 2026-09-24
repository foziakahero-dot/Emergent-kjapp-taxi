import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, apiError, PublicDriverInvite } from './api';
import './driver-signup.css';

type DocKey = 'drivers_license' | 'taxi_license' | 'profile_photo' | 'selfie_verification';
type Uploaded = { storage_path: string; original_filename?: string };

const DOCS: Array<{ key: DocKey; label: string; sub: string; accept?: string; capture?: 'user' }> = [
  { key: 'drivers_license', label: 'Førerkort', sub: 'Gyldig førerkort' },
  { key: 'taxi_license', label: 'Kjøreseddel', sub: 'Gyldig kjøreseddel for taxi' },
  { key: 'profile_photo', label: 'Profilbilde', sub: 'Tydelig ansiktsbilde' },
  { key: 'selfie_verification', label: 'Selfie ID', sub: 'Ta en fersk selfie av ansiktet ditt nå', accept: 'image/*', capture: 'user' },
];

function InviteBrand() {
  return <div className="brand" aria-label="KJAPP"><div className="brand-word"><span>KJ</span><span className="brand-a">A</span><span>PP</span></div><div className="brand-sub">DRIVER</div></div>;
}

function UploadRow({ item, value, busy, onFile, onRemove }: {
  item: typeof DOCS[number]; value?: Uploaded; busy?: boolean; onFile: (f: File) => void; onRemove: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return <div className={`driver-doc-row ${item.key === 'selfie_verification' ? 'selfie-required' : ''}`}>
    <div className={`driver-doc-mark ${value ? 'done' : ''}`}>{value ? '✓' : '□'}</div>
    <div className="driver-doc-copy"><strong>{item.label}</strong><span>{value?.original_filename || item.sub}</span></div>
    {value ? <button type="button" className="driver-doc-action" onClick={onRemove}>Fjern</button> : <button type="button" className="driver-doc-action" disabled={busy} onClick={() => ref.current?.click()}>{busy ? 'Laster…' : item.key === 'selfie_verification' ? 'Ta selfie' : 'Last opp'}</button>}
    <input ref={ref} type="file" accept={item.accept || 'image/*,application/pdf'} capture={item.capture} hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
  </div>;
}

export default function DriverSignup() {
  const { token = '' } = useParams();
  const [invite, setInvite] = useState<PublicDriverInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<1 | 2>(1);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState<Partial<Record<DocKey, Uploaded>>>({});
  const [uploading, setUploading] = useState<Partial<Record<DocKey, boolean>>>({});
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    api.publicDriverInvite(token).then(setInvite).catch((e) => setErr(apiError(e))).finally(() => setLoading(false));
  }, [token]);

  const next = (e: FormEvent) => {
    e.preventDefault(); setErr('');
    if (!form.fullName.trim() || !form.email.trim() || !form.phone.trim() || form.password.length < 8) {
      setErr('Fyll ut alle feltene. Passord må ha minst 8 tegn.'); return;
    }
    if (!acceptedTerms) {
      setErr('Du må godta sjåførvilkår og personvern før du fortsetter.'); return;
    }
    setStep(2);
  };

  const upload = async (key: DocKey, file: File) => {
    setErr(''); setUploading((s) => ({ ...s, [key]: true }));
    try { const r = await api.uploadDriverDoc(file, token, key); setUploads((s) => ({ ...s, [key]: r })); }
    catch (e) { setErr(apiError(e)); }
    finally { setUploading((s) => ({ ...s, [key]: false })); }
  };

  const submit = async () => {
    setErr('');
    const missing = DOCS.filter((d) => !uploads[d.key]);
    if (missing.length) { setErr(`Mangler: ${missing.map((d) => d.label).join(', ')}`); return; }
    setBusy(true);
    try {
      await api.acceptDriverInvite({
        token,
        ...form,
        accepted_terms: true,
        legal_version: '2026-09',
        drivers_license_path: uploads.drivers_license!.storage_path,
        taxi_license_path: uploads.taxi_license!.storage_path,
        profile_photo_path: uploads.profile_photo!.storage_path,
        selfie_verification_path: uploads.selfie_verification!.storage_path,
      });
      setDone(true);
    } catch (e) { setErr(apiError(e)); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="full-loader"><div className="spinner" /></div>;
  if (!invite) return <div className="driver-signup-screen"><InviteBrand /><div className="driver-signup-card centered"><span className="driver-signup-kicker">SJÅFØRINVITASJON</span><h1>Lenken virker ikke</h1><p>{err || 'Invitasjonen er brukt, utløpt eller ugyldig.'}</p><a className="primary-button" href="https://kjappapp.no">Til KJAPP</a></div></div>;
  if (done) return <div className="driver-signup-screen"><InviteBrand /><div className="driver-signup-card centered"><span className="driver-signup-kicker">MOTTATT</span><h1>Registreringen er sendt.</h1><p>Dokumentene og selfie-ID er mottatt. KJAPP kontrollerer at riktig person registrerer seg før sjåførkontoen aktiveres.</p><a className="primary-button" href="https://kjappapp.no/sjafor">Om KJAPP Driver</a></div></div>;

  return <div className="driver-signup-screen">
    <InviteBrand />
    <div className="driver-signup-card">
      <span className="driver-signup-kicker">SJÅFØRREGISTRERING · STEG {step}/2</span>
      <h1>{step === 1 ? 'Velkommen til KJAPP.' : 'Dokumentasjon og selfie-ID.'}</h1>
      <div className="assigned-car"><span>BIL TILDELT</span><strong>{invite.car || 'KJAPP-bil'}{invite.plate ? ` · ${invite.plate}` : ''}</strong>{invite.fleet_name ? <small>{invite.fleet_name}</small> : null}</div>
      {step === 1 ? <form onSubmit={next} className="driver-signup-form">
        <input placeholder="Fullt navn" value={form.fullName} onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))} required />
        <input type="email" placeholder="E-post" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} required />
        <input type="tel" placeholder="Telefonnummer" value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} required />
        <input type="password" placeholder="Passord · minst 8 tegn" value={form.password} onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))} required />
        <label className="driver-legal">
          <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} />
          <span>Jeg godtar <a href="https://kjappapp.no/vilkar" target="_blank" rel="noreferrer">KJAPPs sjåførvilkår</a> og har lest <a href="https://kjappapp.no/personvern" target="_blank" rel="noreferrer">personvernerklæringen</a>.</span>
        </label>
        {err ? <div className="error-box">{err}</div> : null}
        <button className="primary-button">Neste · dokumenter</button>
      </form> : <div className="driver-signup-form">
        <p className="driver-doc-intro">Førerkort, kjøreseddel, profilbilde og en fersk selfie-ID må være mottatt før kontoen kan godkjennes. Selfien brukes til manuell identitetskontroll i beta.</p>
        {DOCS.map((d) => <UploadRow key={d.key} item={d} value={uploads[d.key]} busy={uploading[d.key]} onFile={(f) => upload(d.key, f)} onRemove={() => setUploads((s) => ({ ...s, [d.key]: undefined }))} />)}
        {err ? <div className="error-box">{err}</div> : null}
        <button className="primary-button" disabled={busy} onClick={submit}>{busy ? 'Sender…' : 'Send til godkjenning'}</button>
        <button className="driver-back" onClick={() => setStep(1)}>Tilbake</button>
      </div>}
      <Link className="driver-invite-help" to="/login">Er du løyvehaver? Logg inn i Partner</Link>
    </div>
  </div>;
}
