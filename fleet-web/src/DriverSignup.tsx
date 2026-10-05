import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, apiError, PublicDriverInvite } from './api';
import './driver-signup.css';

type DocKey = 'drivers_license' | 'taxi_license' | 'profile_photo';
type Uploaded = { storage_path: string; original_filename?: string };
type Step = 'invite' | 'contact' | 'password' | 'documents' | 'selfie' | 'vehicle';

const DOCS: Array<{ key: Exclude<DocKey, 'profile_photo'>; label: string; sub: string }> = [
  { key: 'drivers_license', label: 'Førerkort', sub: 'Forside og bakside' },
  { key: 'taxi_license', label: 'Kjøreseddel', sub: 'Gyldig kjøreseddel for taxi' },
];

const STEP_INDEX: Record<Step, number> = {
  invite: 0,
  contact: 1,
  password: 2,
  documents: 3,
  selfie: 4,
  vehicle: 5,
};

function Mark({ size = 40 }: { size?: number }) {
  return (
    <span className="driver-mark" style={{ width: size, height: size, borderRadius: size * 0.28 }} aria-label="KJAPP">
      <svg width={size * .52} height={size * .52} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 5l7 7-7 7" stroke="rgba(255,255,255,.55)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 5l7 7-7 7" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function Header() {
  return <div className="driver-invite-header"><Mark /><span>KJAPP SJÅFØR</span></div>;
}

function Steps({ step }: { step: Step }) {
  const active = STEP_INDEX[step];
  return <div className="driver-step-dots" aria-label={`Steg ${active + 1} av 6`}>
    {Array.from({ length: 6 }, (_, i) => <span key={i} className={i <= active ? 'active' : ''} />)}
  </div>;
}

function NavyButton({ children, onClick, disabled, type = 'button' }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; type?: 'button' | 'submit';
}) {
  return <button type={type} className="driver-navy-button" onClick={onClick} disabled={disabled}>{children}</button>;
}

function UploadRow({ item, value, busy, onFile, onRemove }: {
  item: typeof DOCS[number]; value?: Uploaded; busy?: boolean; onFile: (f: File) => void; onRemove: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return <div className={`driver-doc-row ${value ? 'complete' : ''}`}>
    <span className="driver-doc-icon">{value ? '✓' : '▱'}</span>
    <div className="driver-doc-copy"><strong>{item.label}</strong><span>{value?.original_filename || item.sub}</span></div>
    {value
      ? <button type="button" className="driver-doc-action" onClick={onRemove}>Fjern</button>
      : <button type="button" className="driver-doc-action" disabled={busy} onClick={() => ref.current?.click()}>{busy ? 'Laster…' : 'LAST OPP'}</button>}
    <input ref={ref} type="file" accept="image/*,application/pdf" hidden onChange={(e) => { const file=e.target.files?.[0]; if(file) onFile(file); }} />
  </div>;
}

export default function DriverSignup() {
  const { token = '' } = useParams();
  const [invite, setInvite] = useState<PublicDriverInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('invite');
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState<Partial<Record<DocKey, Uploaded>>>({});
  const [uploading, setUploading] = useState<Partial<Record<DocKey, boolean>>>({});
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', passwordAgain: '' });
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    api.publicDriverInvite(token)
      .then((data) => {
        setInvite(data);
        setForm((s) => ({ ...s, email: (data as any).email || s.email }));
      })
      .catch((e) => setErr(apiError(e)))
      .finally(() => setLoading(false));
  }, [token]);

  const upload = async (key: DocKey, file: File) => {
    setErr('');
    setUploading((s) => ({ ...s, [key]: true }));
    try {
      const r = await api.uploadDriverDoc(file, token, key);
      setUploads((s) => ({ ...s, [key]: r }));
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setUploading((s) => ({ ...s, [key]: false }));
    }
  };

  const goContact = () => { setErr(''); setStep('contact'); };
  const goPassword = (e: FormEvent) => {
    e.preventDefault(); setErr('');
    if (!form.fullName.trim() || !form.email.trim() || !form.phone.trim()) {
      setErr('Fyll inn navn, e-post og telefonnummer.'); return;
    }
    setStep('password');
  };
  const goDocuments = (e: FormEvent) => {
    e.preventDefault(); setErr('');
    if (form.password.length < 8) { setErr('Passord må ha minst 8 tegn.'); return; }
    if (form.password !== form.passwordAgain) { setErr('Passordene er ikke like.'); return; }
    if (!acceptedTerms) { setErr('Du må godta sjåførvilkår og personvern.'); return; }
    setStep('documents');
  };

  const submit = async () => {
    setErr('');
    if (!uploads.drivers_license || !uploads.taxi_license || !uploads.profile_photo) {
      setErr('Førerkort, kjøreseddel og profilbilde må være lastet opp.'); return;
    }
    setBusy(true);
    try {
      await api.acceptDriverInvite({
        token,
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        accepted_terms: true,
        legal_version: '2026-09',
        drivers_license_path: uploads.drivers_license.storage_path,
        taxi_license_path: uploads.taxi_license.storage_path,
        profile_photo_path: uploads.profile_photo.storage_path,
      });
      setDone(true);
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="driver-signup-screen centered-screen"><div className="driver-loader" /></div>;

  if (!invite) return <div className="driver-signup-screen">
    <div className="driver-phone-shell">
      <Header />
      <div className="driver-centered-state">
        <span className="driver-status-circle error">!</span>
        <h1>Lenken virker ikke</h1>
        <p>{err || 'Invitasjonen er brukt, utløpt eller ugyldig.'}</p>
        <a className="driver-navy-button link-button" href="https://kjappapp.no">Til KJAPP</a>
      </div>
    </div>
  </div>;

  if (done) return <div className="driver-signup-screen">
    <div className="driver-phone-shell">
      <Header />
      <div className="driver-centered-state">
        <span className="driver-status-circle">✓</span>
        <h1>Sendt til godkjenning</h1>
        <p>{invite.fleet_name || 'Løyvehaveren'} og KJAPP går gjennom søknaden din. Du får beskjed når sjåførkontoen er klar til bruk.</p>
        <div className="driver-pending-card">
          <div><span>Identitet</span><strong>Til kontroll</strong></div>
          <div><span>Dokumenter</span><strong>Mottatt</strong></div>
          <div><span>Kjøretøy</span><strong>Bekreftet</strong></div>
        </div>
        <a className="driver-navy-button link-button" href="https://kjappapp.no/sjafor">Om KJAPP Driver</a>
      </div>
    </div>
  </div>;

  const assigned = `${invite.car || 'KJAPP-bil'}${invite.plate ? ` · ${invite.plate}` : ''}`;

  return <div className="driver-signup-screen">
    <div className="driver-phone-shell">
      <Header />
      <Steps step={step} />

      {step === 'invite' ? <section className="driver-step">
        <h1>Du er invitert til KJAPP</h1>
        <p>Bekreft invitasjonen fra løyvehaveren for å aktivere sjåførkontoen.</p>
        <div className="driver-info-card">
          <span className="driver-card-label">INVITERT AV</span>
          <strong>{invite.fleet_name || 'KJAPP-flåte'}</strong>
          {invite.fleet_org_number ? <small>Org.nr {invite.fleet_org_number}</small> : null}
        </div>
        <div className="driver-info-card">
          <span className="driver-card-label">TILDELT KJØRETØY</span>
          <strong>{assigned}</strong>
        </div>
        <NavyButton onClick={goContact}>Dette er meg — fortsett</NavyButton>
      </section> : null}

      {step === 'contact' ? <section className="driver-step">
        <h1>Kontaktinformasjon</h1>
        <p>Bekreft navn, e-post og telefonnummer for sjåførkontoen.</p>
        <form className="driver-form" onSubmit={goPassword}>
          <label><span>FULLT NAVN</span><input value={form.fullName} onChange={(e)=>setForm(s=>({...s,fullName:e.target.value}))} placeholder="Ola Nordmann" /></label>
          <label><span>E-POST</span><input type="email" value={form.email} onChange={(e)=>setForm(s=>({...s,email:e.target.value}))} placeholder="deg@epost.no" /></label>
          <label><span>TELEFONNUMMER</span><input type="tel" value={form.phone} onChange={(e)=>setForm(s=>({...s,phone:e.target.value}))} placeholder="+47 000 00 000" /></label>
          {err ? <div className="driver-error">{err}</div> : null}
          <NavyButton type="submit">Fortsett</NavyButton>
        </form>
      </section> : null}

      {step === 'password' ? <section className="driver-step">
        <h1>Lag et passord</h1>
        <p>Dette bruker du til å logge inn i den separate KJAPP Driver-appen.</p>
        <form className="driver-form" onSubmit={goDocuments}>
          <label><span>PASSORD</span><input type="password" value={form.password} onChange={(e)=>setForm(s=>({...s,password:e.target.value}))} placeholder="Minst 8 tegn" /></label>
          <label><span>GJENTA PASSORD</span><input type="password" value={form.passwordAgain} onChange={(e)=>setForm(s=>({...s,passwordAgain:e.target.value}))} placeholder="Gjenta passord" /></label>
          <label className="driver-terms"><input type="checkbox" checked={acceptedTerms} onChange={(e)=>setAcceptedTerms(e.target.checked)} /><span>Jeg godtar <a href="https://kjappapp.no/vilkar" target="_blank" rel="noreferrer">sjåførvilkårene</a> og har lest <a href="https://kjappapp.no/personvern" target="_blank" rel="noreferrer">personvernerklæringen</a>.</span></label>
          {err ? <div className="driver-error">{err}</div> : null}
          <NavyButton type="submit">Fortsett</NavyButton>
        </form>
      </section> : null}

      {step === 'documents' ? <section className="driver-step">
        <h1>Last opp dokumenter</h1>
        <p>{DOCS.filter(d=>uploads[d.key]).length}/{DOCS.length} lastet opp.</p>
        <div className="driver-upload-list">
          {DOCS.map(d=><UploadRow key={d.key} item={d} value={uploads[d.key]} busy={uploading[d.key]} onFile={(file)=>upload(d.key,file)} onRemove={()=>setUploads(s=>({...s,[d.key]:undefined}))} />)}
        </div>
        {err ? <div className="driver-error">{err}</div> : null}
        <NavyButton disabled={!uploads.drivers_license || !uploads.taxi_license} onClick={()=>setStep('selfie')}>Fortsett</NavyButton>
      </section> : null}

      {step === 'selfie' ? <section className="driver-step">
        <h1>Ta et profilbilde</h1>
        <p>Profilbildet brukes i KJAPP og inngår i identitetskontrollen.</p>
        <SelfieUpload value={uploads.profile_photo} busy={uploading.profile_photo} onFile={(file)=>upload('profile_photo',file)} onRemove={()=>setUploads(s=>({...s,profile_photo:undefined}))} />
        {err ? <div className="driver-error">{err}</div> : null}
        <NavyButton disabled={!uploads.profile_photo} onClick={()=>setStep('vehicle')}>Fortsett</NavyButton>
      </section> : null}

      {step === 'vehicle' ? <section className="driver-step">
        <h1>Bekreft kjøretøy</h1>
        <p>Kjøretøyet er tildelt av {invite.fleet_name || 'løyvehaveren'} og kan ikke endres i denne registreringen.</p>
        <div className="driver-vehicle-card">
          <span className="driver-vehicle-icon">››</span>
          <div><strong>{invite.car || 'KJAPP-bil'}</strong><span>{invite.plate || 'Registreringsnummer mangler'}</span></div>
          <span className="driver-check">✓</span>
        </div>
        {err ? <div className="driver-error">{err}</div> : null}
        <NavyButton disabled={busy} onClick={submit}>{busy ? 'Sender…' : 'Send til godkjenning'}</NavyButton>
      </section> : null}

      {step !== 'invite' ? <button type="button" className="driver-back" onClick={() => {
        const prev: Record<Exclude<Step,'invite'>, Step> = { contact:'invite', password:'contact', documents:'password', selfie:'documents', vehicle:'selfie' };
        setErr(''); setStep(prev[step as Exclude<Step,'invite'>]);
      }}>Tilbake</button> : null}

      <Link className="driver-invite-help" to="/login">Er du løyvehaver? Logg inn i Partner</Link>
    </div>
  </div>;
}

function SelfieUpload({ value, busy, onFile, onRemove }: {
  value?: Uploaded; busy?: boolean; onFile: (file: File) => void; onRemove: () => void;
}) {
  const ref=useRef<HTMLInputElement>(null);
  return <div className="driver-selfie-wrap">
    <button type="button" className={`driver-selfie ${value ? 'complete' : ''}`} disabled={busy} onClick={()=> value ? onRemove() : ref.current?.click()}>
      <span>{value ? '✓' : '◎'}</span>
    </button>
    <strong>{busy ? 'Laster opp…' : value ? 'Profilbilde lastet opp' : 'Trykk for å velge profilbilde'}</strong>
    <input ref={ref} type="file" accept="image/*" capture="user" hidden onChange={(e)=>{const file=e.target.files?.[0]; if(file) onFile(file);}} />
  </div>;
}
