import Link from 'next/link';

const FLEET_URL = 'https://fleet.kjappapp.no';
const partnerValues = [
  ['01', '14 % SERVICEAVGIFT', 'En tydelig modell. 86 % av turinntekten beholdes hos sjåfør/løyvehaver før øvrige egne kostnader.'],
  ['02', 'UKENTLIG OPPGJØR', 'Digitale betalinger kan avregnes automatisk hver uke. Kontantturer registreres separat.'],
  ['03', 'FULL OVERSIKT', 'Sjåfører, turer, økonomi og dokumentstatus samlet i Fleet Panel.'],
  ['04', 'NORSK OPPFØLGING', 'Direkte kontakt når konto, dokumentasjon eller oppgjør må avklares.'],
];
const steps = [
  ['01', 'Send søknad', 'Firma, kontaktinformasjon, løyver og kjøretøy.'],
  ['02', 'Dokumentasjon', 'Løyvebevis, vognkort, forsikring og bankinformasjon.'],
  ['03', 'KJAPP kontrollerer', 'Søknaden og dokumentasjonen gjennomgås før aktivering.'],
  ['04', 'Fleet åpnes', 'Godkjente partnere får tilgang til Fleet Panel.'],
];

function Wordmark() {
  return <Link href="/" className="inline-flex items-baseline text-[25px] font-black tracking-[-.06em]">KJ<span className="text-kjapp-cyan">A</span>PP</Link>;
}

export default function LoyvehaverPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_80%_8%,rgba(0,229,245,.08),transparent_30rem)] bg-kjapp-bg text-white">
      <header className="mx-auto flex h-[86px] w-[min(1240px,calc(100%-32px))] items-center justify-between border-b border-white/10 sm:w-[min(1240px,calc(100%-80px))]">
        <Wordmark />
        <nav className="hidden items-center gap-7 text-[13px] font-semibold text-[#cbd6dc] md:flex"><Link href="/">Kunder</Link><a href="mailto:driver@kjappapp.no">Sjåfører</a><Link href="/loyvehaver">Løyvehavere</Link><a href={FLEET_URL}>Fleet Panel</a><Link href="/help">Hjelp</Link><Link href="/loyvehaver/soknad" className="rounded-xl bg-kjapp-cyan px-5 py-3 font-extrabold text-[#001014]">Bli partner</Link></nav>
      </header>

      <section className="mx-auto grid min-h-[700px] w-[min(1240px,calc(100%-32px))] items-center gap-14 py-16 lg:grid-cols-[1fr_420px] sm:w-[min(1240px,calc(100%-80px))]">
        <div><span className="rounded-full border border-kjapp-cyan/60 px-3 py-2 text-[10px] font-extrabold tracking-[.12em] text-kjapp-cyan">FOR LØYVEHAVERE</span><h1 className="mt-8 font-display text-[clamp(3.4rem,7vw,5.2rem)] leading-[.96] tracking-[-.06em]">DIN FLÅTE.<br/>DIN KONTROLL.</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-[#b9c6ce]">KJAPP gir løyvehavere et moderne system for sjåfører, turer, økonomi og dokumentasjon — uten å ta virksomheten fra deg.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/loyvehaver/soknad" className="rounded-xl bg-kjapp-cyan px-6 py-4 font-extrabold text-[#001014]">Søk om å bli partner</Link><a href={FLEET_URL} className="rounded-xl border border-[#30424f] bg-[#091119] px-6 py-4 font-bold">Åpne Fleet Panel</a></div><p className="mt-6 text-xs text-[#9bacb7]">14 % serviceavgift · 86 % beholdes · Fleet Panel · Norsk oppfølging</p></div>
        <aside className="rounded-[26px] border border-[#26364b] bg-gradient-to-br from-[#08111b] to-[#0d1927] p-6 shadow-2xl"><div className="flex items-center justify-between border-b border-[#1f3044] pb-5"><div><div className="text-[10px] font-black tracking-[.08em] text-kjapp-cyan">KJAPP FLEET</div><div className="mt-2 text-xl font-black">Din flåte. Din kontroll.</div></div><span className="text-[10px] text-[#91a1ab]">LIVE</span></div><div className="mt-5 grid grid-cols-2 gap-3">{['Sjåfører','Turer','Økonomi','Dokumenter'].map((item)=><div key={item} className="min-h-[80px] rounded-xl border border-[#24344a] bg-[#0b1522] p-4 text-sm font-bold">{item}</div>)}</div><div className="relative mt-4 min-h-[180px] overflow-hidden rounded-2xl border border-[#24344a] bg-[#07121e] p-5"><span className="text-[10px] font-bold text-kjapp-cyan">LIVE FLÅTE</span><div className="absolute left-1/3 top-1/2 h-3 w-3 rounded-full bg-kjapp-cyan shadow-[0_0_0_6px_rgba(0,229,245,.12)]"/><div className="absolute bottom-4 text-[10px] text-[#91a1ab]">Reelle flåtedata vises etter innlogging.</div></div></aside>
      </section>

      <section className="mx-auto grid w-[min(1240px,calc(100%-32px))] gap-8 border-y border-white/10 py-24 lg:grid-cols-2 sm:w-[min(1240px,calc(100%-80px))]"><div><span className="text-[10px] font-extrabold tracking-[.12em] text-kjapp-cyan">KJAPP PARTNER</span><h2 className="mt-5 font-display text-[clamp(2.8rem,5vw,4rem)] leading-[1.02] tracking-[-.05em]">Jobb mindre.<br/>Behold mer.</h2><p className="mt-5 max-w-xl text-[#b9c6ce]">En enkel serviceavgift og ett kontrollpanel. Ved digitale betalinger legges det opp til automatisk ukentlig avregning. Kontantturer kan registreres og avstemmes separat.</p></div><div className="rounded-3xl border border-kjapp-cyan/20 bg-kjapp-cyan/5 p-8"><strong className="font-display text-7xl text-kjapp-cyan">14%</strong><p className="mt-3 text-lg">serviceavgift<br/>86% beholdes</p></div></section>

      <section className="mx-auto grid w-[min(1240px,calc(100%-32px))] gap-12 py-24 lg:grid-cols-[1fr_420px] sm:w-[min(1240px,calc(100%-80px))]"><div><span className="text-[10px] font-extrabold tracking-[.12em] text-kjapp-cyan">SLIK BLIR DU PARTNER</span><h2 className="mt-5 font-display text-[clamp(2.8rem,5vw,4rem)] leading-[1.02] tracking-[-.05em]">Én kontrollert<br/>vei inn.</h2><div className="mt-8 grid gap-4">{steps.map(([n,t,c])=><article key={n} className="grid grid-cols-[50px_1fr] gap-4 border-t border-white/10 pt-4"><span className="text-xs text-kjapp-cyan">{n}</span><div><h3 className="text-lg font-bold">{t}</h3><p className="mt-2 text-sm leading-6 text-[#aebbc4]">{c}</p></div></article>)}</div></div><aside className="rounded-3xl border border-[#253744] bg-[#0a141c] p-7"><span className="text-[10px] font-bold tracking-[.12em] text-kjapp-cyan">FLEET PANEL</span><h3 className="mt-4 font-display text-3xl">Alt du trenger.<br/>Samlet på ett sted.</h3><p className="mt-5 leading-8 text-[#aebbc4]">Sjåfører og status<br/>Turer og historikk<br/>Økonomi og oppgjør<br/>Dokumenter og godkjenning</p><a href={FLEET_URL} className="mt-6 inline-flex rounded-xl bg-kjapp-cyan px-5 py-3 font-bold text-[#001014]">Logg inn Fleet</a></aside></section>

      <section className="mx-auto w-[min(1240px,calc(100%-32px))] pb-24 sm:w-[min(1240px,calc(100%-80px))]"><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">{partnerValues.map(([n,t,c])=><article key={n} className="rounded-2xl border border-[#20313d] bg-[#091119] p-5"><span className="text-[10px] text-kjapp-cyan">{n}</span><h3 className="mt-4 text-sm font-black">{t}</h3><p className="mt-3 text-sm leading-6 text-[#aebbc4]">{c}</p></article>)}</div><div className="mt-16 rounded-3xl border border-kjapp-cyan/20 bg-kjapp-cyan/5 p-8 text-center"><span className="text-[10px] font-extrabold tracking-[.12em] text-kjapp-cyan">KLAR FOR NESTE STEG?</span><h2 className="mt-4 font-display text-4xl">Bli KJAPP-partner.</h2><p className="mx-auto mt-4 max-w-2xl text-[#b9c6ce]">Søknaden gir ikke automatisk tilgang. Fleet-konto aktiveres etter at KJAPP har kontrollert og godkjent dokumentasjonen.</p><Link href="/loyvehaver/soknad" className="mt-6 inline-flex rounded-xl bg-kjapp-cyan px-6 py-4 font-extrabold text-[#001014]">Start søknaden</Link></div></section>
    </main>
  );
}
