'use client';

import Image from 'next/image';
import { FormEvent, useEffect, useMemo, useState } from 'react';

type Audience = 'passenger' | 'driver';
type WaitlistRole = 'Passasjer' | 'Sjåfør' | 'Løyvehaver';

const steps = [
  {
    number: '01',
    title: 'Si eller skriv hvor du skal',
    copy: 'Søk etter destinasjon eller bruk stemmen. KJAPP finner stedet og gjør reisen klar.',
  },
  {
    number: '02',
    title: 'Velg bil og se estimatet',
    copy: 'KJAPP Standard, KJAPP XL eller Premium. Se estimert pris og hentetid før du bestiller.',
  },
  {
    number: '03',
    title: 'Bestill og følg bilen live',
    copy: 'Bekreft turen og følg sjåføren på kartet helt frem til hentestedet.',
  },
];

const socialProof = [
  '1200+ lisensierte sjåfører',
  'Testes i Oslo akkurat nå',
  '4.8/5 fra beta-testere',
];

const vehicles = [
  {
    name: 'KJAPP Standard',
    image: '/assets/figma/standard.png',
    description: 'Rask, enkel og tydelig for hverdagsreisen.',
    price: 'Fra 99 kr · Oslo S → Gardermoen fra 399 kr',
  },
  {
    name: 'KJAPP XL',
    image: '/assets/figma/xl.png',
    description: 'Mer plass til familie, venner og bagasje.',
    price: 'Fra 149 kr · Opptil 7 passasjerer',
  },
  {
    name: 'Premium',
    image: '/assets/figma/premium.png',
    description: 'Når du vil ha ekstra komfort og en mer eksklusiv bil.',
    price: 'Fra 199 kr · Premium komfort og luksusbil',
  },
];

const values = [
  ['01', 'NORSK', 'Bygget rundt norske reisende, lokale løyvehavere og norsk kundestøtte.'],
  ['02', 'TYDELIG', 'Biltype, prisestimat og turstatus vises før og under reisen.'],
  ['03', 'SMART', 'Skriv eller si destinasjonen. Teknologien hjelper deg videre uten å stå i veien.'],
  ['04', 'TRYGT', 'Lisensierte sjåfører, live sporing og samme system fra bestilling til fullført tur.'],
];

function Wordmark() {
  return (
    <a href="#top" aria-label="KJAPP forside" className="inline-flex items-baseline text-[1.6rem] font-black tracking-[-0.08em] text-white">
      <span>KJ</span><span className="text-kjapp-cyan">A</span><span>PP</span>
    </a>
  );
}

function MicIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" />
    </svg>
  );
}

function ChevronIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function BetaButton({
  onClick,
  className = '',
  driverHighlight = false,
}: {
  onClick: () => void;
  className?: string;
  driverHighlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative inline-flex min-h-12 items-center justify-center rounded-xl border border-kjapp-cyan bg-kjapp-cyan px-5 py-3 pr-8 text-sm font-extrabold text-[#001014] shadow-glow transition-transform hover:-translate-y-0.5 hover:bg-[#4ef0fa] ${driverHighlight ? 'ring-2 ring-kjapp-cyan ring-offset-4 ring-offset-kjapp-bg' : ''} ${className}`}
    >
      Få tilgang til beta
      <span className="absolute -right-2.5 -top-2.5 rounded-full border border-[#65f4fc] bg-[#061116] px-2 py-1 text-[8px] font-black tracking-[0.12em] text-kjapp-cyan shadow-[0_0_20px_rgba(0,229,245,.25)]">
        BETA
      </span>
    </button>
  );
}

function PhoneScene() {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="relative mx-auto w-full max-w-[390px]" aria-label="Interaktiv forhåndsvisning av KJAPP Customer">
      <div className="pointer-events-none absolute inset-[6%_-12%_4%] rounded-full bg-[radial-gradient(circle,rgba(0,229,245,.15),transparent_68%)] blur-2xl" />
      <div className="phone-shadow relative mx-auto h-[570px] w-[286px] rounded-[2.7rem] border border-[#42606f] bg-gradient-to-br from-[#2b414e] via-[#0b141a] to-[#1d2d36] p-[9px] sm:h-[704px] sm:w-[354px]">
        <div className="relative h-full overflow-hidden rounded-[2.2rem] bg-[#061018]">
          <Image
            src="/assets/figma/heroMap.png"
            alt="Kartvisning i KJAPP-appen"
            fill
            priority
            sizes="(max-width: 640px) 286px, 354px"
            className="object-cover opacity-85"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#04090e]/5 via-[#04090e]/10 to-[#04090e]/70" />
          <div className="absolute left-1/2 top-2.5 z-20 h-6 w-[88px] -translate-x-1/2 rounded-full bg-black" />

          <div className="absolute left-4 right-4 top-10 z-10 flex items-center justify-between sm:top-11">
            <div className="rounded-full border border-white/15 bg-[#050a0f]/85 px-3 py-2 text-[11px] font-black tracking-[0.05em] backdrop-blur-md">
              KJ<span className="text-kjapp-cyan">A</span>PP
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-[#050a0f]/85 text-[11px] font-bold text-[#dbe6eb] backdrop-blur-md">U</div>
          </div>

          <div className="absolute left-[28%] top-[36%] z-10 flex items-center gap-2 rounded-full border border-[#a2e6ed]/20 bg-[#050c12]/90 px-2.5 py-2 text-[7px] font-bold tracking-[.08em] text-[#dffcff] backdrop-blur-md sm:left-[33%]">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-white bg-kjapp-cyan shadow-[0_0_0_6px_rgba(0,229,245,.11)]" />
            DIN POSISJON
          </div>

          <div className={`absolute bottom-0 left-0 right-0 z-20 rounded-t-[1.75rem] border-t border-[#80a9bb]/20 bg-[#060d13]/95 backdrop-blur-xl transition-[min-height] ${expanded ? 'min-h-[244px] p-3 sm:min-h-[300px] sm:p-4' : 'min-h-[82px] p-3 sm:min-h-[92px]'}`}>
            {expanded ? (
              <>
                <button type="button" onClick={() => setExpanded(false)} className="mx-auto flex h-6 items-center gap-2 text-[6px] font-bold tracking-[.12em] text-[#93a3ad]" aria-label="Minimer bestillingsfeltet">
                  <span className="h-1 w-10 rounded-full bg-[#32434d]" /> MINIMER
                </button>
                <div className="mt-1 flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full border-2 border-kjapp-green" />
                  <div>
                    <div className="text-[7px] font-bold tracking-[.08em] text-[#9aacb7]">HENTESTED</div>
                    <strong className="text-[10px] text-[#d6e0e5]">Din posisjon · Oslo</strong>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[8px] text-[#9aacb7]"><span className="h-1.5 w-1.5 rounded-full bg-kjapp-green" />4 biler i nærheten · nærmeste 3 min</div>
                <div className="mt-3 flex items-center gap-2.5 rounded-2xl border border-[#28404d] bg-gradient-to-b from-[#0d1922] to-[#0a141c] p-3">
                  <div className="min-w-0 flex-1">
                    <small className="block text-[7px] font-extrabold tracking-[.08em] text-kjapp-cyan">KJAPP</small>
                    <strong className="mt-0.5 block text-[16px] tracking-[-.035em] text-white">Hvor skal du?</strong>
                    <span className="mt-1 block text-[7px] text-[#93a3ad] sm:text-[8px]">Søk adresse, sted eller flyplass</span>
                  </div>
                  <button type="button" className="grid h-9 w-9 place-items-center rounded-full border border-kjapp-cyan/20 bg-kjapp-cyan/10 text-kjapp-cyan" aria-label="Bestill med stemmen"><MicIcon className="h-4 w-4" /></button>
                  <button type="button" className="grid h-9 w-9 place-items-center rounded-full bg-kjapp-cyan text-lg font-black text-[#001014]" aria-label="Åpne søk">⌕</button>
                </div>
                <div className="mt-2.5 flex gap-1.5 overflow-hidden text-[7px] text-[#c0cbd2]">
                  {['⌂ Hjem', '▣ Jobb', '＋ Legg til'].map((item) => <span key={item} className="whitespace-nowrap rounded-full border border-[#233641] bg-[#09131b] px-2.5 py-2">{item}</span>)}
                </div>
              </>
            ) : (
              <button type="button" onClick={() => setExpanded(true)} className="grid h-[62px] w-full grid-cols-[1fr_auto] grid-rows-2 items-center rounded-2xl border border-[#2a424f] bg-gradient-to-b from-[#0d1922] to-[#081118] px-3.5 text-left" aria-label="Åpne bestillingsfeltet">
                <span className="flex items-center gap-1.5 text-[7px] text-[#99aab4]"><i className="h-1.5 w-1.5 rounded-full bg-kjapp-green" />Din posisjon</span>
                <strong className="col-start-1 row-start-2 text-[16px] tracking-[-.03em]">Hvor vil du?</strong>
                <span className="col-start-2 row-span-2 row-start-1 flex items-center gap-2">
                  <b className="grid h-9 w-9 place-items-center rounded-full border border-kjapp-cyan/20 bg-kjapp-cyan/10 text-kjapp-cyan"><MicIcon className="h-4 w-4" /></b>
                  <em className="grid h-7 w-7 place-items-center rounded-full bg-kjapp-cyan not-italic text-[#001014]">⌃</em>
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-center gap-2">
        <button type="button" onClick={() => setExpanded(true)} className={`rounded-full border px-3 py-2 text-[8px] font-extrabold ${expanded ? 'border-kjapp-cyan/50 bg-kjapp-cyan/10 text-[#d8fcff]' : 'border-[#263943] bg-[#09131b] text-[#9aabb6]'}`}>Åpen</button>
        <button type="button" onClick={() => setExpanded(false)} className={`rounded-full border px-3 py-2 text-[8px] font-extrabold ${!expanded ? 'border-kjapp-cyan/50 bg-kjapp-cyan/10 text-[#d8fcff]' : 'border-[#263943] bg-[#09131b] text-[#9aabb6]'}`}>Minimert</button>
      </div>
      <span className="mt-2 block text-center text-[9px] font-semibold tracking-[.12em] text-[#8497a3]">CUSTOMER · GOLD · MAP FIRST</span>
    </div>
  );
}

function WaitlistModal({
  open,
  role,
  onRoleChange,
  onClose,
}: {
  open: boolean;
  role: WaitlistRole;
  onRoleChange: (role: WaitlistRole) => void;
  onClose: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [position, setPosition] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setPosition(null);
    setError('');
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', close);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', close);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError('');
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'),
          phone: form.get('phone'),
          email: form.get('email'),
          role: form.get('role'),
          city: form.get('city'),
        }),
      });
      const result = (await response.json()) as { ok?: boolean; position?: number; message?: string };
      if (!response.ok || !result.ok || !result.position) throw new Error(result.message || 'Kunne ikke lagre ventelisten.');
      setPosition(result.position);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Noe gikk galt. Prøv igjen.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="modal-backdrop fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/75 px-4 py-6 backdrop-blur-sm" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="waitlist-title" className="relative w-full max-w-xl rounded-[1.75rem] border border-[#29414f] bg-[#071018] p-5 shadow-[0_30px_120px_rgba(0,0,0,.65),0_0_70px_rgba(0,229,245,.08)] sm:p-7">
        <button type="button" onClick={onClose} aria-label="Lukk" className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-[#2c414d] bg-[#0b161e] text-xl text-white">×</button>
        {position ? (
          <div className="px-2 py-12 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-kjapp-green/30 bg-kjapp-green/10 text-2xl text-kjapp-green">✓</span>
            <h2 id="waitlist-title" className="font-display mt-6 text-[clamp(2rem,8vw,3rem)] leading-tight">Du er med.</h2>
            <p className="mx-auto mt-4 max-w-md text-base leading-7 text-[#c1cdd4]">Takk! Du er nr. {position} på ventelisten. Vi kontakter deg snart.</p>
            <button type="button" onClick={onClose} className="mt-7 min-h-12 rounded-xl border border-kjapp-cyan bg-kjapp-cyan px-6 text-sm font-extrabold text-[#001014]">Lukk</button>
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-4">
            <div className="pr-12">
              <span className="text-[10px] font-black tracking-[.14em] text-kjapp-cyan">KJAPP BETA</span>
              <h2 id="waitlist-title" className="font-display mt-3 text-[clamp(2rem,8vw,3rem)] leading-tight">Få tilgang til beta.</h2>
              <p className="mt-2 text-sm leading-6 text-[#b7c4cc]">Registrer deg, så gir vi beskjed når KJAPP åpner for flere testere.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-xs font-bold text-[#dce6eb]">Navn *<input name="name" autoComplete="name" required className="h-12 rounded-xl border border-[#2b414d] bg-[#09141c] px-4 text-sm text-white outline-none placeholder:text-[#8497a3] focus:border-kjapp-cyan" placeholder="Ditt navn" /></label>
              <label className="grid gap-2 text-xs font-bold text-[#dce6eb]">Telefon *<input name="phone" autoComplete="tel" inputMode="tel" required className="h-12 rounded-xl border border-[#2b414d] bg-[#09141c] px-4 text-sm text-white outline-none placeholder:text-[#8497a3] focus:border-kjapp-cyan" placeholder="+47 ..." /></label>
            </div>
            <label className="grid gap-2 text-xs font-bold text-[#dce6eb]">E-post <span className="sr-only">valgfri</span><input name="email" type="email" autoComplete="email" className="h-12 rounded-xl border border-[#2b414d] bg-[#09141c] px-4 text-sm text-white outline-none placeholder:text-[#8497a3] focus:border-kjapp-cyan" placeholder="navn@epost.no (valgfri)" /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-xs font-bold text-[#dce6eb]">Hva er du? *<select name="role" value={role} onChange={(event) => onRoleChange(event.target.value as WaitlistRole)} required className="h-12 rounded-xl border border-[#2b414d] bg-[#09141c] px-4 text-sm text-white outline-none focus:border-kjapp-cyan"><option>Passasjer</option><option>Sjåfør</option><option>Løyvehaver</option></select></label>
              <label className="grid gap-2 text-xs font-bold text-[#dce6eb]">Hvilken by bor du i? *<input name="city" autoComplete="address-level2" required className="h-12 rounded-xl border border-[#2b414d] bg-[#09141c] px-4 text-sm text-white outline-none placeholder:text-[#8497a3] focus:border-kjapp-cyan" placeholder="Oslo" /></label>
            </div>
            {error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-100">{error}</p>}
            <button disabled={pending} type="submit" className="mt-1 min-h-[52px] rounded-xl border border-kjapp-cyan bg-kjapp-cyan px-5 py-4 text-sm font-extrabold text-[#001014] shadow-glow disabled:cursor-wait disabled:opacity-70">
              {pending ? 'Sender…' : 'Send meg beta-tilgang'}
            </button>
            <p className="m-0 text-[11px] leading-5 text-[#9aabb5]">Vi sender deg en varsling når KJAPP er klar i din by. Vi deler ikke din informasjon med tredjeparter.</p>
          </form>
        )}
      </section>
    </div>
  );
}

function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(localStorage.getItem('kjapp-cookie-consent-v1') === null);
  }, []);

  const choose = (value: 'accepted' | 'declined') => {
    localStorage.setItem('kjapp-cookie-consent-v1', value);
    window.dispatchEvent(new CustomEvent('kjapp-cookie-consent', { detail: value }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <aside className="fixed bottom-3 left-1/2 z-[90] w-[calc(100%-1.5rem)] max-w-3xl -translate-x-1/2 rounded-2xl border border-[#334b58] bg-[#071018]/[.98] p-4 shadow-[0_24px_80px_rgba(0,0,0,.58)] backdrop-blur-xl sm:bottom-5 sm:p-5" aria-label="Samtykke til informasjonskapsler">
      <div className="grid gap-4 sm:grid-cols-[1fr_240px] sm:items-center">
        <div><strong className="text-sm text-white">Personvern og informasjonskapsler</strong><p className="mt-1 text-xs leading-5 text-[#b1c0c8]">Vi bruker nødvendig lokal lagring for funksjoner på siden. Analyse lastes ikke inn før du eventuelt velger Aksepter.</p></div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => choose('declined')} className="min-h-11 rounded-xl border border-[#526570] bg-[#0b161e] px-3 text-sm font-bold text-white">Avslå</button>
          <button type="button" onClick={() => choose('accepted')} className="min-h-11 rounded-xl border border-kjapp-cyan bg-kjapp-cyan px-3 text-sm font-bold text-[#001014]">Aksepter</button>
        </div>
      </div>
    </aside>
  );
}

export default function KjappLanding() {
  const [audience, setAudience] = useState<Audience>('passenger');
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistRole, setWaitlistRole] = useState<WaitlistRole>('Passasjer');
  const vehicleCount = useMemo(() => vehicles.length, []);
  const driverSelected = audience === 'driver';

  const openWaitlist = (role: WaitlistRole = audience === 'driver' ? 'Sjåfør' : 'Passasjer') => {
    setWaitlistRole(role);
    setWaitlistOpen(true);
  };

  const selectAudience = (next: Audience) => {
    setAudience(next);
    if (next === 'driver') {
      requestAnimationFrame(() => document.getElementById('partner')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <main id="top" className="min-h-screen overflow-x-hidden bg-kjapp-bg text-white">
      <header className="sticky top-0 z-50 border-b border-white/[.08] bg-[#050a0f]/90 backdrop-blur-xl">
        <div className="kjapp-shell flex min-h-[82px] flex-wrap items-center gap-3 py-3 lg:flex-nowrap">
          <div className="order-1 flex min-w-0 items-center gap-3 lg:gap-5">
            <div className="flex shrink-0 rounded-full border border-[#2c414d] bg-[#081119] p-1 text-[10px] font-extrabold sm:text-[11px]" aria-label="Velg side for passasjer eller sjåfør">
              <button type="button" onClick={() => selectAudience('passenger')} aria-pressed={!driverSelected} className={`rounded-full px-2.5 py-2 sm:px-3 ${!driverSelected ? 'bg-white text-[#071018]' : 'text-[#c0cbd2]'}`}>Passasjer</button>
              <button type="button" onClick={() => selectAudience('driver')} aria-pressed={driverSelected} className={`rounded-full px-2.5 py-2 sm:px-3 ${driverSelected ? 'bg-kjapp-cyan text-[#001014]' : 'text-[#c0cbd2]'}`}>Sjåfør &amp; Løyvehaver</button>
            </div>
            <Wordmark />
          </div>
          <nav className="order-3 ml-auto hidden items-center gap-6 text-[13px] font-bold text-[#c6d1d7] lg:order-2 lg:flex" aria-label="Hovedmeny">
            <a href="#how" className="hover:text-kjapp-cyan">Hvordan det fungerer</a>
            <a href="#voice" className="hover:text-kjapp-cyan">Voice</a>
            <a href="#vehicles" className="hover:text-kjapp-cyan">Bilvalg</a>
            <a href="#partner" className="hover:text-kjapp-cyan">Løyvehaver</a>
          </nav>
          <div className="order-2 ml-auto lg:order-3 lg:ml-0"><BetaButton onClick={() => openWaitlist()} driverHighlight={driverSelected} className="min-h-11 px-4 py-2.5 text-xs sm:text-sm" /></div>
        </div>
      </header>

      <section className="kjapp-shell grid min-h-[720px] items-center gap-10 py-14 md:py-20 lg:grid-cols-[minmax(0,1fr)_430px] lg:gap-20 lg:py-24">
        <div>
          <div className="inline-flex items-center rounded-full border border-kjapp-cyan/60 px-3 py-2 text-[10px] font-black tracking-[.11em] text-kjapp-cyan">NORSK TAXI — PÅ DINE PREMISSER</div>
          <h1 className="font-display mt-7 max-w-4xl text-[clamp(3.1rem,11vw,6.7rem)] leading-[.88] tracking-[-.045em] text-white">NORSK TAXI,<br />UTEN OMVEIER.</h1>
          <p className="mt-7 max-w-2xl text-[clamp(1rem,2.8vw,1.18rem)] leading-8 text-kjapp-copy">Kartet først. Bestill med tekst eller stemme. Velg bilen som passer, se estimatet før du bekrefter — og følg reisen live.</p>
          <div className="mt-6 inline-flex items-center gap-2.5 rounded-full border border-kjapp-cyan/20 bg-[#08131b]/80 px-3.5 py-2.5 text-sm font-bold text-[#d9faff]"><span className="h-2 w-2 rounded-full bg-kjapp-cyan shadow-[0_0_0_5px_rgba(0,229,245,.1)]" />Si hvor du skal. KJAPP ordner resten.</div>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <BetaButton onClick={() => openWaitlist()} driverHighlight={driverSelected} />
            <a href="#voice" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-[#314653] bg-[#091119] px-5 text-sm font-bold text-white hover:border-[#4b6577]">Se voice booking <ChevronIcon /></a>
            <a href="#partner" className="px-2 text-sm font-bold text-[#c8d3db] hover:text-kjapp-cyan">For løyvehavere →</a>
          </div>
          <p className="mt-7 text-xs font-semibold leading-5 text-[#9cafb9]">Lisensierte sjåfører · Tydelig estimat · Live sporing · Norsk support</p>
        </div>
        <PhoneScene />
      </section>

      <section aria-labelledby="launch-proof" className="border-y border-white/[.08] bg-[#071018]/55 py-7">
        <div className="kjapp-shell">
          <div className="mb-5 text-center"><span id="launch-proof" className="text-[10px] font-black uppercase tracking-[.14em] text-kjapp-cyan">Klar for lansering</span></div>
          <div className="grid gap-3 sm:grid-cols-3">
            {socialProof.map((item, index) => <article key={item} className="rounded-2xl border border-white/[.08] bg-[#0a141c]/80 px-4 py-4 text-center shadow-card"><span className="mr-2 text-kjapp-cyan">0{index + 1}</span><strong className="text-sm text-[#f2f7f9]">{item}</strong></article>)}
          </div>
        </div>
      </section>

      <section id="how" className="kjapp-shell grid scroll-mt-24 gap-12 border-b border-white/[.08] py-20 md:py-28 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-20">
        <div>
          <span className="text-[10px] font-black tracking-[.14em] text-kjapp-cyan">SLIK FUNGERER KJAPP</span>
          <h2 className="font-display mt-5 text-[clamp(2.8rem,9vw,5rem)] leading-[.95]">Én reise.<br />Tre enkle steg.</h2>
          <div className="mt-10 grid gap-4">
            {steps.map((step) => <article key={step.number} className="grid grid-cols-[42px_1fr] gap-3 rounded-2xl border border-white/[.08] bg-[#091119]/55 p-4 sm:grid-cols-[48px_1fr] sm:p-5"><span className="pt-1 text-[10px] font-black tracking-[.12em] text-kjapp-cyan">{step.number}</span><div><h3 className="text-base font-extrabold text-white sm:text-lg">{step.title}</h3><p className="mt-2 text-sm leading-6 text-kjapp-copy">{step.copy}</p></div></article>)}
          </div>
        </div>
        <aside className="self-start rounded-[1.6rem] border border-[#29414d] bg-gradient-to-br from-[#0d1b24] to-[#071018] p-6 shadow-card sm:p-8">
          <span className="text-[9px] font-black tracking-[.13em] text-kjapp-cyan">KJAPP GOLD</span>
          <h3 className="font-display mt-5 text-[clamp(2rem,6vw,3.2rem)] leading-[1.02]">Mobilitet først.<br />Teknologien i bakgrunnen.</h3>
          <div className="my-6 h-px bg-white/[.08]" />
          <p className="text-sm leading-7 text-[#b8c5cd]">Destinasjon først<br />Voice når du trenger det<br />Tydelig bilvalg<br />Pris og hentetid før bekreftelse</p>
        </aside>
      </section>

      <section id="voice" className="kjapp-shell grid scroll-mt-24 gap-12 py-20 md:py-28 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-center lg:gap-20">
        <div>
          <span className="text-[10px] font-black tracking-[.14em] text-kjapp-cyan">VOICE BOOKING</span>
          <h2 className="font-display mt-5 text-[clamp(2.7rem,8vw,4.7rem)] leading-[.96] tracking-[-.035em]">Si hvor du skal.<br />KJAPP ordner resten.</h2>
          <p className="mt-6 max-w-2xl text-base leading-7 text-kjapp-copy">Stemmebestilling er bygget inn i selve bestillingen. KJAPP finner destinasjonen og gjør turen klar, mens pris og hentetid alltid kommer fra KJAPP-systemet før du bekrefter.</p>
          <div className="mt-7 flex flex-wrap items-center gap-2 text-xs font-bold text-[#b6c3cb]">
            {['Destinasjon', 'Bilvalg', 'Estimat', 'Bekreft'].map((item, index) => <span key={item} className="flex items-center gap-2"><b className="font-bold">{item}</b>{index < 3 && <i className="h-1 w-1 rounded-full bg-kjapp-cyan" />}</span>)}
          </div>
        </div>
        <div className="rounded-[1.75rem] border border-[#2a414e] bg-gradient-to-b from-[#0c1821] to-[#071018] p-5 shadow-card sm:p-7">
          <div className="flex items-center justify-between rounded-2xl border border-[#2a414e] bg-[#08131b] px-4 py-4"><span className="text-sm font-bold text-[#dfe7eb]">Hvor vil du?</span><button type="button" aria-label="Mikrofon" className="grid h-11 w-11 place-items-center rounded-full bg-kjapp-cyan text-[#001014]"><MicIcon /></button></div>
          <div className="voice-wave mt-7 flex h-12 items-center justify-center gap-1.5" aria-hidden="true">{Array.from({ length: 16 }).map((_, index) => <span key={index} className="w-[3px] rounded-full bg-kjapp-cyan/80" />)}</div>
          <blockquote className="font-display my-7 text-center text-[clamp(1.8rem,6vw,2.65rem)] leading-tight text-white">«Kjør meg til Gardermoen.»</blockquote>
          <div className="flex items-center gap-3 rounded-2xl border border-kjapp-green/20 bg-kjapp-green/[.06] p-4">
            <span className="h-2.5 w-2.5 rounded-full bg-kjapp-green shadow-[0_0_0_6px_rgba(57,229,140,.08)]" />
            <div className="min-w-0 flex-1"><small className="block text-[8px] font-black tracking-[.12em] text-[#9cb0ba]">DESTINASJON FUNNET</small><strong className="mt-1 block text-sm text-white">Oslo lufthavn, Gardermoen</strong></div>
            <b className="grid h-8 w-8 place-items-center rounded-full bg-kjapp-green text-[#052013]">✓</b>
          </div>
          <p className="mt-4 text-xs leading-5 text-[#a1b0ba]">KJAPP-systemet henter tilgjengelige biler, pris og hentetid før bestilling.</p>
        </div>
      </section>

      <section id="vehicles" className="scroll-mt-24 border-y border-white/[.08] bg-[#071018]/50 py-20 md:py-28" aria-labelledby="vehicles-title">
        <div className="kjapp-shell">
          <div className="grid gap-6 lg:grid-cols-[1fr_420px] lg:items-end">
            <div><span className="text-[10px] font-black tracking-[.14em] text-kjapp-cyan">VELG DIN KJAPP</span><h2 id="vehicles-title" className="font-display mt-5 text-[clamp(2.7rem,8vw,4.6rem)] leading-[.98]">Tre måter å reise.</h2></div>
            <p className="m-0 text-sm leading-6 text-kjapp-copy">Samme tydelige bestilling. Ulik plass og komfort. Velg kategori etter reisen — ikke etter kompliserte produktnavn.</p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {vehicles.map((vehicle, index) => (
              <article key={vehicle.name} className="relative overflow-hidden rounded-[1.6rem] border border-[#20333f] bg-gradient-to-b from-[#0d1821] to-[#09121a] p-5 shadow-card">
                <span className="absolute left-5 top-5 z-10 text-[9px] font-black tracking-[.12em] text-[#9aabb6]">0{index + 1}</span>
                <div className="relative mx-auto mt-4 aspect-[1.65/1] w-full max-w-[330px]">
                  <Image src={vehicle.image} alt={`${vehicle.name} kjøretøykategori`} fill sizes="(max-width: 768px) 90vw, 30vw" className="object-contain" />
                </div>
                <h3 className="mt-3 text-xl font-extrabold text-white">{vehicle.name}</h3>
                <p className="mt-2 text-sm leading-6 text-kjapp-copy">{vehicle.description}</p>
                <p className="mt-4 border-t border-white/[.08] pt-4 text-sm font-extrabold leading-6 text-[#e7f4f7]">{vehicle.price}</p>
              </article>
            ))}
          </div>
          <p className="mt-5 text-center text-xs leading-5 text-[#a4b4be]">Prisene varierer etter tid og sted. Du ser alltid fast estimat før du bestiller.</p>
          <span className="sr-only">{vehicleCount} bilkategorier</span>
        </div>
      </section>

      <section className="kjapp-shell py-20 md:py-28">
        <div className="grid gap-8 lg:grid-cols-[1fr_420px] lg:items-end">
          <div><span className="text-[10px] font-black tracking-[.14em] text-kjapp-cyan">HVORFOR KJAPP?</span><h2 className="font-display mt-5 text-[clamp(2.7rem,8vw,4.6rem)] leading-[.98]">Ikke større.<br />Bare smartere og nærmere.</h2></div>
          <p className="m-0 text-sm leading-6 text-kjapp-copy">KJAPP kombinerer lokale løyvehavere og lisensierte sjåfører med en moderne bestillingsopplevelse bygget for Norge. Teknologien skal gjøre turen enklere — ikke gjøre appen mer komplisert.</p>
        </div>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {values.map(([number, title, copy]) => (
            <article key={number} className="rounded-2xl border border-white/[.08] bg-[#091119]/65 p-5"><span className="text-[9px] font-black tracking-[.12em] text-kjapp-cyan">{number}</span><h3 className="mt-6 text-lg font-black tracking-[.04em] text-white">{title}</h3><p className="mt-3 text-sm leading-6 text-kjapp-copy">{copy}</p></article>
          ))}
        </div>
      </section>

      <section id="partner" className={`scroll-mt-24 border-y bg-[radial-gradient(circle_at_80%_20%,rgba(0,229,245,.08),transparent_24rem),#071018] py-20 md:py-28 ${driverSelected ? 'border-kjapp-cyan/35' : 'border-white/[.08]'}`}>
        <div className="kjapp-shell grid gap-10 lg:grid-cols-[minmax(0,1fr)_460px] lg:items-center lg:gap-20">
          <div>
            <span className="text-[10px] font-black tracking-[.14em] text-kjapp-cyan">BYGGET OGSÅ FOR DE SOM KJØRER</span>
            <h2 className="font-display mt-5 text-[clamp(2.7rem,8vw,4.6rem)] leading-[.98]">Din virksomhet.<br />Moderne verktøy rundt turene.</h2>
            <p className="mt-6 max-w-2xl text-base leading-7 text-kjapp-copy">KJAPP gir sjåfører og løyvehavere et samlet økosystem for turer, aktivitet, dokumentasjon og oppgjør — uten at partnerbudskapet tar over kundeopplevelsen.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <BetaButton onClick={() => openWaitlist('Sjåfør')} driverHighlight={driverSelected} />
              <a href="https://fleet.kjappapp.no" className="inline-flex min-h-12 items-center rounded-xl border border-[#314653] bg-[#091119] px-5 text-sm font-bold text-white">Åpne Fleet Panel</a>
            </div>
          </div>
          <div className="rounded-[1.6rem] border border-[#28404d] bg-gradient-to-br from-[#0e1c26] to-[#081119] p-6 shadow-card sm:p-8">
            <span className="text-[9px] font-black tracking-[.14em] text-kjapp-cyan">FLEET PANEL</span>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {['Sjåfører', 'Turer', 'Dokumenter', 'Oppgjør'].map((item) => <strong key={item} className="rounded-xl border border-white/[.08] bg-white/[.025] p-4 text-sm text-white">{item}</strong>)}
            </div>
            <p className="mt-5 text-xs leading-5 text-[#a4b4be]">Partnerøkonomi, dokumentasjon og drift samles i egne verktøy for løyvehavere.</p>
          </div>
        </div>
      </section>

      <section id="beta" className="kjapp-shell py-20 text-center md:py-28">
        <span className="text-[10px] font-black tracking-[.14em] text-kjapp-cyan">KJAPP BETA</span>
        <h2 className="font-display mx-auto mt-5 max-w-3xl text-[clamp(2.8rem,9vw,5rem)] leading-[.96]">Klar når du er.</h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-kjapp-copy">KJAPP er fortsatt i beta. App Store- og Google Play-lenker vises først når de faktisk er aktive.</p>
        <div className="mt-8 flex justify-center"><BetaButton onClick={() => openWaitlist(driverSelected ? 'Sjåfør' : 'Passasjer')} /></div>
      </section>

      <footer className="border-t border-white/[.08] bg-[#04090d] py-12">
        <div className="kjapp-shell grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-20">
          <div>
            <Wordmark />
            <p className="mt-4 text-sm font-semibold text-[#c0ccd3]">Norsk taxi. Uten omveier.</p>
            <p className="mt-3 text-xs leading-5 text-[#9daeb8]">Org.nr. 999 999 999 NexoraHub AS</p>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            <div><h3 className="text-sm font-extrabold text-white">For kunder</h3><nav className="mt-4 grid gap-3 text-sm text-[#aebdc6]"><a href="#how">Hvordan det fungerer</a><a href="#vehicles">Bilvalg</a><a href="#vehicles">Priser</a><a href="https://kjappapp.no/help">FAQ</a></nav></div>
            <div><h3 className="text-sm font-extrabold text-white">For sjåfører</h3><nav className="mt-4 grid gap-3 text-sm text-[#aebdc6]"><a href="#partner">Bli sjåfør</a><a href="https://kjappapp.no/loyvehaver">Løyvehaver</a><a href="https://fleet.kjappapp.no">Fleet Panel</a></nav></div>
            <div><h3 className="text-sm font-extrabold text-white">Kontakt</h3><nav className="mt-4 grid gap-3 break-words text-sm text-[#aebdc6]"><a href="mailto:support@kjappapp.no">support@kjappapp.no</a><a href="/personvern">Personvernerklæring</a><a href="/vilkar">Bruksvilkår</a></nav></div>
          </div>
        </div>
        <div className="kjapp-shell mt-10 border-t border-white/[.06] pt-6 text-xs text-[#91a3ae]">© 2026 KJAPP · NexoraHub AS</div>
      </footer>

      <WaitlistModal open={waitlistOpen} role={waitlistRole} onRoleChange={setWaitlistRole} onClose={() => setWaitlistOpen(false)} />
      <CookieBanner />
    </main>
  );
}
