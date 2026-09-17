'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || 'https://github-app-builder-28.emergent.host/api').replace(/\/$/, '');
const REQUIRED_DOCS = [
  { key: 'firmaattest', label: 'Firmaattest', detail: 'Fra Brønnøysundregistrene' },
  { key: 'loyvebevis', label: 'Løyvebevis', detail: 'Gyldig drosjeløyve' },
  { key: 'vognkort', label: 'Vognkort', detail: 'For bilene som skal kobles til KJAPP' },
  { key: 'forsikring', label: 'Forsikringsdokumentasjon', detail: 'Gyldig forsikringsbevis' },
  { key: 'bank', label: 'Bankdokumentasjon', detail: 'For utbetalinger' },
] as const;

type UploadedDocument = { path: string; original_filename: string; content_type: string };
type FormState = { company_name:string; org_number:string; contact_name:string; contact_email:string; contact_phone:string; license_count:string; vehicle_count:string; bank_account:string; notes:string };
const INITIAL: FormState = { company_name:'',org_number:'',contact_name:'',contact_email:'',contact_phone:'',license_count:'',vehicle_count:'',bank_account:'',notes:'' };

async function parseError(res: Response) {
  try { const data = await res.json(); return typeof data?.detail === 'string' ? data.detail : `Forespørselen feilet (${res.status})`; } catch { return `Forespørselen feilet (${res.status})`; }
}

export default function ApplicationPage() {
  const [step,setStep] = useState<1|2|3>(1);
  const [form,setForm] = useState<FormState>(INITIAL);
  const [token,setToken] = useState('');
  const [docs,setDocs] = useState<Record<string,UploadedDocument>>({});
  const [busy,setBusy] = useState(false);
  const [uploading,setUploading] = useState<string|null>(null);
  const [error,setError] = useState('');
  const completed = useMemo(()=>REQUIRED_DOCS.filter((d)=>docs[d.key]).length,[docs]);
  const update = (key:keyof FormState,value:string)=>setForm((f)=>({...f,[key]:value}));

  async function next() {
    setError('');
    if (!form.company_name.trim() || !form.org_number.trim() || !form.contact_name.trim() || !form.contact_email.trim() || !form.contact_phone.trim() || !form.license_count || !form.vehicle_count) { setError('Fyll ut alle obligatoriske felt.'); return; }
    setBusy(true);
    try {
      const notes = [form.notes.trim(), `Antall løyver: ${form.license_count}`, `Antall biler: ${form.vehicle_count}`].filter(Boolean).join('\n');
      const res = await fetch(`${API_BASE}/fleet-applications/draft`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ company_name:form.company_name, org_number:form.org_number, contact_name:form.contact_name, contact_email:form.contact_email, contact_phone:form.contact_phone, bank_account:form.bank_account, notes }) });
      if (!res.ok) throw new Error(await parseError(res));
      const data = await res.json(); setToken(data.upload_token); setStep(2); window.scrollTo({top:0,behavior:'smooth'});
    } catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke opprette søknaden.'); } finally { setBusy(false); }
  }

  async function upload(key:string,file:File) {
    if (!token) return; setUploading(key); setError('');
    try {
      const body = new FormData(); body.append('file',file); body.append('application_token',token);
      const res = await fetch(`${API_BASE}/upload/public`,{method:'POST',body}); if (!res.ok) throw new Error(await parseError(res));
      const out = await res.json(); setDocs((d)=>({...d,[key]:{path:out.storage_path,original_filename:out.original_filename,content_type:out.content_type}}));
    } catch (e) { setError(e instanceof Error ? e.message : 'Dokumentopplasting feilet.'); } finally { setUploading(null); }
  }

  async function submit() {
    setError(''); const missing = REQUIRED_DOCS.filter((d)=>!docs[d.key]); if (missing.length) { setError(`Mangler: ${missing.map((d)=>d.label).join(', ')}`); return; }
    setBusy(true);
    try { const res = await fetch(`${API_BASE}/fleet-applications/submit`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({upload_token:token,documents:docs})}); if(!res.ok) throw new Error(await parseError(res)); setStep(3); window.scrollTo({top:0,behavior:'smooth'}); }
    catch(e){ setError(e instanceof Error ? e.message : 'Kunne ikke sende inn søknaden.'); } finally { setBusy(false); }
  }

  if (step===3) return <main className="grid min-h-screen place-items-center bg-kjapp-bg px-4 text-white"><section className="w-full max-w-2xl rounded-3xl border border-kjapp-cyan/20 bg-[#091119] p-8 text-center shadow-2xl"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-kjapp-green/50 bg-kjapp-green/10 text-2xl text-kjapp-green">✓</div><span className="mt-6 block text-[10px] font-extrabold tracking-[.12em] text-kjapp-cyan">SØKNAD MOTTATT</span><h1 className="mt-4 font-display text-5xl tracking-[-.05em]">Venter på godkjenning.</h1><p className="mx-auto mt-5 max-w-xl text-[#b7c5cd]">KJAPP går gjennom virksomheten og dokumentasjonen manuelt. Det opprettes ingen Fleet-tilgang før superadmin har godkjent søknaden.</p><div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4 text-sm">Svar sendes til <strong>{form.contact_email}</strong></div><div className="mt-6 flex flex-wrap justify-center gap-3"><Link href="/" className="rounded-xl bg-kjapp-cyan px-5 py-3 font-bold text-[#001014]">Til forsiden</Link><Link href="/loyvehaver" className="rounded-xl border border-[#30424f] px-5 py-3 font-bold">Om KJAPP Partner</Link></div></section></main>;

  return <main className="min-h-screen bg-[radial-gradient(circle_at_78%_9%,rgba(0,229,245,.12),transparent_30%)] bg-kjapp-bg text-white">
    <header className="mx-auto flex h-[86px] w-[min(1180px,calc(100%-32px))] items-center justify-between border-b border-white/10 sm:w-[min(1180px,calc(100%-64px))]"><Link href="/" className="text-[25px] font-black tracking-[-.06em]">KJ<span className="text-kjapp-cyan">A</span>PP</Link><nav className="flex gap-4 text-xs font-semibold text-[#c6d1d8] sm:gap-6"><Link href="/">Forside</Link><Link href="/loyvehaver">Løyvehaver</Link><a href="https://fleet.kjappapp.no">Fleet Panel</a></nav></header>
    <section className="mx-auto grid w-[min(1180px,calc(100%-32px))] gap-8 py-16 lg:grid-cols-[1fr_360px] lg:items-end sm:w-[min(1180px,calc(100%-64px))]"><div><span className="text-[10px] font-extrabold tracking-[.12em] text-kjapp-cyan">KJAPP PARTNER · STEG {step} AV 2</span><h1 className="mt-5 font-display text-[clamp(3rem,7vw,5rem)] leading-[.98] tracking-[-.055em]">{step===1?'Søk om Fleet-tilgang.':'Last opp dokumentasjonen.'}</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-[#b7c5cd]">{step===1?'Fortell oss om virksomheten, løyvene og bilene. KJAPP aktiverer ikke Fleet før dokumentasjonen er kontrollert og godkjent.':'Alle fem dokumenttyper må være klare før søknaden sendes videre til manuell kontroll.'}</p></div><aside className="rounded-3xl border border-kjapp-cyan/20 bg-[#091119] p-6"><span className="text-[10px] font-black text-kjapp-cyan">KJAPP PARTNER</span><div className="mt-3 font-display text-6xl text-kjapp-cyan">14%</div><p className="mt-3 text-sm leading-6 text-[#aebdc6]">Serviceavgift for godkjente partnere. Ved digitale betalinger håndteres oppgjør automatisk ukentlig.</p></aside></section>
    <section className="mx-auto grid w-[min(1180px,calc(100%-32px))] gap-6 pb-28 lg:grid-cols-[1fr_300px] sm:w-[min(1180px,calc(100%-64px))]"><div className="rounded-3xl border border-[#20313d] bg-gradient-to-br from-[#0b151e] to-[#081119] p-5 sm:p-8"><div className="flex items-start justify-between gap-4"><div><span className="text-[10px] font-extrabold tracking-[.12em] text-kjapp-cyan">SØKNADSSKJEMA</span><h2 className="mt-2 font-display text-3xl">{step===1?'Virksomhet og kontakt':'Dokumenter som må godkjennes'}</h2></div><div className="text-kjapp-cyan"><strong>0{step}</strong><span className="text-[#8396a1]"> / 02</span></div></div>{error&&<div className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-100" role="alert">{error}</div>}
    {step===1?<><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Firmanavn" value={form.company_name} onChange={(v)=>update('company_name',v)}/><Field label="E-post" type="email" value={form.contact_email} onChange={(v)=>update('contact_email',v)}/><Field label="Organisasjonsnummer" value={form.org_number} onChange={(v)=>update('org_number',v)}/><Field label="Telefon" type="tel" value={form.contact_phone} onChange={(v)=>update('contact_phone',v)}/><Field label="Kontaktperson" value={form.contact_name} onChange={(v)=>update('contact_name',v)}/><div className="grid grid-cols-2 gap-3"><Field label="Antall løyver" type="number" value={form.license_count} onChange={(v)=>update('license_count',v)}/><Field label="Antall biler" type="number" value={form.vehicle_count} onChange={(v)=>update('vehicle_count',v)}/></div><Field label="Bankkonto (valgfritt)" value={form.bank_account} onChange={(v)=>update('bank_account',v)}/><label className="grid gap-2 text-xs font-bold text-[#d2dde3]">Kort notat (valgfritt)<textarea rows={4} value={form.notes} onChange={(e)=>update('notes',e.target.value)} className="rounded-xl border border-[#263b49] bg-[#08131b] p-3 text-white"/></label></div><div className="mt-6 flex justify-end"><button disabled={busy} onClick={next} className="rounded-xl bg-kjapp-cyan px-6 py-4 font-extrabold text-[#001014] disabled:opacity-50">{busy?'Oppretter…':'Neste · dokumenter'}</button></div></>:<><div className="mt-6 grid gap-3">{REQUIRED_DOCS.map((doc)=><DocumentRow key={doc.key} doc={doc} value={docs[doc.key]} busy={uploading===doc.key} onUpload={(file)=>upload(doc.key,file)} onRemove={()=>setDocs((current)=>{const n={...current};delete n[doc.key];return n;})}/>)}</div><div className="mt-6 flex flex-wrap items-center justify-between gap-3"><button onClick={()=>setStep(1)} className="text-sm text-[#b7c5cd]">← Tilbake</button><span className="text-sm text-[#9eb0ba]">{completed}/5 dokumenter klare</span><button disabled={busy||completed!==5} onClick={submit} className="rounded-xl bg-kjapp-cyan px-6 py-4 font-extrabold text-[#001014] disabled:opacity-50">{busy?'Sender…':'Send til godkjenning'}</button></div></>}</div>
    <aside className="grid content-start gap-3">{[['01','Send søknad'],['02','Last opp dokumenter'],['03','KJAPP kontrollerer']].map(([n,t])=><article key={n} className="rounded-2xl border border-[#20313d] bg-[#091119] p-5"><span className="text-[10px] text-kjapp-cyan">{n}</span><h3 className="mt-3 font-bold">{t}</h3></article>)}</aside></section>
  </main>;
}

function Field({label,value,onChange,type='text'}:{label:string;value:string;onChange:(v:string)=>void;type?:string}) { return <label className="grid gap-2 text-xs font-bold text-[#d2dde3]">{label}<input type={type} value={value} onChange={(e)=>onChange(e.target.value)} className="h-12 rounded-xl border border-[#263b49] bg-[#08131b] px-3 text-white"/></label>; }
function DocumentRow({doc,value,busy,onUpload,onRemove}:{doc:{key:string;label:string;detail:string};value?:UploadedDocument;busy:boolean;onUpload:(file:File)=>void;onRemove:()=>void}) { const ref=useRef<HTMLInputElement>(null); return <div className={`grid grid-cols-[36px_1fr_auto] items-center gap-3 rounded-xl border p-4 ${value?'border-kjapp-green/40 bg-kjapp-green/5':'border-[#263b49] bg-[#08131b]'}`}><div className="text-center text-kjapp-cyan">{value?'✓':'—'}</div><div><strong className="block text-sm">{doc.label}</strong><span className="mt-1 block text-xs text-[#96a8b3]">{value?.original_filename||doc.detail}</span></div>{value?<button onClick={onRemove} className="text-xs text-[#b9c6ce]">Fjern</button>:<button disabled={busy} onClick={()=>ref.current?.click()} className="rounded-lg border border-[#36505f] px-3 py-2 text-xs font-bold disabled:opacity-50">{busy?'Laster…':'Last opp'}</button>}<input ref={ref} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e)=>{const file=e.target.files?.[0];if(file)onUpload(file);e.currentTarget.value='';}}/></div>; }
