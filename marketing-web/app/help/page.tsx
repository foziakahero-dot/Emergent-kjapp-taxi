'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';

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
  return <Link href="/" className="inline-flex items-baseline text-[25px] font-black tracking-[-.06em]" aria-label="KJAPP forside">KJ<span className="text-kjapp-cyan">A</span>PP</Link>;
}

export default function HelpPage() {
  const [topic, setTopic] = useState('tur');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const topicLabel = useMemo(() => topics.find((item) => item.value === topic)?.label || 'Annet', [topic]);

  const send = (event: FormEvent) => {
    event.preventDefault();
    const subject = `[KJAPP Support] ${topicLabel}`;
    const body = [`Kategori: ${topicLabel}`, `Navn: ${name || '-'}`, `Kontakt: ${contact || '-'}`, '', 'Beskrivelse:', message || '-', '', 'Sendt fra kjappapp.no/help'].join('\n');
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_78%_9%,rgba(0,229,245,.08),transparent_26rem)] bg-kjapp-bg text-white">
      <header className="mx-auto flex h-[86px] w-[min(1180px,calc(100%-32px))] items-center justify-between border-b border-white/10 sm:w-[min(1180px,calc(100%-64px))]">
        <Wordmark />
        <nav className="flex gap-4 text-xs font-semibold text-[#c4d0d7] sm:gap-6"><Link href="/">Forside</Link><Link href="/loyvehaver">Løyvehaver</Link><a href={`mailto:${SUPPORT_EMAIL}`}>E-post support</a></nav>
      </header>

      <section className="mx-auto grid w-[min(1180px,calc(100%-32px))] gap-10 py-16 lg:grid-cols-[1fr_360px] lg:items-end lg:py-24 sm:w-[min(1180px,calc(100%-64px))]">
        <div><span className="text-[10px] font-extrabold tracking-[.12em] text-kjapp-cyan">KJAPP SUPPORT</span><h1 className="mt-6 font-display text-[clamp(3rem,7vw,5.4rem)] leading-[.96] tracking-[-.06em]">Hva kan vi<br />hjelpe deg med?</h1><p className="mt-6 max-w-2xl text-[17px] leading-7 text-[#b9c6ce]">Velg hva saken gjelder og beskriv problemet. E-posten blir automatisk adressert til <strong className="text-white">{SUPPORT_EMAIL}</strong>.</p></div>
        <aside className="rounded-2xl border border-[#223541] bg-[#091119]/90 p-6 shadow-2xl"><div className="flex gap-3"><span className="mt-1 h-2.5 w-2.5 rounded-full bg-kjapp-green shadow-[0_0_0_6px_rgba(57,229,140,.1)]"/><div><small className="text-[9px] tracking-[.08em] text-[#92a4af]">SUPPORTKANAL</small><strong className="mt-2 block text-lg">{SUPPORT_EMAIL}</strong><p className="mt-2 text-xs leading-5 text-[#a3b3bd]">For kunde-, sjåfør- og partnerhenvendelser.</p></div></div></aside>
      </section>

      <section className="mx-auto grid w-[min(1180px,calc(100%-32px))] gap-6 pb-28 lg:grid-cols-[330px_1fr] sm:w-[min(1180px,calc(100%-64px))]">
        <div className="grid content-start gap-2">{topics.map((item, index) => <button key={item.value} type="button" onClick={() => setTopic(item.value)} className={`grid min-h-[64px] grid-cols-[34px_1fr] items-center rounded-xl border px-4 text-left text-sm font-bold ${topic === item.value ? 'border-kjapp-cyan/70 bg-kjapp-cyan/10 text-white' : 'border-[#1d2e39] bg-[#0a131b] text-[#b8c5cd]'}`}><span className="text-[10px] text-kjapp-cyan">0{index + 1}</span>{item.label}</button>)}</div>
        <form onSubmit={send} className="rounded-3xl border border-[#20313d] bg-gradient-to-br from-[#0b151e] to-[#081119] p-5 shadow-2xl sm:p-8">
          <span className="text-[10px] font-extrabold tracking-[.12em] text-kjapp-cyan">NY SUPPORTSAK</span><h2 className="mt-2 font-display text-[clamp(2rem,4vw,2.75rem)] tracking-[-.04em]">Send til KJAPP Support</h2><p className="mt-3 text-sm leading-6 text-[#a6b5bf]">Vi fyller inn mottaker og saksinformasjon automatisk. Du godkjenner og sender fra ditt eget e-postprogram.</p>
          <label className="mt-6 grid gap-2 text-xs font-bold text-[#d2dde3]">Kategori<select value={topic} onChange={(e) => setTopic(e.target.value)} className="h-12 rounded-xl border border-[#263b49] bg-[#08131b] px-3 text-white">{topics.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <div className="grid gap-4 sm:grid-cols-2"><label className="mt-5 grid gap-2 text-xs font-bold text-[#d2dde3]">Navn<input value={name} onChange={(e) => setName(e.target.value)} className="h-12 rounded-xl border border-[#263b49] bg-[#08131b] px-3 text-white" /></label><label className="mt-5 grid gap-2 text-xs font-bold text-[#d2dde3]">E-post eller telefon<input value={contact} onChange={(e) => setContact(e.target.value)} className="h-12 rounded-xl border border-[#263b49] bg-[#08131b] px-3 text-white" /></label></div>
          <label className="mt-5 grid gap-2 text-xs font-bold text-[#d2dde3]">Beskriv saken<textarea required value={message} onChange={(e) => setMessage(e.target.value)} rows={7} className="rounded-xl border border-[#263b49] bg-[#08131b] p-3 text-white" /></label>
          <button className="mt-6 min-h-14 w-full rounded-xl bg-kjapp-cyan font-extrabold text-[#001014]" type="submit">Åpne e-post til support →</button><small className="mt-3 block text-[#91a3ae]">Ingenting sendes uten at du selv trykker «Send» i e-postprogrammet ditt.</small>
        </form>
      </section>
    </main>
  );
}
