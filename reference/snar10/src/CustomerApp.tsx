import { useEffect, useState, type ReactNode } from "react";
import ExperienceStudio from "./snar10/ExperienceStudio";
import { Icon, SnarMark, SplashMark, SnarMap, Phone, Dock, Island, TopBar, Avatar, StateView, Stage, useProto, useProgress, type MapProps, type ScreenMeta } from "./snar10/kit";

const DRIVER_IMG = "https://images.unsplash.com/photo-1676989859871-150f3579862a?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=240&h=240&q=80";
const USER_IMG = "https://images.unsplash.com/photo-1730573520149-7a5b97d35ccc?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=240&h=240&q=80";
const car = (id: string) => `https://images.unsplash.com/${id}?q=80&w=900&auto=format&fit=crop`;
const CARS = [
  { id: "standard", name: "Standard", seats: 4, eta: 3, price: 184, img: car("photo-1560958089-b8a1929cea89"), note: "Elbil" },
  { id: "comfort", name: "Comfort", seats: 4, eta: 5, price: 239, img: car("photo-1580273916550-e323be2ae537"), note: "Mer benplass" },
  { id: "xl", name: "XL", seats: 6, eta: 7, price: 312, img: car("photo-1549317661-bd32c8ce0db2"), note: "3+ kofferter" },
  { id: "premium", name: "Premium", seats: 4, eta: 6, price: 348, img: car("photo-1563720223185-11003d516935"), note: "Toppsjåfører" },
];

const SCREENS: ScreenMeta[] = [
  ["splash", "01", "Splash", "Start", "Et lysspor beveger seg gjennom chevronene på 1,6 s, og så toner merket over i kartet. Ingen spinner.", undefined],
  ["returning", "02", "Hjem, kjent bruker", "Start", "Kameraet glir inn fra bred til middels zoom (700 ms ease-in-out). Hilsenen tones inn 60 ms etter.", undefined],
  ["onboarding", "03", "Introduksjon", "Start", "Én skjerm. Fordelene glir inn med 60 ms forsinkelse mellom hver.", "Lett ved CTA"],
  ["signin", "04", "Logg inn", "Start", "Feltet får fokus, og tastaturet løfter arket med spring.", "Lett"],
  ["permission", "05", "Posisjon", "Start", "Brukerens punkt pulserer før tillatelsen blir bedt om.", "Lett"],
  ["home", "06", "Hjem / kart", "Bestilling", "Bilene interpolerer mellom GPS-punkter (1,8 s lineært) og roterer etter kurs.", undefined],
  ["search", "07", "Søk destinasjon", "Bestilling", "Søkefeltet vokser ut fra hjem-kortet, kartet dimmes til 55 %, og radene glir inn.", "Lett ved valg"],
  ["route", "08", "Ruteforhåndsvisning", "Bestilling", "Kameraet zoomer ut for å vise hele turen, og ruten tegnes progressivt (900 ms).", "Lett"],
  ["vehicles", "09", "Kjøretøyvalg", "Bestilling", "Valgt kategori skaleres til 1,0 og prisen oppdateres uten layout-hopp.", "Lett per valg"],
  ["payment", "10", "Betaling", "Bestilling", "Arket glir opp med spring (280 ms) over valget.", "Lett"],
  ["confirm", "11", "Bekreft", "Bestilling", "Kompakt oppsummering. CTA presses ned til 0,97 ved trykk.", "Medium ved bestilling"],
  ["searching", "12", "Søker sjåfør", "Tur", "Romlige pulser og et sveip rundt hentepunktet, og bilene i nærheten markeres.", undefined],
  ["match", "13", "Sjåfør funnet", "Tur", "Søkearket forvandles til sjåførkortet, og den valgte bilen løftes på kartet.", "Medium · sjåfør funnet"],
  ["approaching", "14", "Sjåfør nærmer seg", "Tur", "Sjåføren følger ruten live, og ETA-taggen følger bilen.", undefined],
  ["pickupGuide", "15", "Henteveiledning", "Tur", "Nær zoom viser innganger og fotgjengerlinje mot inngang B.", "Lett"],
  ["arrived", "16", "Sjåfør har ankommet", "Tur", "Kartet trer tilbake, og bilens identitet skaleres opp.", "Medium · ankommet"],
  ["trip", "17", "Tur pågår", "Tur", "Kameraet følger bilen. Fullført rute er nedtonet. Sveip ned minimerer til Island.", undefined],
  ["safety", "18", "Sikkerhet", "Tur", "Arket åpnes rolig. Nødanrop krever ett ekstra bevisst steg.", "Advarsel ved nødanrop"],
  ["arriving", "19", "Ankommer", "Tur", "Kameraet zoomer inn mot destinasjonen, og arket forbereder fullføring.", "Lett"],
  ["complete", "20", "Tur fullført", "Etter tur", "Ruten løses opp i et sammendrag: kartet zoomer ut, og tallene teller opp.", "Medium"],
  ["paid", "21", "Betaling fullført", "Etter tur", "Haken tegnes på 320 ms. Ingen konfetti.", "Medium · betalt"],
  ["receipt", "22", "Kvittering", "Etter tur", "Radene glir inn i rekkefølge.", undefined],
  ["rating", "23", "Vurdering", "Etter tur", "Stjernene fylles med spring. Hopp over er alltid synlig.", "Lett per stjerne"],
  ["activity", "24", "Aktivitet", "Konto", "Listen glir inn. Island beholdes over docken.", "Lett"],
  ["tripDetail", "25", "Turdetalj", "Konto", "Kartutsnittet ekspanderer fra radens miniatyr.", undefined],
  ["messages", "26", "Meldinger", "Konto", "Nye bobler skaleres inn fra sendeknappen.", "Lett ved sending"],
  ["notifications", "27", "Varsler", "Konto", "Grupper kollapses og ekspanderes med høydeanimasjon.", undefined],
  ["ai", "28", "SNAR AI", "Intelligens", "Intensjon blir til et strukturert objekt som skaleres inn (320 ms spring).", "Lett"],
  ["voice", "29", "Stemme", "Intelligens", "Lytter → forstår → resultat → bekreftelse. Kartet forblir synlig.", "Lett · medium ved bekreftelse"],
  ["profile", "30", "Profil", "Konto", "", undefined],
  ["paymethods", "31", "Betalingsmåter", "Konto", "", "Lett ved standardvalg"],
  ["support", "32", "Support", "Konto", "Aktiv tur oppdages og festes øverst.", undefined],
  ["accessibility", "33", "Tilgjengelighet", "Konto", "Bryterne gir umiddelbar forhåndsvisning.", "Lett per bryter"],
  ["settings", "34", "Innstillinger", "Konto", "", undefined],
  ["scheduled", "35", "Planlagt tur", "Bestilling", "Tidshjulet snapper til 5-minutters intervaller.", "Lett per hakk"],
  ["states", "36", "Tomme / feil / offline", "Tilstander", "Hver tilstand har én tydelig vei videre.", "Advarsel ved betalingsfeil"],
].map(([id, n, title, group, motion, haptic]) => ({ id, n, title, group, motion: motion || "Standard komponentovergang (210 ms ease-out).", haptic })) as ScreenMeta[];

const TRIP_SCREENS = ["searching", "match", "approaching", "pickupGuide", "arrived", "trip", "safety", "arriving"];
const DOCK = [
  { id: "home", label: "Hjem", icon: "home" }, { id: "activity", label: "Aktivitet", icon: "activity" },
  { id: "ai", label: "SNAR AI", icon: "ai", ai: true }, { id: "messages", label: "Meldinger", icon: "message", dot: true }, { id: "profile", label: "Profil", icon: "profile" },
];
const TRIP_DOCK = [
  { id: "driver", label: "Sjåfør", icon: "driver" }, { id: "messages", label: "Melding", icon: "message", dot: true },
  { id: "safety", label: "Sikkerhet", icon: "safety" }, { id: "trip", label: "Tur", icon: "trip" },
];

function mapFor(s: string, t: number): MapProps | null {
  switch (s) {
    case "returning": case "home": case "permission": case "voice": return { cam: "home", showPickup: true, pulse: true };
    case "search": return { cam: "search", showPickup: true, dim: 0.55 };
    case "route": case "vehicles": case "payment": case "confirm": case "scheduled": return { cam: "route", route: "preview", showPickup: true, showDest: true, destLabel: "Oslo S", offsetY: -150 };
    case "searching": return { cam: "driverSearch", searching: true, showPickup: true, pulse: true, offsetY: -120 };
    case "match": return { cam: "approach", route: "approach", showPickup: true, driver: { t: 0, path: "approach", eta: "4 min" }, offsetY: -160 };
    case "approaching": return { cam: "approach", route: "approach", progress: 0.2 + t * 0.6, showPickup: true, driver: { t: 0.2 + t * 0.6, path: "approach", eta: `${Math.max(1, Math.round(3 - t * 2))} min` }, offsetY: -140 };
    case "pickupGuide": return { cam: "pickup", showPickup: true, pulse: true, fleet: false, driver: { t: 0.93, path: "approach", eta: "190 m" }, offsetY: -160 };
    case "arrived": return { cam: "pickup", showPickup: true, fleet: false, driver: { t: 1, path: "approach" }, dim: 0.25, offsetY: -200 };
    case "trip": case "safety": return { cam: "trip", route: "trip", progress: 0.1 + t * 0.7, showDest: true, destLabel: "Oslo S", driver: { t: 0.1 + t * 0.7, path: "trip" }, fleet: false, offsetY: -100, dim: s === "safety" ? 0.35 : 0 };
    case "arriving": return { cam: "arrival", route: "trip", progress: 0.92, showDest: true, destLabel: "Oslo S", driver: { t: 0.92, path: "trip", eta: "1 min" }, fleet: false, offsetY: -140 };
    case "complete": return { cam: "route", route: "trip", progress: 1, showPickup: true, showDest: true, fleet: false, offsetY: -200 };
    default: return null;
  }
}

/* Shared presentational pieces */
const Sheet = ({ children, k }: { children: ReactNode; k?: string }) => <div className="s10-sheet" key={k}>{children}</div>;
const Row = ({ icon, title, sub, right, onClick }: { icon?: string; title: ReactNode; sub?: ReactNode; right?: ReactNode; onClick?: () => void }) => {
  const Inner = <>{icon && <span className="s10-ico"><Icon name={icon} size={20} /></span>}<span style={{ flex: 1, minWidth: 0 }}><span className="t-body-m" style={{ display: "block" }}>{title}</span>{sub && <span className="t-cap" style={{ display: "block", marginTop: 2 }}>{sub}</span>}</span>{right ?? (onClick && <Icon name="chevR" size={18} style={{ color: "var(--text-tertiary)" }} />)}</>;
  return onClick ? <button className="s10-row" onClick={onClick}>{Inner}</button> : <div className="s10-row">{Inner}</div>;
};
const Journey = ({ from = "Bogstadveien 27", to = "Oslo S", fromSub, toSub }: { from?: string; to?: string; fromSub?: string; toSub?: string }) => (
  <div style={{ display: "grid", gridTemplateColumns: "20px 1fr", columnGap: 12, rowGap: 14 }}>
    <span style={{ display: "grid", placeItems: "center" }}><i style={{ width: 10, height: 10, borderRadius: 5, background: "var(--primary)" }} /></span>
    <div><div className="t-body-m">{from}</div>{fromSub && <div className="t-cap">{fromSub}</div>}</div>
    <span style={{ display: "grid", placeItems: "center" }}><i style={{ width: 10, height: 10, borderRadius: 3, background: "var(--surface-inverse)" }} /></span>
    <div><div className="t-body-m">{to}</div>{toSub && <div className="t-cap">{toSub}</div>}</div>
  </div>
);
const DriverCard = ({ compact }: { compact?: boolean }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
    <Avatar name="Jonas Berg" src={DRIVER_IMG} size={compact ? 48 : 56} />
    <div style={{ flex: 1 }}>
      <div className="t-body-m">Jonas <span className="t-cap num" style={{ marginLeft: 4 }}>★ 4,96</span></div>
      <div className="t-sec">Svart Tesla Model 3</div>
    </div>
    <div style={{ textAlign: "right" }}>
      <div className="num" style={{ fontSize: 15, fontWeight: 650, letterSpacing: ".06em", padding: "6px 10px", borderRadius: 10, background: "var(--surface-subtle)", border: "1px solid var(--divider-strong)" }}>EV 12345</div>
    </div>
  </div>
);
const CommRow = ({ go }: { go: (id: string, h?: string) => void }) => (
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
    <button className="s10-btn soft sm" onClick={() => go("messages", "lett")}><Icon name="message" size={18} />Melding</button>
    <button className="s10-btn soft sm" onClick={() => go("approaching", "lett")}><Icon name="phone" size={18} />Ring</button>
    <button className="s10-btn soft sm" onClick={() => go("safety", "lett")}><Icon name="safety" size={18} />Sikkerhet</button>
  </div>
);
const Scroll = ({ children }: { children: ReactNode }) => <div className="s10-scroll s10-fade">{children}</div>;
const Sec = ({ title, children }: { title: string; children: ReactNode }) => <section style={{ marginTop: 24 }}><div className="t-over" style={{ margin: "0 4px 10px" }}>{title}</div>{children}</section>;

export function CustomerApp() {
  const p = useProto("splash");
  const { screen, go } = p;
  const [veh, setVeh] = useState("standard");
  const [pay, setPay] = useState("Visa ·· 4821");
  const [inside, setInside] = useState(false);
  const [rating, setRating] = useState(0);
  const [aiState, setAiState] = useState<"idle" | "result">("idle");
  const [voice, setVoice] = useState<"listening" | "understanding" | "result">("listening");
  const [tripLive, setTripLive] = useState<string | null>(null);
  const [txt, setTxt] = useState({ big: false, contrast: false, motion: false, voice: true });
  const sel = CARS.find((c) => c.id === veh)!;

  useEffect(() => { if (TRIP_SCREENS.includes(screen)) setTripLive(screen); if (["complete", "paid", "receipt", "rating"].includes(screen)) setTripLive(null); }, [screen]);
  useEffect(() => {
    const auto: Record<string, [string, number, string?]> = { splash: ["returning", 2300], searching: ["match", 3200, "medium · sjåfør funnet"], match: ["approaching", 2600] };
    const a = auto[screen];
    if (!a) return;
    const tm = setTimeout(() => go(a[0], a[2]), a[1]);
    return () => clearTimeout(tm);
  }, [screen]);
  useEffect(() => {
    if (screen !== "voice") return;
    setVoice("listening");
    const a = setTimeout(() => setVoice("understanding"), 1800), b = setTimeout(() => setVoice("result"), 3000);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [screen]);

  const tApproach = useProgress(screen === "approaching", 6300);
  const tTrip = useProgress(screen === "trip", 8100, () => go("arriving", "lett"));
  const t = screen === "approaching" ? tApproach : tTrip;
  const m = mapFor(screen, t);
  const motionPref = txt.motion ? "reduced" : p.motion;

  const island = (() => {
    const st = tripLive;
    if (!st || TRIP_SCREENS.includes(screen)) return null;
    const map: Record<string, [string, string, string | undefined, string, number]> = {
      searching: ["Søker sjåfør", "Koordinerer biler i nærheten", undefined, "ai", 0.05],
      match: ["Sjåfør funnet", "Jonas · Svart Tesla · EV 12345", "4", "driver", 0.15],
      approaching: ["Sjåfør på vei", "Svart Tesla · EV 12345", "3", "vehicle", 0.3],
      pickupGuide: ["Sjåføren er nær", "Mot inngang B · 190 m", "1", "pickup", 0.4],
      arrived: ["Sjåføren venter", "EV 12345 · inngang B", "0:42", "vehicle", 0.45],
      trip: ["Tur pågår", "Til Oslo S · ankomst 10:02", "11", "trip", 0.65],
      safety: ["Tur pågår", "Til Oslo S", "11", "trip", 0.65],
      arriving: ["Nesten fremme", "Oslo S · 400 m", "1", "destination", 0.92],
    };
    const v = map[st];
    return <Island title={v[0]} sub={v[1]} eta={v[2]} etaUnit={v[2]?.includes(":") ? "" : "min"} icon={v[3]} progress={v[4]} onClick={() => go(st, "lett")} />;
  })();

  const dockFor = (active: string) => <Dock items={DOCK} active={active} onSelect={(id) => go(id === "home" ? "home" : id, "lett")} />;
  const tripDock = (active: string) => <Dock items={TRIP_DOCK} active={active} onSelect={(id) => go(id === "driver" ? (tripLive ?? "approaching") : id === "trip" ? "tripDetail" : id, "lett")} />;

  const content = (() => {
    switch (screen) {
      case "splash": return <div className="s10-fade" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "var(--surface-inverse)", color: "var(--on-inverse)" }}><SplashMark /></div>;

      case "returning": case "home": return (<>
        <div className="s10-in" style={{ position: "absolute", top: 58, left: 20, right: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="s10-glass" style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 14px 6px 6px", borderRadius: 16 }}>
            <Avatar name="Ingrid Lie" src={USER_IMG} size={32} />
            <span className="t-sec" style={{ color: "var(--text-primary)", fontWeight: 550 }}>{screen === "returning" ? "God morgen, Ingrid" : "Majorstuen"}</span>
          </div>
          <button className="s10-icbtn s10-glass" aria-label="Varsler" onClick={() => go("notifications", "lett")} style={{ position: "relative" }}><Icon name="bell" /><i style={{ position: "absolute", top: 12, right: 13, width: 7, height: 7, borderRadius: 4, background: "var(--primary)" }} /></button>
        </div>
        <div style={{ position: "absolute", right: 20, bottom: 520, display: "grid", gap: 8 }}>
          <button className="s10-icbtn s10-glass" aria-label="Snakk med SNAR" onClick={() => go("voice", "lett")}><Icon name="voice" /></button>
          <button className="s10-icbtn s10-glass" aria-label="Min posisjon"><Icon name="locate" /></button>
        </div>
        <div className="s10-sheet" style={{ bottom: 0, paddingBottom: 108 }}>
          <ExperienceStudio product="customer" value={veh} onChange={setVeh} onContinue={() => go("route", "lett")} />
          <button className="s10-input" style={{ width: "100%", height: 60, background: "var(--surface-subtle)" }} onClick={() => go("search", "lett")}>
            <Icon name="search" /><span className="t-body-m" style={{ flex: 1, textAlign: "left", fontSize: 18 }}>Hvor skal du?</span>
            <span className="s10-chip" style={{ background: "var(--surface)", height: 34 }} onClick={(e) => { e.stopPropagation(); go("scheduled", "lett"); }}><Icon name="clock" size={16} />Nå</span>
          </button>
          <div style={{ display: "flex", gap: 8, marginTop: 12, overflow: "hidden" }}>
            {[["home", "Hjem", "12 min"], ["work", "Jobb", "9 min"], ["clock", "Oslo S", "11 min"]].map(([i, l, e]) => (
              <button key={l} className="s10-chip" onClick={() => go("route", "lett")} style={{ height: 44, flex: 1, justifyContent: "flex-start" }}><Icon name={i} size={18} />{l}<span className="t-cap num" style={{ marginLeft: "auto" }}>{e}</span></button>
            ))}
          </div>
        </div>
        {island ?? null}
        {dockFor("home")}
      </>);

      case "onboarding": return (
        <div style={{ position: "absolute", inset: 0, padding: "96px 24px 40px", display: "flex", flexDirection: "column" }}>
          <SnarMark size={48} />
          <div className="t-display s10-in" style={{ marginTop: 32 }}>Reis enkelt.<br /><span style={{ color: "var(--text-tertiary)" }}>Hele Norge.</span></div>
          <div style={{ marginTop: 40, display: "grid", gap: 22 }}>
            {[["vehicle", "Lokale løyvehavere", "Godkjente sjåfører og elbiler fra norske taxiselskaper."], ["clock", "Fast pris før du bestiller", "Ingen overraskelser. Prisen du ser er prisen du betaler."], ["ai", "Si hva du trenger", "«Fly kl. 08:20 fra Gardermoen» — SNAR planlegger resten."]].map(([i, h, b], k) => (
              <div key={h} className={`s10-in${k ? "-" + (k + 1) : ""}`} style={{ display: "flex", gap: 16 }}>
                <span className="s10-ico"><Icon name={i} size={20} /></span>
                <div><div className="t-body-m">{h}</div><div className="t-sec">{b}</div></div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "auto", display: "grid", gap: 4 }}>
            <button className="s10-btn primary" onClick={() => go("signin", "lett")}>Kom i gang</button>
            <button className="s10-btn ghost" onClick={() => go("signin")}>Jeg har allerede konto</button>
          </div>
        </div>);

      case "signin": return (
        <div style={{ position: "absolute", inset: 0, padding: "70px 24px 40px", display: "flex", flexDirection: "column" }}>
          <TopBar onBack={() => go("onboarding")} />
          <div className="t-title">Logg inn</div>
          <p className="t-sec" style={{ marginTop: 6 }}>Vi sender en kode på SMS. Ingen passord.</p>
          <div className="s10-input" style={{ marginTop: 28 }}><span className="t-body-m num">🇳🇴 +47</span><span style={{ width: 1, height: 24, background: "var(--divider-strong)" }} /><input aria-label="Telefonnummer" defaultValue="912 34 567" className="num" /></div>
          <button className="s10-btn primary" style={{ marginTop: 12 }} onClick={() => go("permission", "lett")}>Send kode</button>
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0" }}><i style={{ flex: 1, height: 1, background: "var(--divider)" }} /><span className="t-cap">eller</span><i style={{ flex: 1, height: 1, background: "var(--divider)" }} /></div>
          <div style={{ display: "grid", gap: 8 }}>
            <button className="s10-btn ink" onClick={() => go("permission", "lett")}><Icon name="apple" />Fortsett med Apple</button>
            <button className="s10-btn soft" onClick={() => go("permission", "lett")}><Icon name="google" />Fortsett med Google</button>
          </div>
          <p className="t-cap" style={{ marginTop: "auto", textAlign: "center", lineHeight: "18px" }}>Ved å fortsette godtar du SNARs <u>vilkår</u> og <u>personvernerklæring</u>. Data lagres i EØS.</p>
        </div>);

      case "permission": return (
        <Sheet k="perm">
          <span className="s10-ico" style={{ background: "var(--primary-soft)", color: "var(--primary)", width: 48, height: 48, borderRadius: 14 }}><Icon name="locate" /></span>
          <div className="t-title" style={{ marginTop: 18 }}>Hvor står du nå?</div>
          <p className="t-sec" style={{ marginTop: 8 }}>SNAR bruker posisjonen din for å finne nærmeste bil og sende sjåføren til riktig inngang. Vi deler den bare under aktive turer.</p>
          <div style={{ display: "grid", gap: 4, marginTop: 24 }}>
            <button className="s10-btn primary" onClick={() => go("home", "lett")}>Del posisjon</button>
            <button className="s10-btn ghost" onClick={() => go("states")}>Skriv inn adresse selv</button>
          </div>
        </Sheet>);

      case "search": return (
        <div className="s10-sheet" style={{ top: 54, borderRadius: 30, paddingBottom: 0, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "20px 1fr", gap: "8px 12px", alignItems: "center" }}>
            <i style={{ width: 10, height: 10, borderRadius: 5, background: "var(--primary)", justifySelf: "center" }} />
            <div className="s10-input" style={{ height: 48 }}><span className="t-sec" style={{ color: "var(--text-primary)" }}>Nåværende posisjon · Bogstadveien 27</span></div>
            <i style={{ width: 10, height: 10, borderRadius: 3, background: "var(--surface-inverse)", justifySelf: "center" }} />
            <div className="s10-input" style={{ height: 48, boxShadow: "inset 0 0 0 1.5px var(--text-primary)" }}><input autoFocus aria-label="Destinasjon" defaultValue="Oslo S" /><Icon name="x" size={18} /></div>
          </div>
          <div style={{ display: "flex", gap: 8, margin: "16px 0 8px" }}>
            {["Hjem", "Jobb", "Gardermoen"].map((c) => <button key={c} className="s10-chip" onClick={() => go("route", "lett")}>{c}</button>)}
          </div>
          <div className="t-over" style={{ margin: "16px 0 4px" }}>Resultater</div>
          {[["destination", "Oslo S", "Jernbanetorget 1 · 3,4 km"], ["destination", "Oslo S, Østbanehallen", "Jernbanetorget 1 · 3,5 km"], ["clock", "Oslo Spektrum", "Sonja Henies plass 2 · 3,9 km"], ["clock", "Ullevål sykehus", "Kirkeveien 166 · Nylig"]].map(([i, a, b], k) => (
            <button key={a} className={`s10-row s10-in${k ? "-" + Math.min(3, k + 1) : ""}`} style={{ padding: "8px 0" }} onClick={() => go("route", "lett")}>
              <span className="s10-ico"><Icon name={i} size={20} /></span><span style={{ flex: 1 }}><span className="t-body-m" style={{ display: "block" }}>{a}</span><span className="t-cap">{b}</span></span>
            </button>
          ))}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 250, background: "var(--surface-subtle)", padding: 8, display: "grid", gridTemplateColumns: "repeat(10,1fr)", gap: 6, alignContent: "start" }} aria-hidden="true">
            {"qwertyuiopasdfghjkløzxcvbnm".split("").map((k) => <span key={k} style={{ height: 42, borderRadius: 8, background: "var(--surface)", display: "grid", placeItems: "center", fontSize: 17, boxShadow: "0 1px 0 var(--divider-strong)" }}>{k}</span>)}
          </div>
        </div>);

      case "route": return (<>
        <button className="s10-icbtn s10-glass" style={{ position: "absolute", top: 58, left: 20 }} onClick={() => go("search")} aria-label="Tilbake"><Icon name="chevL" /></button>
        <Sheet k="route">
          <Journey fromSub="Juster hentepunkt · inngang B" toSub="Jernbanetorget 1" />
          <div style={{ display: "flex", gap: 24, margin: "20px 0", padding: "16px 0", borderTop: "1px solid var(--divider)", borderBottom: "1px solid var(--divider)" }}>
            <div><div className="t-cap">Kjøretid</div><div className="t-heading num">11 min</div></div>
            <div><div className="t-cap">Distanse</div><div className="t-heading num">3,4 km</div></div>
            <div><div className="t-cap">Ankomst</div><div className="t-heading num">10:02</div></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8 }}>
            <button className="s10-btn soft" style={{ width: 56 }} aria-label="Juster hentepunkt" onClick={() => go("pickupGuide")}><Icon name="pickup" /></button>
            <button className="s10-btn primary" onClick={() => go("vehicles", "lett")}>Velg bil</button>
          </div>
        </Sheet>
      </>);

      case "vehicles": return (
        <Sheet k="veh">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}><div className="t-heading">Velg bil</div><span className="t-cap">Til Oslo S · 11 min</span></div>
          <div style={{ display: "grid", gap: 6 }}>
            {CARS.map((c) => {
              const on = c.id === veh;
              return (
                <button key={c.id} onClick={() => { setVeh(c.id); p.go(screen, "lett"); }} aria-pressed={on}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 14px 8px 6px", borderRadius: 18, background: on ? "var(--surface-subtle)" : "transparent", boxShadow: on ? "inset 0 0 0 1.5px var(--text-primary)" : "none", transition: "all 210ms var(--e-out)", textAlign: "left" }}>
                  <span style={{ width: 84, height: 50, borderRadius: 12, overflow: "hidden", flex: "none", background: "#fff" }}><img src={c.img} alt={`${c.name} kjøretøy`} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></span>
                  <span style={{ flex: 1 }}><span className="t-body-m" style={{ display: "block" }}>{c.name} <span className="t-cap num">· {c.seats} <Icon name="user" size={12} style={{ verticalAlign: -1 }} /></span></span><span className="t-cap num">{c.eta} min unna · {c.note}</span></span>
                  <span className="num" style={{ fontSize: 17, fontWeight: 600 }}>{c.price} kr</span>
                </button>);
            })}
          </div>
          <button className="s10-row" style={{ padding: "12px 4px", minHeight: 48 }} onClick={() => go("payment", "lett")}>
            <Icon name="payment" size={20} /><span className="t-body-m" style={{ flex: 1 }}>{pay}</span><Icon name="chevR" size={18} style={{ color: "var(--text-tertiary)" }} />
          </button>
          <button className="s10-btn primary" onClick={() => go("confirm", "lett")}>Bestill {sel.name} · <span className="num">{sel.price} kr</span></button>
        </Sheet>);

      case "payment": return (
        <Sheet k="pay">
          <div className="t-heading" style={{ marginBottom: 14 }}>Betal med</div>
          <div className="s10-group" style={{ boxShadow: "none", background: "var(--surface-subtle)" }}>
            {[["apple", "Apple Pay", ""], ["payment", "Visa ·· 4821", "Utløper 08/28"], ["google", "Google Pay", ""], ["work", "SNAR Bedrift · Equinor", "Faktureres månedlig"], ["payment", "Vipps", ""]].map(([i, n, s]) => (
              <button key={n} className="s10-row" onClick={() => { setPay(n); go("vehicles", "lett"); }}>
                <span className="s10-ico" style={{ background: "var(--surface)" }}><Icon name={i} size={20} /></span>
                <span style={{ flex: 1 }}><span className="t-body-m" style={{ display: "block" }}>{n}</span>{s && <span className="t-cap">{s}</span>}</span>
                <span style={{ width: 22, height: 22, borderRadius: 11, boxShadow: pay === n ? "inset 0 0 0 7px var(--text-primary)" : "inset 0 0 0 1.5px var(--divider-strong)" }} aria-hidden="true" />
              </button>))}
          </div>
          <button className="s10-btn soft sm" style={{ marginTop: 12 }} onClick={() => go("paymethods")}><Icon name="plus" size={18} />Legg til betalingsmåte</button>
        </Sheet>);

      case "confirm": return (
        <Sheet k="conf">
          <div className="t-heading" style={{ marginBottom: 16 }}>Bekreft tur</div>
          <Journey fromSub="Inngang B" toSub="Ankomst ca. 10:02" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "20px 0" }}>
            <div style={{ padding: 14, borderRadius: 16, background: "var(--surface-subtle)" }}><div className="t-cap">Kjøretøy</div><div className="t-body-m">{sel.name}</div></div>
            <div style={{ padding: 14, borderRadius: 16, background: "var(--surface-subtle)" }}><div className="t-cap">Betaling</div><div className="t-body-m">{pay}</div></div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}><span className="t-sec">Fast pris, inkl. mva</span><span className="t-title num">{sel.price} kr</span></div>
          <button className="s10-btn primary" onClick={() => go("searching", "medium · bestilt")}>Bekreft og bestill</button>
        </Sheet>);

      case "searching": return (
        <Sheet k="search">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ width: 48, height: 48, borderRadius: 16, background: "var(--surface-subtle)", display: "grid", placeItems: "center", position: "relative" }}>
              <svg width="28" height="28" viewBox="0 0 28 28" style={{ animation: "s10-spin 1.4s linear infinite" }}><circle cx="14" cy="14" r="11" fill="none" stroke="var(--primary)" strokeWidth="2" strokeDasharray="16 60" strokeLinecap="round" /></svg>
            </span>
            <div style={{ flex: 1 }}><div className="t-heading">Finner sjåfør</div><div className="t-sec">Spør 3 biler i nærheten · Majorstuen</div></div>
          </div>
          <div style={{ height: 3, borderRadius: 2, background: "var(--surface-subtle)", margin: "22px 0", overflow: "hidden" }}><i style={{ display: "block", height: "100%", width: "40%", background: "var(--primary)", animation: "s10-shimmer 1.5s linear infinite" }} /></div>
          <Journey />
          <button className="s10-btn ghost" style={{ marginTop: 12 }} onClick={() => go("states", "advarsel")}>Avbryt</button>
        </Sheet>);

      case "match": case "approaching": {
        const eta = screen === "match" ? 4 : Math.max(1, Math.round(3 - tApproach * 2));
        return (<>
          <Sheet k="drv">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
              <div><div className="t-cap">{screen === "match" ? "Sjåfør funnet" : "Ankommer inngang B"}</div><div className="t-title">Jonas er på vei</div></div>
              <div className="num" style={{ textAlign: "right" }}><span className="t-large">{eta}</span><span className="t-sec"> min</span></div>
            </div>
            <DriverCard />
            <button className="s10-row" style={{ padding: "14px 0 6px", minHeight: 44 }} onClick={() => { setInside(!inside); p.go(screen, "lett"); }}>
              <Icon name="inside" size={20} /><span className="t-body-m" style={{ flex: 1 }}>Jeg venter inne</span>
              <span className="s10-toggle" role="switch" aria-checked={inside} />
            </button>
            <div style={{ marginTop: 10 }}><CommRow go={go} /></div>
            <button className="s10-btn ghost sm" style={{ marginTop: 6 }} onClick={() => go("pickupGuide", "lett")}>Vis henteveiledning</button>
          </Sheet>
        </>);
      }

      case "pickupGuide": return (
        <Sheet k="pg">
          <div className="t-cap">Sjåføren er 190 m unna</div>
          <div className="t-title" style={{ marginTop: 2 }}>Mot inngang B</div>
          <div style={{ display: "flex", gap: 14, alignItems: "center", padding: 14, borderRadius: 18, background: "var(--surface-subtle)", marginTop: 16 }}>
            <span className="s10-ico" style={{ background: "var(--surface)" }}><Icon name="walk" size={20} /></span>
            <div style={{ flex: 1 }}><div className="t-body-m">Gå 35 m mot hovedinngangen</div><div className="t-cap">Bogstadveien-siden, ved sykkelstativet</div></div>
          </div>
          <div className="t-over" style={{ margin: "18px 0 8px" }}>Se etter</div>
          <DriverCard compact />
          <div style={{ marginTop: 16 }}><CommRow go={go} /></div>
          <button className="s10-btn ink" style={{ marginTop: 10 }} onClick={() => go("arrived", "medium · ankommet")}>Simuler ankomst</button>
        </Sheet>);

      case "arrived": return (
        <Sheet k="arr">
          <div className="s10-pop" style={{ textAlign: "center", padding: "6px 0 16px" }}>
            <span className="s10-badge pos">Sjåføren er her</span>
            <div className="num" style={{ fontSize: 44, fontWeight: 650, letterSpacing: ".08em", marginTop: 14, padding: "10px 0", borderRadius: 18, border: "1.5px solid var(--text-primary)" }}>EV 12345</div>
            <div className="t-heading" style={{ marginTop: 14 }}>Svart Tesla Model 3</div>
            <div className="t-sec">Jonas venter ved inngang B · gratis venting <span className="num">4:18</span></div>
          </div>
          <CommRow go={go} />
          <button className="s10-btn primary" style={{ marginTop: 10 }} onClick={() => go("trip", "medium · tur startet")}>Jeg er i bilen</button>
        </Sheet>);

      case "trip": return (<>
        <div className="s10-in s10-glass" style={{ position: "absolute", top: 58, left: 20, right: 20, borderRadius: 20, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <span className="s10-ico" style={{ width: 36, height: 36, background: "var(--surface-inverse)", color: "var(--on-inverse)" }}><Icon name="destination" size={18} /></span>
          <div style={{ flex: 1 }}><div className="t-body-m">Oslo S</div><div className="t-cap num">Ankomst 10:02 · {(3.4 * (1 - tTrip)).toFixed(1).replace(".", ",")} km</div></div>
          <div className="num"><span className="t-title">{Math.max(1, Math.round(11 - tTrip * 9))}</span><span className="t-cap"> min</span></div>
        </div>
        <div className="s10-sheet" style={{ paddingBottom: 106 }}>
          <button onClick={() => go("activity", "lett")} style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 80, height: 28 }} aria-label="Minimer tur" />
          <DriverCard compact />
          <button className="s10-btn soft sm" style={{ marginTop: 14 }} onClick={() => go("activity", "lett")}><Icon name="chevD" size={18} />Minimer — turen følger deg</button>
        </div>
        {tripDock("driver")}
      </>);

      case "safety": return (
        <Sheet k="saf">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div className="t-title">Sikkerhet</div><button className="s10-icbtn" onClick={() => go("trip")} aria-label="Lukk"><Icon name="x" /></button></div>
          <p className="t-sec" style={{ marginTop: 4 }}>Turen spores live. Sjåfør og bil er verifisert av SNAR.</p>
          <div className="s10-group" style={{ marginTop: 16, boxShadow: "none", background: "var(--surface-subtle)" }}>
            <Row icon="share" title="Del turen live" sub="Send sanntidsposisjon til noen du stoler på" onClick={() => go("safety", "lett")} />
            <Row icon="safety" title="Verifisert sjåfør" sub="Jonas Berg · løyve 0312-44 · EV 12345" right={<span className="s10-badge pos">OK</span>} />
            <Row icon="help" title="Rapporter et problem" sub="Ikke akutt — vi svarer innen få minutter" onClick={() => go("support")} />
          </div>
          <button className="s10-btn danger" style={{ marginTop: 16 }} onClick={() => go("safety", "advarsel · hold for 113")}><Icon name="phone" size={20} />Ring 113 — hold inne</button>
          <p className="t-cap" style={{ textAlign: "center", marginTop: 8 }}>Posisjon og bilnummer sendes automatisk.</p>
        </Sheet>);

      case "arriving": return (
        <Sheet k="ari">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div><div className="t-cap">Nesten fremme</div><div className="t-title">Oslo S</div></div>
            <div className="num" style={{ textAlign: "right" }}><span className="t-large">400</span><span className="t-sec"> m</span></div>
          </div>
          <div className="t-sec" style={{ marginTop: 8 }}>Avstigning ved Jernbanetorget. {pay} belastes <span className="num">{sel.price} kr</span> automatisk.</div>
          <button className="s10-btn ink" style={{ marginTop: 18 }} onClick={() => go("complete", "medium · fremme")}>Fremme</button>
        </Sheet>);

      case "complete": return (
        <Sheet k="cmp">
          <div className="s10-pop">
            <div className="t-cap">Turen er fullført · 10:02</div>
            <div className="t-title">Velkommen til Oslo S</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, margin: "20px 0" }}>
              {[["Tid", "12 min"], ["Distanse", "3,4 km"], ["Pris", `${sel.price} kr`]].map(([a, b]) => <div key={a} style={{ padding: 14, borderRadius: 16, background: "var(--surface-subtle)" }}><div className="t-cap">{a}</div><div className="t-body-m num" style={{ fontSize: 18 }}>{b}</div></div>)}
            </div>
            <button className="s10-btn primary" onClick={() => go("paid", "medium · betalt")}>Betal {sel.price} kr</button>
          </div>
        </Sheet>);

      case "paid": return (
        <div className="s10-fade" style={{ position: "absolute", inset: 0, padding: "0 24px 48px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
          <svg width="88" height="88" viewBox="0 0 88 88" className="s10-pop"><circle cx="44" cy="44" r="42" fill="var(--positive-soft)" /><path d="M28 45l11 11 21-23" fill="none" stroke="var(--positive)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" style={{ animation: "s10-draw 420ms var(--e-out) 160ms both" }} /></svg>
          <div className="t-title s10-in-2" style={{ marginTop: 24 }}>Betalt</div>
          <div className="num s10-in-2" style={{ fontSize: 44, fontWeight: 600, letterSpacing: "-.03em", marginTop: 4 }}>{sel.price} kr</div>
          <p className="t-sec s10-in-3">{pay} · kvittering sendt til ingrid@lie.no</p>
          <div style={{ position: "absolute", bottom: 40, left: 24, right: 24, display: "grid", gap: 4 }}>
            <button className="s10-btn ink" onClick={() => go("rating", "lett")}>Ferdig</button>
            <button className="s10-btn ghost" onClick={() => go("receipt")}>Se kvittering</button>
          </div>
        </div>);

      case "receipt": return (
        <Scroll>
          <TopBar title="Kvittering" onBack={() => go("paid")} right={<button className="s10-icbtn" aria-label="Del"><Icon name="share" /></button>} />
          <div className="s10-group" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><SnarMark size={32} /><span className="t-cap num" style={{ textAlign: "right" }}>Nr. SN-24-88213<br />7. okt 2026 · 09:50</span></div>
            <div className="num" style={{ fontSize: 40, fontWeight: 600, letterSpacing: "-.03em", marginTop: 20 }}>{sel.price},00 kr</div>
            <div className="t-sec">Betalt med {pay}</div>
            <div style={{ margin: "20px 0", borderTop: "1px dashed var(--divider-strong)" }} />
            <Journey fromSub="09:50" toSub="10:02" />
            <div style={{ margin: "20px 0", borderTop: "1px dashed var(--divider-strong)" }} />
            {[["Turpris", `${sel.price - 15},00`], ["Servicegebyr", "15,00"], ["Herav mva (12 %)", `${Math.round(sel.price * 0.107)},00`], ["Sjåfør", "Jonas Berg · 0312-44"], ["Kjøretøy", "Tesla Model 3 · EV 12345"], ["Løyvehaver", "Oslo Taxi Drift AS"]].map(([a, b]) => (
              <div key={a} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0" }}><span className="t-sec">{a}</span><span className="num" style={{ fontSize: 14, fontWeight: 550 }}>{b}</span></div>))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 16 }}>
            <button className="s10-btn soft sm"><Icon name="download" size={18} />Last ned PDF</button>
            <button className="s10-btn soft sm" onClick={() => go("support")}><Icon name="help" size={18} />Få hjelp</button>
          </div>
        </Scroll>);

      case "rating": return (
        <Sheet k="rate">
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}><Avatar name="Jonas" src={DRIVER_IMG} size={52} /><div><div className="t-heading">Hvordan var turen med Jonas?</div><div className="t-cap">Valgfritt · tar 2 sekunder</div></div></div>
          <div style={{ display: "flex", justifyContent: "space-between", margin: "24px 8px" }} role="radiogroup" aria-label="Vurdering">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} role="radio" aria-checked={rating === n} aria-label={`${n} stjerner`} onClick={() => { setRating(n); p.go("rating", "lett"); }} style={{ width: 52, height: 52, display: "grid", placeItems: "center", color: n <= rating ? "var(--text-primary)" : "var(--divider-strong)", transform: n <= rating ? "scale(1.08)" : "scale(1)", transition: "transform 240ms var(--e-spring), color 150ms" }}>
                <svg width="34" height="34" viewBox="0 0 24 24"><path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" fill={n <= rating ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
              </button>))}
          </div>
          {rating >= 4 && <div className="s10-in" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>{["Rolig kjøring", "Ren bil", "Presis", "Hyggelig"].map((c) => <span key={c} className="s10-chip">{c}</span>)}</div>}
          <button className="s10-btn ink" onClick={() => go("home", "lett")}>{rating ? "Send" : "Hopp over"}</button>
        </Sheet>);

      case "activity": return (<>
        <Scroll>
          <div className="t-large" style={{ margin: "8px 0 20px" }}>Aktivitet</div>
          {tripLive && <button className="s10-group" style={{ width: "100%", textAlign: "left", padding: 16, display: "flex", gap: 12, alignItems: "center", boxShadow: "inset 0 0 0 1.5px var(--text-primary)" }} onClick={() => go(tripLive)}>
            <span className="s10-badge crit" style={{ color: "var(--primary)" }}>Pågår</span><span className="t-body-m" style={{ flex: 1 }}>Til Oslo S</span><Icon name="chevR" size={18} /></button>}
          <Sec title="Planlagt">
            <button className="s10-group" style={{ width: "100%", textAlign: "left", padding: 16 }} onClick={() => go("scheduled")}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span className="s10-badge neu"><Icon name="calendar" size={12} />I morgen</span><span className="num t-body-m">06:17</span></div>
              <div className="t-body-m" style={{ marginTop: 10 }}>Oslo lufthavn (OSL)</div><div className="t-cap">Standard · 648 kr · fly SK4021 08:20</div>
            </button>
          </Sec>
          <Sec title="Denne uken">
            <div className="s10-group">
              {[["Oslo S", "I dag 09:50 · Standard", "184 kr", "pos", "Fullført"], ["Ullevål sykehus", "Man 18:12 · Comfort", "212 kr", "pos", "Fullført"], ["Aker Brygge", "Søn 23:40 · Standard", "—", "neu", "Avbrutt"], ["Frognerparken", "Lør 13:05 · XL", "276 kr", "pos", "Fullført"]].map(([a, b, c, tone, l]) => (
                <button key={a + b} className="s10-row" onClick={() => go("tripDetail")} style={{ opacity: tone === "neu" ? 0.7 : 1 }}>
                  <span className="s10-ico"><Icon name={tone === "neu" ? "x" : "destination"} size={20} /></span>
                  <span style={{ flex: 1 }}><span className="t-body-m" style={{ display: "block", textDecoration: tone === "neu" ? "line-through" : "none" }}>{a}</span><span className="t-cap">{b}</span></span>
                  <span style={{ textAlign: "right" }}><span className="num t-body-m" style={{ display: "block" }}>{c}</span><span className={`t-cap`}>{l}</span></span>
                </button>))}
            </div>
          </Sec>
        </Scroll>
        {island}{tripLive ? tripDock("trip") : dockFor("activity")}
      </>);

      case "tripDetail": return (
        <Scroll>
          <TopBar title="Tur · 7. okt" onBack={() => go("activity")} />
          <div style={{ height: 180, borderRadius: 24, overflow: "hidden", position: "relative", boxShadow: "var(--elev-1)" }}><SnarMap cam="route" route="trip" progress={1} showPickup showDest fleet={false} offsetY={-40} /></div>
          <div style={{ marginTop: 20 }}><Journey fromSub="09:50" toSub="10:02 · 12 min · 3,4 km" /></div>
          <div className="s10-group" style={{ marginTop: 20 }}>
            <Row icon="driver" title="Jonas Berg" sub="★ 4,96 · Oslo Taxi Drift AS" />
            <Row icon="vehicle" title="Tesla Model 3 · svart" sub="EV 12345" />
            <Row icon="payment" title={`${sel.price} kr`} sub={pay} />
            <Row icon="receipt" title="Kvittering" onClick={() => go("receipt")} />
            <Row icon="help" title="Hjelp med denne turen" onClick={() => go("support")} />
          </div>
        </Scroll>);

      case "messages": return (<>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", paddingTop: 56 }}>
          <div style={{ padding: "0 20px 12px", display: "flex", gap: 12, alignItems: "center", borderBottom: "1px solid var(--divider)" }}>
            <button className="s10-icbtn" style={{ marginLeft: -12 }} onClick={() => go(tripLive ?? "home")} aria-label="Tilbake"><Icon name="chevL" /></button>
            <Avatar name="Jonas" src={DRIVER_IMG} size={40} />
            <div style={{ flex: 1 }}><div className="t-body-m">Jonas · EV 12345</div><div className="t-cap">Tur til Oslo S · {tripLive ? "pågår" : "i dag 09:50"}</div></div>
            <button className="s10-icbtn" aria-label="Ring"><Icon name="phone" /></button>
          </div>
          <div style={{ flex: 1, padding: 20, display: "flex", flexDirection: "column", gap: 8, overflow: "auto" }}>
            <div className="t-cap" style={{ textAlign: "center", margin: "4px 0 8px" }}>Meldinger slettes 24 t etter turen</div>
            {[["d", "Hei! Jeg er ved inngang B om 2 min."], ["u", "Supert, jeg venter inne i resepsjonen."], ["d", "Den er grei, jeg ringer når jeg står utenfor 👍"]].map(([w, m], i) => (
              <div key={i} className="s10-in" style={{ alignSelf: w === "u" ? "flex-end" : "flex-start", maxWidth: "78%", padding: "10px 14px", borderRadius: w === "u" ? "18px 18px 6px 18px" : "18px 18px 18px 6px", background: w === "u" ? "var(--surface-inverse)" : "var(--surface-subtle)", color: w === "u" ? "var(--on-inverse)" : "var(--text-primary)", fontSize: 15.5, lineHeight: "21px" }}>{m}</div>))}
            <div style={{ display: "flex", gap: 6, marginTop: "auto", flexWrap: "wrap" }}>{["Jeg kommer ut nå", "Står ved inngang B", "2 min"].map((q) => <span key={q} className="s10-chip">{q}</span>)}</div>
          </div>
          <div style={{ padding: "8px 16px 180px", display: "flex", gap: 8 }}><div className="s10-input" style={{ flex: 1, height: 48 }}><input aria-label="Melding" placeholder="Melding til Jonas" /></div><button className="s10-icbtn" style={{ background: "var(--primary)", color: "#fff" }} aria-label="Send" onClick={() => p.go("messages", "lett")}><Icon name="send" /></button></div>
        </div>
        {island}{tripLive ? tripDock("messages") : dockFor("messages")}
      </>);

      case "notifications": return (
        <Scroll>
          <TopBar title="Varsler" onBack={() => go("home")} />
          <div className="s10-group" style={{ padding: 16, background: "var(--surface-inverse)", color: "var(--on-inverse)" }}>
            <div className="t-over" style={{ color: "inherit", opacity: 0.6 }}>Krever handling</div>
            <div className="t-body-m" style={{ marginTop: 6 }}>Bekreft hentetid for i morgen</div>
            <div style={{ fontSize: 14, opacity: 0.7 }}>OSL · anbefalt 06:17 basert på trafikkprognose</div>
            <button className="s10-btn primary sm" style={{ marginTop: 12 }} onClick={() => go("scheduled")}>Se planlagt tur</button>
          </div>
          <Sec title="Turer · 3">
            <div className="s10-group"><Row icon="receipt" title="Kvittering · Oslo S" sub="I dag 10:02 · 184 kr" onClick={() => go("receipt")} /><Row icon="receipt" title="2 eldre kvitteringer" sub="Denne uken" onClick={() => go("activity")} /></div>
          </Sec>
          <Sec title="Fra SNAR">
            <div className="s10-group"><Row icon="ai" title="SNAR AI kan nå planlegge flyreiser" sub="Fortell når flyet går — vi foreslår hentetid" onClick={() => go("ai")} /></div>
          </Sec>
        </Scroll>);

      case "ai": return (<>
        <Scroll>
          <div className="t-over" style={{ marginTop: 8 }}>SNAR AI</div>
          <div className="t-title" style={{ marginTop: 4 }}>Hva trenger du?</div>
          {aiState === "idle" ? (
            <div style={{ display: "grid", gap: 8, marginTop: 20 }}>
              {[["vehicle", "Bestill samme bil som sist", "Jonas · Tesla · 3 min unna"], ["luggage", "Jeg trenger plass til tre kofferter", "Foreslår XL"], ["user", "Hent mamma på Ullevål", "Du betaler · hun får SMS"], ["home", "Få meg hjem", "Kirkeveien 64 · 12 min"]].map(([i, a, b], k) => (
                <button key={a} className={`s10-group s10-in${k ? "-" + Math.min(3, k + 1) : ""}`} style={{ display: "flex", gap: 14, padding: 14, alignItems: "center", textAlign: "left" }} onClick={() => { setAiState("result"); p.go("ai", "lett"); }}>
                  <span className="s10-ico"><Icon name={i} size={20} /></span><span style={{ flex: 1 }}><span className="t-body-m" style={{ display: "block" }}>{a}</span><span className="t-cap">{b}</span></span><Icon name="arrowR" size={18} style={{ color: "var(--text-tertiary)" }} />
                </button>))}
            </div>
          ) : (
            <div style={{ marginTop: 20 }}>
              <div style={{ alignSelf: "flex-end", marginLeft: "auto", width: "fit-content", maxWidth: "85%", padding: "10px 14px", borderRadius: "18px 18px 6px 18px", background: "var(--surface-subtle)", fontSize: 15 }}>Jeg har fly i morgen kl. 08:20 fra Gardermoen.</div>
              <FlightObject onSchedule={() => go("scheduled", "medium · planlagt")} />
            </div>
          )}
        </Scroll>
        <div style={{ position: "absolute", left: 16, right: 16, bottom: 100, display: "flex", gap: 8 }}>
          <div className="s10-input s10-glass" style={{ flex: 1 }}><input aria-label="Fortell SNAR" placeholder="Fortell SNAR hva du trenger" onKeyDown={(e) => e.key === "Enter" && setAiState("result")} /></div>
          <button className="s10-icbtn s10-glass" style={{ width: 56, height: 56, borderRadius: 16 }} onClick={() => go("voice", "lett")} aria-label="Stemme"><Icon name="voice" /></button>
        </div>
        {island}{dockFor("ai")}
      </>);

      case "voice": return (
        <Sheet k="voice">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ width: 48, height: 48, borderRadius: 16, background: "var(--surface-inverse)", display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }} aria-hidden="true">
              {[0, 1, 2, 3, 4].map((i) => <i key={i} style={{ width: 3, height: 20, borderRadius: 2, background: "var(--on-inverse)", animation: voice === "listening" ? `s10-bar .9s ease-in-out ${i * 0.1}s infinite` : "none", transform: voice === "listening" ? undefined : "scaleY(.3)" }} />)}
            </span>
            <div style={{ flex: 1 }}><div className="t-cap">{voice === "listening" ? "Lytter…" : voice === "understanding" ? "Forstår…" : "Dette forstod jeg"}</div>
              <div className="t-body-m" style={{ fontSize: 17 }}>«Jeg har fly i morgen kl. 08:20 fra Gardermoen»</div></div>
          </div>
          {voice === "understanding" && <div style={{ display: "grid", gap: 8, marginTop: 20 }}><div className="s10-skel" style={{ height: 18, width: "60%" }} /><div className="s10-skel" style={{ height: 64 }} /></div>}
          {voice === "result" && <FlightObject onSchedule={() => go("searching", "medium · bekreftet")} cta="Bekreft og bestill 06:17" />}
          {voice === "listening" && <button className="s10-btn ghost" style={{ marginTop: 16 }} onClick={() => go("home")}>Avbryt</button>}
        </Sheet>);

      case "profile": return (<>
        <Scroll>
          <div style={{ display: "flex", gap: 16, alignItems: "center", margin: "16px 0 8px" }}>
            <Avatar name="Ingrid Lie" src={USER_IMG} size={72} />
            <div><div className="t-title">Ingrid Lie</div><div className="t-sec num">+47 912 34 567 · ingrid@lie.no</div></div>
          </div>
          <Sec title="Steder"><div className="s10-group"><Row icon="home" title="Hjem" sub="Kirkeveien 64" onClick={() => {}} /><Row icon="work" title="Jobb" sub="Fornebuveien 50" onClick={() => {}} /></div></Sec>
          <Sec title="Konto"><div className="s10-group">
            <Row icon="payment" title="Betaling" sub="Visa ·· 4821 · Apple Pay" onClick={() => go("paymethods")} />
            <Row icon="access" title="Tilgjengelighet" onClick={() => go("accessibility")} />
            <Row icon="settings" title="Innstillinger" onClick={() => go("settings")} />
            <Row icon="help" title="Support" onClick={() => go("support")} />
          </div></Sec>
        </Scroll>
        {island}{tripLive ? tripDock("driver") : dockFor("profile")}
      </>);

      case "paymethods": return (
        <Scroll>
          <TopBar title="Betalingsmåter" onBack={() => go("profile")} />
          <div style={{ height: 180, borderRadius: 24, padding: 20, background: "linear-gradient(135deg, #0b1a2c, #1c3350)", color: "#fff", display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "var(--elev-2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 13, opacity: 0.7 }}>Standard</span><span style={{ fontWeight: 700, fontStyle: "italic", fontSize: 20 }}>VISA</span></div>
            <div className="num" style={{ fontSize: 20, letterSpacing: ".12em" }}>•••• •••• •••• 4821</div>
            <div className="num" style={{ fontSize: 13, opacity: 0.7 }}>INGRID LIE · 08/28</div>
          </div>
          <Sec title="Andre"><div className="s10-group"><Row icon="apple" title="Apple Pay" right={<span className="s10-badge pos">Klar</span>} /><Row icon="google" title="Google Pay" onClick={() => {}} /><Row icon="work" title="SNAR Bedrift · Equinor" sub="Faktura · kostnadssted 4410" onClick={() => {}} /></div></Sec>
          <Sec title="Fakturering"><div className="s10-group"><Row icon="receipt" title="Kvitteringer på e-post" sub="ingrid@lie.no" right={<span className="s10-toggle" role="switch" aria-checked="true" />} /></div></Sec>
          <button className="s10-btn soft" style={{ marginTop: 16 }}><Icon name="plus" size={18} />Legg til kort</button>
        </Scroll>);

      case "support": return (<>
        <Scroll>
          <TopBar title="Support" onBack={() => go("profile")} />
          {tripLive ? (
            <div className="s10-group" style={{ padding: 16 }}>
              <div className="t-over">Gjelder det turen din nå?</div>
              <div className="t-body-m" style={{ marginTop: 6 }}>Til Oslo S med Jonas · EV 12345</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>{["Sjåføren finner meg ikke", "Endre destinasjon", "Glemt gjenstand", "Ruten virker feil"].map((c) => <span key={c} className="s10-chip">{c}</span>)}</div>
            </div>
          ) : (
            <div className="s10-group" style={{ padding: 16 }}><div className="t-over">Siste tur</div><div className="t-body-m" style={{ marginTop: 6 }}>Oslo S · i dag · 184 kr</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>{["Feil pris", "Glemt gjenstand", "Gi tilbakemelding"].map((c) => <span key={c} className="s10-chip">{c}</span>)}</div></div>
          )}
          <Sec title="Vanlige spørsmål"><div className="s10-group"><Row title="Hvordan fungerer fast pris?" onClick={() => {}} /><Row title="Refusjon og avbestilling" onClick={() => {}} /><Row title="Bedriftskonto" onClick={() => {}} /></div></Sec>
          <button className="s10-btn ink" style={{ marginTop: 20 }}><Icon name="message" size={20} />Chat med SNAR · svar ~2 min</button>
        </Scroll>
        {island}
      </>);

      case "accessibility": return (
        <Scroll>
          <TopBar title="Tilgjengelighet" onBack={() => go("profile")} />
          <div className="s10-group" style={{ padding: 16, marginBottom: 16 }}><div style={{ fontSize: txt.big ? 22 : 17, fontWeight: 600, transition: "font-size 210ms" }}>Jonas er på vei · 3 min</div><div className="t-cap">Forhåndsvisning</div></div>
          <div className="s10-group">
            {([["big", "text", "Større tekst", "Følger systemets dynamiske tekst"], ["contrast", "contrast", "Økt kontrast", "Tydeligere skiller og kanter"], ["motion", "sliders", "Redusert bevegelse", "Bytter animasjoner mot overtoninger"], ["voice", "voice", "Stemmestøtte", "Les ETA og bilnummer høyt"]] as const).map(([k, i, a, b]) => (
              <Row key={k} icon={i} title={a} sub={b} right={<button className="s10-toggle" role="switch" aria-checked={txt[k]} aria-label={a} onClick={() => { setTxt({ ...txt, [k]: !txt[k] }); p.go(screen, "lett"); }} />} />))}
          </div>
          <p className="t-cap" style={{ marginTop: 12, padding: "0 4px" }}>Statuser bruker alltid form og tekst i tillegg til farge.</p>
        </Scroll>);

      case "settings": return (
        <Scroll>
          <TopBar title="Innstillinger" onBack={() => go("profile")} />
          <div className="s10-group"><Row icon="moon" title="Utseende" right={<span className="t-sec">Automatisk</span>} onClick={() => p.setTheme(p.theme === "light" ? "dark" : "light")} /><Row icon="globe" title="Språk" right={<span className="t-sec">Norsk</span>} onClick={() => {}} /></div>
          <Sec title="Turer"><div className="s10-group"><Row icon="safety" title="Del tur automatisk" sub="Med Erik etter kl. 22" right={<span className="s10-toggle" role="switch" aria-checked="true" />} /><Row icon="inside" title="Standard henteinstruks" sub="«Ring når du er fremme»" onClick={() => {}} /></div></Sec>
          <Sec title="Personvern"><div className="s10-group"><Row icon="lock" title="Data og personvern" onClick={() => {}} /><Row icon="bell" title="Varsler" onClick={() => go("notifications")} /></div></Sec>
          <button className="s10-btn ghost" style={{ marginTop: 16, color: "var(--critical)" }} onClick={() => go("signin")}>Logg ut</button>
        </Scroll>);

      case "scheduled": return (
        <Sheet k="sch">
          <div className="t-cap">Planlagt tur</div><div className="t-title">I morgen · Oslo lufthavn</div>
          <div style={{ display: "flex", gap: 6, margin: "18px 0", overflow: "hidden" }}>
            {[["Ons", "7"], ["Tor", "8"], ["Fre", "9"], ["Lør", "10"], ["Søn", "11"]].map(([d, n], i) => (
              <span key={d} style={{ flex: 1, padding: "10px 0", textAlign: "center", borderRadius: 14, background: i === 1 ? "var(--surface-inverse)" : "var(--surface-subtle)", color: i === 1 ? "var(--on-inverse)" : "inherit" }}><span className="t-cap" style={{ color: "inherit", opacity: 0.7, display: "block" }}>{d}</span><span className="num t-body-m">{n}</span></span>))}
          </div>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 18, padding: "8px 0" }} className="num">
            <span style={{ fontSize: 22, color: "var(--text-tertiary)" }}>06:12</span><span className="t-display" style={{ padding: "0 16px", borderRadius: 14, background: "var(--surface-subtle)" }}>06:17</span><span style={{ fontSize: 22, color: "var(--text-tertiary)" }}>06:22</span>
          </div>
          <p className="t-sec" style={{ textAlign: "center", margin: "8px 0 18px" }}>Ankomst OSL ca. 07:05 · 75 min før avgang</p>
          <button className="s10-btn primary" onClick={() => go("activity", "medium · planlagt")}>Planlegg 06:17 · <span className="num">648 kr</span></button>
        </Sheet>);

      case "states": return <StatesGallery go={go} />;
    }
    return null;
  })();

  return (
    <Stage product="SNAR Kunde" screens={SCREENS} current={screen} onSelect={(id) => go(id)} theme={p.theme} setTheme={p.setTheme} motion={p.motion} setMotion={p.setMotion} haptic={p.haptic}
      flows={[
        { label: "Flyt A · Bestill tur", sub: "Hjem → destinasjon → bil → betaling → sjåfør → tur → kvittering", start: () => go("home") },
        { label: "Flyt B · Stemme", sub: "Stemme → AI forstår → objekt → bestilling → sjåfør", start: () => go("voice") },
        { label: "Flyt C · Live Journey Island", sub: "Aktiv tur → minimer → bla → Island → åpne igjen", start: () => go("trip") },
        { label: "Ny bruker", sub: "Introduksjon → innlogging → posisjon", start: () => go("onboarding") },
      ]}>
      <Phone theme={p.theme} motion={motionPref} statusOnDark={screen === "splash" && p.theme === "light"}>
        <div style={{ position: "absolute", inset: 0, filter: txt.contrast ? "contrast(1.12)" : undefined, fontSize: txt.big ? "1.08em" : undefined }}>
          {m && <SnarMap {...m} />}
          {content}
        </div>
      </Phone>
    </Stage>
  );
}

function FlightObject({ onSchedule, cta = "Planlegg 06:17" }: { onSchedule: () => void; cta?: string }) {
  return (
    <div className="s10-pop s10-group" style={{ marginTop: 16, padding: 18, boxShadow: "var(--elev-2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div><div className="t-display" style={{ fontSize: 36 }}>OSL</div><div className="t-sec">I morgen · fly 08:20</div></div>
        <span className="s10-badge neu"><Icon name="ai" size={12} />Estimat</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, margin: "18px 0", paddingTop: 16, borderTop: "1px solid var(--divider)" }}>
        <div><div className="t-cap">Henting</div><div className="t-heading num">06:17</div></div>
        <div><div className="t-cap">Kjøretid</div><div className="t-heading num">45–52 min</div></div>
        <div><div className="t-cap">Standard</div><div className="t-heading num">648 kr</div></div>
      </div>
      <button className="s10-btn primary" onClick={onSchedule}>{cta}</button>
      <button className="s10-btn ghost sm" style={{ marginTop: 2 }}>Endre tid eller bil</button>
    </div>
  );
}

function StatesGallery({ go }: { go: (id: string, h?: string) => void }) {
  const [i, setI] = useState(0);
  const S = [
    { icon: "vehicle", title: "Ingen ledige biler akkurat nå", body: "Det er høy pågang på Majorstuen. Vi kan varsle deg så snart en bil er ledig — vanligvis innen 4 min.", action: "Varsle meg", secondary: "Prøv Comfort · 6 min" },
    { icon: "wifiOff", tone: "warn", title: "Du er offline", body: "Turen din er trygg. Sjåføren ser fortsatt hentepunktet, og vi synkroniserer når nettet er tilbake.", action: "Prøv igjen" },
    { icon: "locate", tone: "warn", title: "Vi finner ikke posisjonen din", body: "Skriv inn adressen eller velg et sted på kartet, så sender vi sjåføren dit.", action: "Skriv inn adresse", secondary: "Åpne innstillinger" },
    { icon: "payment", tone: "crit", title: "Kortet ble avvist", body: "Visa ·· 4821 ble ikke godkjent av banken. Turen er fortsatt reservert i 5 minutter.", action: "Bruk Apple Pay", secondary: "Velg et annet kort" },
    { icon: "driver", tone: "warn", title: "Sjåføren måtte avbryte", body: "Vi har allerede funnet en ny bil til deg. Samme pris, 2 min lenger ventetid.", action: "Fortsett med ny sjåfør", secondary: "Avbryt uten gebyr" },
    { icon: "search", title: "Fant ikke adressen", body: "Prøv et stedsnavn, eller dra hentepunktet på kartet.", action: "Velg på kartet" },
    { icon: "globe", title: "SNAR er ikke her ennå", body: "Vi kjører i Oslo, Bergen, Trondheim og Stavanger. Vi sier fra når vi kommer til Bodø.", action: "Varsle meg" },
  ];
  const s = S[i];
  return (
    <Scroll>
      <TopBar title="Tilstander" onBack={() => go("home")} />
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 32, scrollbarWidth: "none" }}>
        {["Ingen biler", "Offline", "Posisjon", "Betaling", "Avbrutt", "Adresse", "Område"].map((l, k) => <button key={l} className="s10-chip" onClick={() => setI(k)} style={{ background: k === i ? "var(--surface-inverse)" : undefined, color: k === i ? "var(--on-inverse)" : undefined }}>{l}</button>)}
      </div>
      <StateView key={i} {...(s as Parameters<typeof StateView>[0])} onAction={() => go(i === 4 ? "match" : "home", i === 3 ? "advarsel" : "lett")} onSecondary={() => go("home")} />
      <div style={{ marginTop: 40 }}><div className="t-over" style={{ marginBottom: 10 }}>Laster · skjelett</div>
        <div className="s10-group" style={{ padding: 16, display: "grid", gap: 10 }}><div className="s10-skel" style={{ height: 16, width: "40%" }} /><div className="s10-skel" style={{ height: 44 }} /><div className="s10-skel" style={{ height: 44 }} /></div></div>
    </Scroll>
  );
}

export default CustomerApp;
