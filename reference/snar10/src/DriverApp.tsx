import { useEffect, useState, type ReactNode } from "react";
import ExperienceStudio from "./snar10/ExperienceStudio";
import { Icon, SplashMark, SnarMap, Phone, Dock, TopBar, Avatar, StateView, Stage, Ring, HoldButton, useProto, useProgress, type MapProps, type ScreenMeta } from "./snar10/kit";

const DRIVER_IMG = "https://images.unsplash.com/photo-1676989859871-150f3579862a?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=240&h=240&q=80";
const PAX_IMG = "https://images.unsplash.com/photo-1730573520149-7a5b97d35ccc?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=240&h=240&q=80";
const TESLA = "https://images.unsplash.com/photo-1560958089-b8a1929cea89?q=80&w=1000&auto=format&fit=crop";
const IONIQ = "https://images.unsplash.com/photo-1580273916550-e323be2ae537?q=80&w=800&auto=format&fit=crop";

const SCREENS: ScreenMeta[] = [
  ["splash", "01", "Splash", "Start", "Samme lysspor som i kundeappen, deretter synker merket inn i det mørke cockpit-kartet.", undefined],
  ["login", "02", "Logg inn", "Start", "", "Lett"],
  ["approval", "03", "Godkjenning", "Start", "Statusradene glir inn. Manglende dokument vises alltid først.", undefined],
  ["offline", "04", "Offline hjem", "Skift", "Rolig kart med 60 % metning. Gå online-knappen presses ned til 0,97.", undefined],
  ["goingOnline", "05", "Går online", "Skift", "Ringen fylles (1,2 s), kartet får full metning og flåten dukker opp.", "Medium · online"],
  ["online", "06", "Online cockpit", "Skift", "Innsiktskortene glir inn nedenfra med 60 ms forsinkelse.", undefined],
  ["offer", "07", "Ny tur", "Tur", "Tilbudet spretter opp (280 ms). Nedtellingsringen går lineært i 15 s, rolig i grått.", "Medium · ny tur"],
  ["navPickup", "08–09", "Akseptert → kjør til henting", "Tur", "Tilbudskortet krymper inn i navigasjonsbanneret. Ingen skjermbytte.", "Medium · akseptert"],
  ["waitingInside", "10", "Kunden venter inne", "Tur", "En statusbrikke glir inn under svingbanneret uten å dekke det.", "Lett"],
  ["arrivedAction", "11", "Ankommet", "Tur", "", "Medium · ankommet"],
  ["waiting", "12", "Venter på passasjer", "Tur", "Timer med tabulære tall. Gratis ventetid vises som en ring.", undefined],
  ["startTrip", "13", "Start tur", "Tur", "Hold inne i 0,9 s for å starte. Hindrer utilsiktet start.", "Medium · tur startet"],
  ["active", "14", "Aktiv tur", "Tur", "Kameraet følger bilen på 1,7x zoom. Ingen økonomiske data vises.", undefined],
  ["arriving", "15", "Ankommer", "Tur", "", "Lett"],
  ["complete", "16", "Fullfør tur", "Tur", "Hold inne for å fullføre. Hindrer utilsiktet fullføring.", "Medium · fullført"],
  ["summary", "17", "Tursammendrag", "Tur", "Inntekten telles opp, og dagens total oppdateres i docken.", "Lett"],
  ["earnings", "18", "Inntjening", "Økonomi", "", undefined],
  ["intel", "19", "SNAR Drive Intelligence", "Økonomi", "Anbefalinger merkes som estimater og kan alltid avvises.", "Lett"],
  ["earningsDetail", "20", "Inntjening detalj", "Økonomi", "Dag/uke-fanen bytter med en felles understrek (210 ms).", "Lett"],
  ["activity", "21", "Aktivitet", "Konto", "", undefined],
  ["tripDetail", "22", "Turdetalj", "Konto", "", undefined],
  ["vehicle", "23", "Kjøretøy", "Konto", "", "Lett ved bytte"],
  ["fleet", "24", "Fleet", "Konto", "", undefined],
  ["profile", "25", "Profil", "Konto", "", undefined],
  ["documents", "26", "Dokumenter", "Konto", "", undefined],
  ["verify", "27", "ID / selfie", "Konto", "Rammen trekker seg inn mot ansiktet, og bekreftelsen tegnes som en hake.", "Medium · verifisert"],
  ["messages", "28", "Meldinger", "Konto", "", "Lett"],
  ["navSettings", "29", "Navigasjon", "Konto", "", undefined],
  ["settings", "30", "Innstillinger", "Konto", "", undefined],
  ["states", "31", "Globale tilstander", "Tilstander", "", undefined],
].map(([id, n, title, group, motion, haptic]) => ({ id, n, title, group, motion: motion || "Standard komponentovergang (210 ms ease-out).", haptic })) as ScreenMeta[];

const DOCK = [
  { id: "drive", label: "Kjør", icon: "navigation" }, { id: "earnings", label: "Inntekt", icon: "earnings" },
  { id: "intel", label: "Innsikt", icon: "ai", ai: true }, { id: "messages", label: "Meldinger", icon: "message" }, { id: "profile", label: "Profil", icon: "profile" },
];

function mapFor(s: string, t: number): MapProps | null {
  switch (s) {
    case "offline": return { cam: "cockpit", fleet: false, driver: { t: 0, path: "driverPickup", color: "#1b1f24" }, dim: 0.2 };
    case "goingOnline": case "online": return { cam: "cockpit", driver: { t: 0, path: "driverPickup" }, demand: s === "online" };
    case "offer": return { cam: "cockpit", route: "driverPickup", showPickup: true, pulse: true, driver: { t: 0, path: "driverPickup" }, offsetY: -160 };
    case "navPickup": case "waitingInside": return { cam: "driverNav", route: "driverPickup", progress: t * 0.85, showPickup: true, fleet: false, driver: { t: t * 0.85, path: "driverPickup" }, offsetY: 60 };
    case "arrivedAction": case "waiting": case "startTrip": return { cam: "pickup", showPickup: true, pulse: s !== "startTrip", fleet: false, driver: { t: 1, path: "driverPickup" }, offsetY: -120 };
    case "active": return { cam: "driverNav", route: "trip", progress: 0.05 + t * 0.8, showDest: true, fleet: false, driver: { t: 0.05 + t * 0.8, path: "trip" }, offsetY: 60 };
    case "arriving": case "complete": return { cam: "arrival", route: "trip", progress: s === "complete" ? 1 : 0.93, showDest: true, fleet: false, driver: { t: s === "complete" ? 1 : 0.93, path: "trip" }, offsetY: -140 };
    default: return null;
  }
}

const Sheet = ({ children, k, pb = 34 }: { children: ReactNode; k?: string; pb?: number }) => <div className="s10-sheet" key={k} style={{ paddingBottom: pb }}>{children}</div>;
const Scroll = ({ children }: { children: ReactNode }) => <div className="s10-scroll s10-fade">{children}</div>;
const Sec = ({ title, children }: { title: string; children: ReactNode }) => <section style={{ marginTop: 24 }}><div className="t-over" style={{ margin: "0 4px 10px" }}>{title}</div>{children}</section>;
const Row = ({ icon, title, sub, right, onClick }: { icon?: string; title: ReactNode; sub?: ReactNode; right?: ReactNode; onClick?: () => void }) => {
  const Inner = <>{icon && <span className="s10-ico"><Icon name={icon} size={20} /></span>}<span style={{ flex: 1, minWidth: 0 }}><span className="t-body-m" style={{ display: "block" }}>{title}</span>{sub && <span className="t-cap" style={{ display: "block", marginTop: 2 }}>{sub}</span>}</span>{right ?? (onClick && <Icon name="chevR" size={18} style={{ color: "var(--text-tertiary)" }} />)}</>;
  return onClick ? <button className="s10-row" onClick={onClick}>{Inner}</button> : <div className="s10-row">{Inner}</div>;
};
const Kpi = ({ label, value, unit }: { label: string; value: string; unit?: string }) => <div><div className="t-cap">{label}</div><div className="num" style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-.02em" }}>{value}{unit && <span className="t-cap"> {unit}</span>}</div></div>;

/** Turn-by-turn banner — the most legible element on the cockpit. */
function TurnBanner({ dist, street, then }: { dist: string; street: string; then?: string }) {
  return (
    <div className="s10-in" style={{ position: "absolute", top: 56, left: 12, right: 12, borderRadius: 24, background: "var(--surface-inverse)", color: "var(--on-inverse)", padding: "16px 18px", display: "flex", gap: 14, alignItems: "center", zIndex: 20 }}>
      <Icon name="turnR" size={40} stroke={2.2} />
      <div style={{ flex: 1 }}>
        <div className="num" style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-.03em", lineHeight: "34px" }}>{dist}</div>
        <div style={{ fontSize: 17, fontWeight: 550, opacity: 0.85 }}>{street}</div>
      </div>
      {then && <div style={{ fontSize: 12, opacity: 0.6, textAlign: "right" }}>Deretter<br />{then}</div>}
    </div>
  );
}

export function DriverApp() {
  const p = useProto("splash");
  const { screen, go } = p;
  const [today, setToday] = useState(1658);
  const [shiftGoal, setShiftGoal] = useState("2200");
  const [trips, setTrips] = useState(11);
  const [veh, setVeh] = useState("EV 12345");
  const [tab, setTab] = useState<"dag" | "uke">("dag");
  const [waitSec, setWaitSec] = useState(0);
  useEffect(() => { p.setTheme("dark"); }, []);
  useEffect(() => {
    const auto: Record<string, [string, number, string?]> = { splash: ["offline", 2300], goingOnline: ["online", 1500], online: ["offer", 4200, "medium · ny tur"], waitingInside: ["arrivedAction", 0] };
    const a = auto[screen];
    if (!a || !a[1]) return;
    const tm = setTimeout(() => go(a[0], a[2]), a[1]);
    return () => clearTimeout(tm);
  }, [screen]);
  useEffect(() => {
    if (screen !== "waiting") return; setWaitSec(0);
    const iv = setInterval(() => setWaitSec((s) => s + 1), 1000); return () => clearInterval(iv);
  }, [screen]);
  const tOffer = useProgress(screen === "offer", 13500, () => go("online"));
  const tNav = useProgress(screen === "navPickup" || screen === "waitingInside", 7200, () => go("arrivedAction", "medium · ankommet"));
  const tActive = useProgress(screen === "active", 8100, () => go("arriving", "lett"));
  const t = screen === "active" ? tActive : tNav;
  const m = mapFor(screen, t);
  const dock = (a: string) => <Dock items={DOCK} active={a} onSelect={(id) => go(id === "drive" ? "online" : id, "lett")} />;

  const OnlineChip = () => (
    <div className="s10-in s10-glass" style={{ position: "absolute", top: 58, left: 16, right: 16, borderRadius: 20, padding: "10px 12px 10px 16px", display: "flex", alignItems: "center", gap: 12 }}>
      <span className="s10-badge pos">Online</span>
      <span className="num t-sec" style={{ color: "var(--text-primary)" }}>4 t 18 min</span>
      <span style={{ flex: 1 }} />
      <button onClick={() => go("earnings")} className="num" style={{ fontSize: 17, fontWeight: 600 }} aria-label="Dagens inntekt">{today.toLocaleString("nb-NO")} kr</button>
      <button className="s10-icbtn" style={{ width: 40, height: 40 }} onClick={() => go("offline", "lett")} aria-label="Gå offline"><Icon name="power" size={20} /></button>
    </div>
  );

  const content = (() => {
    switch (screen) {
      case "splash": return <div className="s10-fade" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "#08131f", color: "#eef2f7" }}><SplashMark label="Driver" /></div>;

      case "login": return (
        <div style={{ position: "absolute", inset: 0, padding: "110px 24px 40px", display: "flex", flexDirection: "column" }}>
          <div className="t-over">SNAR Driver</div>
          <div className="t-large" style={{ marginTop: 6 }}>Logg inn for å kjøre</div>
          <p className="t-sec" style={{ marginTop: 8 }}>Bruk mobilnummeret registrert hos løyvehaveren din.</p>
          <div className="s10-input" style={{ marginTop: 28, height: 60 }}><span className="t-body-m num">+47</span><input className="num" aria-label="Telefonnummer" defaultValue="944 12 908" style={{ fontSize: 18 }} /></div>
          <button className="s10-btn primary" style={{ marginTop: 12, height: 58 }} onClick={() => go("approval", "lett")}>Fortsett</button>
          <button className="s10-btn soft" style={{ marginTop: 8 }} onClick={() => go("approval", "lett")}><Icon name="id" />BankID</button>
          <p className="t-cap" style={{ marginTop: "auto", textAlign: "center" }}>Kun for godkjente sjåfører med kjøreseddel. Support: 21 00 00 00</p>
        </div>);

      case "approval": return (
        <Scroll>
          <div className="t-over" style={{ marginTop: 16 }}>Kontostatus</div>
          <div className="t-title" style={{ marginTop: 4 }}>Nesten klar, Jonas</div>
          <p className="t-sec" style={{ marginTop: 6 }}>Ett dokument mangler før du kan gå online.</p>
          <div className="s10-group" style={{ marginTop: 20, boxShadow: "inset 0 0 0 1.5px var(--warning)" }}>
            <Row icon="camera" title="Selfie-verifisering" sub="Tar ca. 30 sekunder" right={<span className="s10-badge warn">Kreves</span>} onClick={() => go("verify")} />
          </div>
          <div className="s10-group" style={{ marginTop: 12 }}>
            <Row icon="id" title="Førerkort" right={<span className="s10-badge pos">Godkjent</span>} />
            <Row icon="doc" title="Kjøreseddel" right={<span className="s10-badge pos">Godkjent</span>} />
            <Row icon="fleet" title="Oslo Taxi Drift AS" sub="Løyvehaver" right={<span className="s10-badge neu">Under vurdering</span>} />
          </div>
          <button className="s10-btn primary" style={{ marginTop: 24 }} onClick={() => go("verify", "lett")}>Verifiser nå</button>
          <button className="s10-btn ghost" onClick={() => go("offline")}>Hopp til cockpit (demo)</button>
        </Scroll>);

      case "offline": return (<>
        <div className="s10-in" style={{ position: "absolute", top: 58, left: 20, right: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="s10-glass" style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 14px 6px 6px", borderRadius: 16 }}><Avatar name="Jonas Berg" src={DRIVER_IMG} size={32} /><span className="s10-badge neu">Offline</span></div>
          <button className="s10-icbtn s10-glass" onClick={() => go("settings")} aria-label="Innstillinger"><Icon name="settings" /></button>
        </div>
        <Sheet k="off" pb={108}>
          <ExperienceStudio product="driver" value={shiftGoal} onChange={setShiftGoal} earnings={today} onContinue={() => go("intel", "lett")} />
          <button className="s10-row" style={{ padding: "0 0 14px" }} onClick={() => go("vehicle")}>
            <span style={{ width: 72, height: 44, borderRadius: 12, overflow: "hidden", background: "#fff", flex: "none" }}><img src={TESLA} alt="Tesla Model 3" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></span>
            <span style={{ flex: 1 }}><span className="t-body-m" style={{ display: "block" }}>Tesla Model 3</span><span className="t-cap num">{veh} · batteri 82 %</span></span>
            <Icon name="chevR" size={18} style={{ color: "var(--text-tertiary)" }} />
          </button>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, padding: "14px 0 18px", borderTop: "1px solid var(--divider)" }}>
            <Kpi label="I dag" value={today.toLocaleString("nb-NO")} unit="kr" /><Kpi label="Turer" value={String(trips)} /><Kpi label="Online" value="4:18" unit="t" />
          </div>
          <button className="s10-btn primary" style={{ height: 58 }} onClick={() => go("goingOnline", "medium · online")}><Icon name="power" />Gå online</button>
        </Sheet>
        {dock("drive")}
      </>);

      case "goingOnline": return (
        <div className="s10-fade" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <div className="s10-glass s10-pop" style={{ borderRadius: 28, padding: "28px 32px", textAlign: "center" }}>
            <div style={{ position: "relative", width: 72, height: 72, margin: "0 auto" }}>
              <svg width="72" height="72" style={{ transform: "rotate(-90deg)" }}><circle cx="36" cy="36" r="32" fill="none" stroke="var(--divider-strong)" strokeWidth="3" /><circle cx="36" cy="36" r="32" fill="none" stroke="var(--positive)" strokeWidth="3" strokeLinecap="round" pathLength={1} strokeDasharray="1" style={{ animation: "s10-draw 1.2s var(--e-io) both" }} /></svg>
              <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--positive)" }}><Icon name="power" size={28} /></span>
            </div>
            <div className="t-heading" style={{ marginTop: 16 }}>Du er online</div><div className="t-sec">Ser etter turer nær Majorstuen</div>
          </div>
        </div>);

      case "online": return (<>
        <OnlineChip />
        <div style={{ position: "absolute", left: 16, right: 16, bottom: 104, display: "grid", gap: 8 }}>
          <button className="s10-glass s10-in" style={{ borderRadius: 20, padding: 14, display: "flex", gap: 12, alignItems: "flex-start", textAlign: "left" }} onClick={() => go("intel", "lett")}>
            <span className="s10-ico" style={{ width: 36, height: 36, background: "var(--surface-inverse)", color: "var(--on-inverse)" }}><Icon name="ai" size={18} /></span>
            <span style={{ flex: 1 }}><span className="t-body-m" style={{ display: "block", fontSize: 15 }}>Etterspørselen ventes å øke rundt Majorstuen de neste 20 min.</span><span className="t-cap">Estimat · Drive Intelligence</span></span>
          </button>
          <div className="s10-glass s10-in-2" style={{ borderRadius: 20, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <span className="t-sec" style={{ color: "var(--text-primary)", flex: 1 }}>Venter på tur · <span className="num">{veh}</span></span>
            <span className="t-cap">Snitt 3 min</span>
          </div>
        </div>
        {dock("drive")}
      </>);

      case "offer": return (
        <Sheet k="offer">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="s10-badge neu"><Icon name="vehicle" size={12} />Standard · ny tur</span>
            <span style={{ position: "relative", display: "grid", placeItems: "center" }} aria-label={`${Math.round(15 - tOffer * 15)} sekunder igjen`}>
              <Ring value={1 - tOffer} size={40} color="var(--text-secondary)" /><span className="num t-cap" style={{ position: "absolute", color: "var(--text-primary)" }}>{Math.round(15 - tOffer * 15)}</span>
            </span>
          </div>
          <div className="num" style={{ marginTop: 12 }}><span className="t-display">4 min</span><span className="t-sec"> til henting · 1,2 km</span></div>
          <div style={{ margin: "18px 0", display: "grid", gap: 4 }}>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-.02em" }}>Majorstuen</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-tertiary)" }}><Icon name="arrowR" size={18} /><span className="t-cap num">3,4 km · 11 min</span></div>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-.02em" }}>Oslo S</div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "14px 0", borderTop: "1px solid var(--divider)" }}>
            <span className="t-sec">Estimert pris</span><span className="num" style={{ fontSize: 28, fontWeight: 600 }}>184 kr</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "96px 1fr", gap: 8 }}>
            <button className="s10-btn soft" style={{ height: 64 }} onClick={() => go("online", "lett")}>Avslå</button>
            <button className="s10-btn primary" style={{ height: 64, fontSize: 18 }} onClick={() => go("navPickup", "medium · akseptert")}>Aksepter</button>
          </div>
        </Sheet>);

      case "navPickup": case "waitingInside": return (<>
        <TurnBanner dist={`${Math.max(50, Math.round(420 - tNav * 370))} m`} street="Sving til høyre · Bogstadveien" then="Inngang B" />
        {screen === "waitingInside" || tNav > 0.35 ? (
          <div className="s10-in" style={{ position: "absolute", top: 172, left: 12, right: 12, borderRadius: 16, padding: "10px 14px", display: "flex", gap: 10, alignItems: "center", background: "var(--surface)", boxShadow: "var(--elev-2)" }}>
            <Icon name="inside" size={20} style={{ color: "var(--positive)" }} /><span className="t-body-m" style={{ flex: 1, fontSize: 15 }}>Ingrid venter inne</span><span className="t-cap">Ring ved ankomst</span>
          </div>) : null}
        <Sheet k="nav">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Avatar name="Ingrid L" src={PAX_IMG} size={52} />
            <div style={{ flex: 1 }}><div className="t-heading">Ingrid L.</div><div className="t-sec">Bogstadveien 27 · inngang B</div></div>
            <div className="num" style={{ textAlign: "right" }}><span className="t-title">{Math.max(1, Math.round(4 - tNav * 3))}</span><span className="t-cap"> min</span></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, margin: "16px 0 10px" }}>
            <button className="s10-btn soft sm" style={{ height: 52 }}><Icon name="phone" size={20} />Ring</button>
            <button className="s10-btn soft sm" style={{ height: 52 }} onClick={() => go("messages")}><Icon name="message" size={20} />Melding</button>
            <button className="s10-btn soft sm" style={{ height: 52 }}><Icon name="navigation" size={20} />Google</button>
          </div>
          <button className="s10-btn primary" style={{ height: 58 }} onClick={() => go("arrivedAction", "medium · ankommet")}>Jeg har ankommet</button>
        </Sheet>
      </>);

      case "arrivedAction": return (
        <Sheet k="arr">
          <span className="s10-badge pos">Ved hentepunktet</span>
          <div className="t-title" style={{ marginTop: 10 }}>Inngang B, Bogstadveien 27</div>
          <p className="t-sec" style={{ marginTop: 4 }}>Ingrid venter inne og blir varslet når du bekrefter.</p>
          <button className="s10-btn primary" style={{ height: 58, marginTop: 20 }} onClick={() => go("waiting", "medium · kunde varslet")}>Jeg har ankommet</button>
        </Sheet>);

      case "waiting": {
        const free = 300, left = Math.max(0, free - waitSec);
        return (
          <Sheet k="wait">
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ position: "relative", display: "grid", placeItems: "center" }}><Ring value={left / free} size={64} stroke={4} color="var(--positive)" /><Icon name="timer" size={22} style={{ position: "absolute" }} /></span>
              <div style={{ flex: 1 }}><div className="t-cap">Gratis venting igjen</div><div className="num t-large">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</div></div>
            </div>
            <div className="s10-group" style={{ marginTop: 16, boxShadow: "none", background: "var(--surface-subtle)" }}>
              <Row icon="user" title="Ingrid L." sub="«Venter i resepsjonen»" />
              <Row icon="door" title="Inngang B" sub="Bogstadveien-siden, ved sykkelstativet" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
              <button className="s10-btn soft sm" style={{ height: 52 }}><Icon name="phone" size={20} />Ring</button>
              <button className="s10-btn soft sm" style={{ height: 52 }} onClick={() => go("messages")}><Icon name="message" size={20} />Melding</button>
            </div>
            <button className="s10-btn ink" style={{ marginTop: 8 }} onClick={() => go("startTrip", "lett")}>Passasjeren er i bilen</button>
          </Sheet>);
      }

      case "startTrip": return (
        <Sheet k="start">
          <div className="t-cap">Bekreft passasjer</div>
          <div className="t-title">Ingrid L. til Oslo S</div>
          <p className="t-sec" style={{ marginTop: 6 }}>Spør om navnet før du starter. Prisen er fast: <span className="num">184 kr</span>.</p>
          <div style={{ marginTop: 20 }}><HoldButton label="Start tur" onDone={() => go("active", "medium · tur startet")} /></div>
          <button className="s10-btn ghost" onClick={() => go("waiting")}>Tilbake</button>
        </Sheet>);

      case "active": return (<>
        <TurnBanner dist={`${Math.max(80, Math.round(650 - tActive * 500))} m`} street={tActive < 0.5 ? "Pilestredet" : "Ullevålsveien"} then="Rundkjøring" />
        <div className="s10-sheet" style={{ paddingBottom: 30 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span className="s10-ico" style={{ background: "var(--surface-inverse)", color: "var(--on-inverse)" }}><Icon name="destination" size={20} /></span>
            <div style={{ flex: 1 }}><div className="t-heading">Oslo S</div><div className="t-sec num">Ankomst 10:02 · {(3.4 * (1 - tActive)).toFixed(1).replace(".", ",")} km</div></div>
            <div className="num"><span className="t-large">{Math.max(1, Math.round(11 - tActive * 9))}</span><span className="t-cap"> min</span></div>
          </div>
        </div>
      </>);

      case "arriving": return (
        <Sheet k="ari">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><div><div className="t-cap">Ankommer</div><div className="t-title">Oslo S · Jernbanetorget</div></div><span className="num t-large">250<span className="t-sec"> m</span></span></div>
          <p className="t-sec" style={{ marginTop: 6 }}>Avstigning i taxifilen til venstre. Betaling skjer automatisk i appen.</p>
          <button className="s10-btn ink" style={{ marginTop: 18, height: 58 }} onClick={() => go("complete", "lett")}>Fremme ved destinasjon</button>
        </Sheet>);

      case "complete": return (
        <Sheet k="cmp">
          <div className="t-cap">Ingrid L. · Oslo S</div><div className="t-title">Fullfør turen</div>
          <p className="t-sec" style={{ marginTop: 6 }}>Sjekk at passasjeren har gått ut og ikke glemt noe.</p>
          <div style={{ marginTop: 20 }}><HoldButton label="Fullfør tur" onDone={() => { setToday((v) => v + 184); setTrips((v) => v + 1); go("summary", "medium · fullført"); }} /></div>
        </Sheet>);

      case "summary": return (
        <Scroll>
          <div className="s10-pop" style={{ marginTop: 24 }}>
            <span className="s10-badge pos">Tur fullført</span>
            <div className="t-cap" style={{ marginTop: 16 }}>Din inntekt</div>
            <div className="num t-display" style={{ fontSize: 52, lineHeight: "56px" }}>162 kr</div>
            <div className="t-sec">Lagt til i dag · totalt <span className="num">{today.toLocaleString("nb-NO")} kr</span></div>
          </div>
          <div className="s10-group" style={{ marginTop: 24, padding: "6px 16px" }}>
            {[["Kundepris", "184,00"], ["SNAR plattform (12 %)", "–22,08"], ["Din andel", "161,92"], ["Tid", "12 min"], ["Distanse", "3,4 km"]].map(([a, b], i) => (
              <div key={a} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderTop: i ? "1px solid var(--divider)" : "none", fontWeight: i === 2 ? 600 : 450 }}><span className={i === 2 ? "" : "t-sec"}>{a}</span><span className="num">{b}</span></div>))}
          </div>
          <button className="s10-btn primary" style={{ marginTop: 24, height: 58 }} onClick={() => go("online", "lett")}>Fortsett å kjøre</button>
          <button className="s10-btn ghost" onClick={() => go("offline")}>Ta pause</button>
        </Scroll>);

      case "earnings": return (<>
        <Scroll>
          <div className="t-over" style={{ marginTop: 8 }}>I dag · fredag</div>
          <div className="num" style={{ fontSize: 48, fontWeight: 600, letterSpacing: "-.035em", marginTop: 4 }}>{today.toLocaleString("nb-NO")} kr</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}><span className="s10-badge pos">+14 %</span><span className="t-sec">vs. en typisk fredag for deg</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 24 }}>
            <Kpi label="Online" value="4 t 18" unit="min" /><Kpi label="Turer" value={String(trips)} /><Kpi label="Per time" value="428" unit="kr" />
          </div>
          <Sec title="Skiftet ditt">
            <div className="s10-group" style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 64 }} aria-label="Inntekt per time">
                {[30, 55, 40, 70, 62, 90, 48].map((h, i) => <i key={i} style={{ flex: 1, height: `${h}%`, borderRadius: 4, background: i === 5 ? "var(--primary)" : "var(--surface-subtle)" }} />)}
              </div>
              <div className="t-cap num" style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}><span>16</span><span>18</span><span>20</span><span>Nå</span></div>
            </div>
          </Sec>
          <button className="s10-group" style={{ width: "100%", marginTop: 12, padding: 16, display: "flex", gap: 12, textAlign: "left" }} onClick={() => go("intel", "lett")}>
            <span className="s10-ico" style={{ background: "var(--surface-inverse)", color: "var(--on-inverse)" }}><Icon name="ai" size={20} /></span>
            <span style={{ flex: 1 }}><span className="t-body-m" style={{ display: "block" }}>90 min til ≈ 620 kr</span><span className="t-cap">Estimat basert på dagens etterspørsel</span></span><Icon name="chevR" size={18} />
          </button>
          <button className="s10-btn soft" style={{ marginTop: 12 }} onClick={() => go("earningsDetail")}>Uke, utbetaling og turer</button>
        </Scroll>
        {dock("earnings")}
      </>);

      case "intel": return (<>
        <Scroll>
          <div className="t-over" style={{ marginTop: 8 }}>SNAR Drive Intelligence</div>
          <div className="t-title" style={{ marginTop: 4 }}>Rolig kveld fremover — med en topp ved Oslo S.</div>
          <div style={{ height: 160, borderRadius: 24, overflow: "hidden", position: "relative", marginTop: 20, boxShadow: "var(--elev-1)" }}><SnarMap cam="wide" demand fleet /></div>
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {[["clock", "Oslo S · 22:10–22:40", "Ventet økning i etterspørsel når nattog og fly lander.", "Høy sikkerhet"], ["earnings", "90 minutter til ≈ 620 kr", "Basert på etterspørselen nå. Ingen garanti.", "Middels sikkerhet"], ["battery", "Lad før 23:00", "Batteri 82 % holder skiftet. Lading på Bislett er ledig.", ""]].map(([i, a, b, c], k) => (
              <div key={a} className={`s10-group s10-in${k ? "-" + (k + 1) : ""}`} style={{ padding: 16, display: "flex", gap: 14 }}>
                <span className="s10-ico"><Icon name={i} size={20} /></span>
                <div style={{ flex: 1 }}><div className="t-body-m">{a}</div><div className="t-sec">{b}</div>{c && <div className="t-cap" style={{ marginTop: 6 }}>Estimat · {c}</div>}</div>
              </div>))}
          </div>
          <button className="s10-btn primary" style={{ marginTop: 20 }} onClick={() => go("online", "lett")}><Icon name="navigation" size={20} />Kjør mot Oslo S</button>
          <button className="s10-btn ghost" onClick={() => go("online")}>Bli der jeg er</button>
          <p className="t-cap" style={{ textAlign: "center" }}>Forslag er alltid valgfrie og påvirker ikke turtildeling.</p>
        </Scroll>
        {dock("intel")}
      </>);

      case "earningsDetail": return (
        <Scroll>
          <TopBar title="Inntjening" onBack={() => go("earnings")} />
          <div className="s10-seg" style={{ background: "var(--surface-subtle)", width: "100%" }}>
            {(["dag", "uke"] as const).map((k) => <button key={k} aria-pressed={tab === k} onClick={() => { setTab(k); p.go(screen, "lett"); }} style={{ flex: 1, height: 36, color: "var(--text-primary)", background: tab === k ? "var(--surface)" : "transparent" }}>{k === "dag" ? "I dag" : "Denne uken"}</button>)}
          </div>
          <div className="num" style={{ fontSize: 40, fontWeight: 600, letterSpacing: "-.03em", marginTop: 20 }}>{tab === "dag" ? today.toLocaleString("nb-NO") : "9 412"} kr</div>
          <div className="t-sec num">{tab === "dag" ? `${trips} turer · 4 t 18 min` : "58 turer · 26 t 40 min"}</div>
          <Sec title="Neste utbetaling">
            <div className="s10-group"><Row icon="payment" title="Tirsdag 13. okt" sub="DNB ·· 7712 · via Oslo Taxi Drift AS" right={<span className="num t-body-m">9 412 kr</span>} /></div>
          </Sec>
          <Sec title="Turer">
            <div className="s10-group">
              {[["09:50", "Majorstuen → Oslo S", "162"], ["09:12", "Frogner → Aker Brygge", "118"], ["08:31", "Bislett → Ullevål", "141"], ["07:58", "OSL → Grünerløkka", "571"]].map(([a, b, c]) => (
                <button key={a} className="s10-row" onClick={() => go("tripDetail")}><span className="num t-cap" style={{ width: 40 }}>{a}</span><span className="t-body-m" style={{ flex: 1, fontSize: 15 }}>{b}</span><span className="num t-body-m">{c} kr</span></button>))}
            </div>
          </Sec>
        </Scroll>);

      case "activity": return (
        <Scroll>
          <TopBar title="Aktivitet" onBack={() => go("profile")} />
          {["I dag", "I går"].map((d, k) => (
            <Sec key={d} title={d}>
              <div className="s10-group">
                {(k ? [["22:40", "Oslo S → Sagene", "204 kr"], ["21:15", "Majorstuen → Skøyen", "—"]] : [["09:50", "Majorstuen → Oslo S", "162 kr"], ["09:12", "Frogner → Aker Brygge", "118 kr"]]).map(([a, b, c]) => (
                  <button key={a} className="s10-row" onClick={() => go("tripDetail")}>
                    <span className="s10-ico"><Icon name={c === "—" ? "x" : "trip"} size={20} /></span>
                    <span style={{ flex: 1 }}><span className="t-body-m" style={{ display: "block", fontSize: 15 }}>{b}</span><span className="t-cap num">{a} · {c === "—" ? "Kansellert av kunde" : "Fullført"}</span></span>
                    <span className="num t-body-m">{c}</span>
                  </button>))}
              </div>
            </Sec>))}
        </Scroll>);

      case "tripDetail": return (
        <Scroll>
          <TopBar title="Tur SN-24-88213" onBack={() => go("activity")} />
          <div style={{ height: 170, borderRadius: 24, overflow: "hidden", position: "relative" }}><SnarMap cam="route" route="trip" progress={1} showPickup showDest fleet={false} offsetY={-40} /></div>
          <div className="s10-group" style={{ marginTop: 16 }}>
            <Row icon="pickup" title="Bogstadveien 27" sub="09:50" /><Row icon="destination" title="Oslo S" sub="10:02 · 12 min · 3,4 km" />
            <Row icon="user" title="Ingrid L." sub="Vurderte deg ★ 5" />
            <Row icon="earnings" title="162 kr inntekt" sub="Kundepris 184 kr · plattform 22 kr" />
            <Row icon="receipt" title="Referanse" sub="SN-24-88213" />
            <Row icon="help" title="Rapporter problem med turen" onClick={() => {}} />
          </div>
        </Scroll>);

      case "vehicle": return (
        <Scroll>
          <TopBar title="Kjøretøy" onBack={() => go("offline")} />
          <div style={{ borderRadius: 24, overflow: "hidden", background: "#fff", height: 180 }}><img src={TESLA} alt="Tesla Model 3, svart" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 16 }}>
            <div><div className="t-title">Tesla Model 3</div><div className="t-sec">Svart · 2024 · 4 seter</div></div>
            <span className="num" style={{ fontSize: 16, fontWeight: 650, letterSpacing: ".06em", padding: "8px 12px", borderRadius: 12, border: "1.5px solid var(--text-primary)" }}>{veh}</span>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}><span className="s10-badge pos">Tildelt deg</span><span className="s10-badge pos">EU-kontroll OK</span></div>
          <Sec title="Tilgjengelige i fleeten">
            <div className="s10-group">
              {[["EV 12345", "Tesla Model 3 · svart", TESLA], ["EK 40221", "Hyundai Ioniq 5 · hvit", IONIQ]].map(([r, n, img]) => (
                <button key={r} className="s10-row" onClick={() => { setVeh(r); p.go(screen, "lett"); }}>
                  <span style={{ width: 56, height: 38, borderRadius: 10, overflow: "hidden", background: "#fff", flex: "none" }}><img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></span>
                  <span style={{ flex: 1 }}><span className="t-body-m num" style={{ display: "block" }}>{r}</span><span className="t-cap">{n}</span></span>
                  <span style={{ width: 22, height: 22, borderRadius: 11, boxShadow: veh === r ? "inset 0 0 0 7px var(--text-primary)" : "inset 0 0 0 1.5px var(--divider-strong)" }} />
                </button>))}
            </div>
          </Sec>
        </Scroll>);

      case "fleet": return (
        <Scroll>
          <TopBar title="Fleet" onBack={() => go("profile")} />
          <div className="s10-group" style={{ padding: 20 }}>
            <span className="s10-ico" style={{ width: 52, height: 52, borderRadius: 16, background: "var(--surface-inverse)", color: "var(--on-inverse)" }}><Icon name="fleet" size={26} /></span>
            <div className="t-title" style={{ marginTop: 14 }}>Oslo Taxi Drift AS</div>
            <div className="t-sec num">Løyvehaver · org. 920 888 234 · 14 biler</div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}><span className="s10-badge pos">Aktiv avtale</span><span className="s10-badge neu">Provisjon 12 %</span></div>
          </div>
          <div className="s10-group" style={{ marginTop: 12 }}>
            <Row icon="vehicle" title="Tildelt bil" sub={`${veh} · til 31. des`} onClick={() => go("vehicle")} />
            <Row icon="clock" title="Skiftplan" sub="Fre–søn · 16:00–02:00" />
            <Row icon="payment" title="Utbetaling" sub="Ukentlig via løyvehaver" />
            <Row icon="phone" title="Kontakt fleet-ansvarlig" sub="Mari Haugen · 922 11 004" onClick={() => {}} />
          </div>
        </Scroll>);

      case "profile": return (<>
        <Scroll>
          <div style={{ display: "flex", gap: 16, alignItems: "center", margin: "16px 0" }}>
            <Avatar name="Jonas Berg" src={DRIVER_IMG} size={72} />
            <div><div className="t-title">Jonas Berg</div><div className="t-sec num">★ 4,96 · 2 418 turer</div><span className="s10-badge pos" style={{ marginTop: 6 }}>Verifisert</span></div>
          </div>
          <div className="s10-group">
            <Row icon="doc" title="Dokumenter" sub="1 utløper snart" right={<span className="s10-badge warn">1</span>} onClick={() => go("documents")} />
            <Row icon="vehicle" title="Kjøretøy" sub={veh} onClick={() => go("vehicle")} />
            <Row icon="fleet" title="Fleet" sub="Oslo Taxi Drift AS" onClick={() => go("fleet")} />
            <Row icon="activity" title="Aktivitet" onClick={() => go("activity")} />
          </div>
          <div className="s10-group" style={{ marginTop: 12 }}>
            <Row icon="navigation" title="Navigasjon" onClick={() => go("navSettings")} />
            <Row icon="settings" title="Innstillinger" onClick={() => go("settings")} />
          </div>
        </Scroll>
        {dock("profile")}
      </>);

      case "documents": return (
        <Scroll>
          <TopBar title="Dokumenter" onBack={() => go("profile")} />
          <div className="s10-group">
            <Row icon="id" title="Førerkort" sub="Gyldig til 2031" right={<span className="s10-badge pos">Godkjent</span>} />
            <Row icon="doc" title="Kjøreseddel" sub="Utløper 2. nov · 26 dager" right={<span className="s10-badge warn">Utløper</span>} onClick={() => {}} />
            <Row icon="user" title="Politiattest" sub="Lastet opp 3. okt" right={<span className="s10-badge neu">Vurderes</span>} />
            <Row icon="camera" title="Selfie-verifisering" sub="Månedlig sjekk" right={<span className="s10-badge crit">Kreves</span>} onClick={() => go("verify")} />
          </div>
          <button className="s10-btn soft" style={{ marginTop: 16 }}><Icon name="plus" size={18} />Last opp dokument</button>
        </Scroll>);

      case "verify": return <Verify go={go} />;

      case "messages": return (<>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", paddingTop: 56 }}>
          <div style={{ padding: "0 20px 12px", display: "flex", gap: 12, alignItems: "center", borderBottom: "1px solid var(--divider)" }}>
            <Avatar name="Ingrid" src={PAX_IMG} size={44} />
            <div style={{ flex: 1 }}><div className="t-body-m">Ingrid L.</div><div className="t-cap">Henting Bogstadveien 27 · nå</div></div>
            <button className="s10-icbtn" aria-label="Ring"><Icon name="phone" /></button>
          </div>
          <div style={{ flex: 1, padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            {[["u", "Hei! Jeg er ved inngang B om 2 min."], ["c", "Supert, jeg venter inne i resepsjonen."]].map(([w, mm], i) => (
              <div key={i} style={{ alignSelf: w === "u" ? "flex-end" : "flex-start", maxWidth: "80%", padding: "12px 16px", borderRadius: 18, background: w === "u" ? "var(--surface-inverse)" : "var(--surface-subtle)", color: w === "u" ? "var(--on-inverse)" : "inherit", fontSize: 17, lineHeight: "23px" }}>{mm}</div>))}
          </div>
          <div style={{ padding: "0 16px 120px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {["Jeg er fremme", "2 min unna", "Finner deg ikke", "Står i taxifilen"].map((q) => <button key={q} className="s10-btn soft sm" style={{ height: 52 }} onClick={() => p.go("messages", "lett")}>{q}</button>)}
          </div>
        </div>
        {dock("messages")}
      </>);

      case "navSettings": return (
        <Scroll>
          <TopBar title="Navigasjon" onBack={() => go("profile")} />
          <Sec title="Standard navigasjon">
            <div className="s10-group">
              {["SNAR Navigasjon", "Google Maps", "Waze", "Apple Kart"].map((n, i) => <Row key={n} icon="navigation" title={n} right={<span style={{ width: 22, height: 22, borderRadius: 11, boxShadow: i === 0 ? "inset 0 0 0 7px var(--text-primary)" : "inset 0 0 0 1.5px var(--divider-strong)" }} />} />)}
            </div>
          </Sec>
          <Sec title="Under kjøring">
            <div className="s10-group">
              <Row icon="voice" title="Stemmeveiledning" right={<span className="s10-toggle" role="switch" aria-checked="true" />} />
              <Row icon="moon" title="Automatisk nattmodus" sub="Etter solnedgang" right={<span className="s10-toggle" role="switch" aria-checked="true" />} />
              <Row icon="alert" title="Unngå bomstasjoner" right={<span className="s10-toggle" role="switch" aria-checked="false" />} />
            </div>
          </Sec>
        </Scroll>);

      case "settings": return (
        <Scroll>
          <TopBar title="Innstillinger" onBack={() => go("profile")} />
          <Sec title="Turer"><div className="s10-group"><Row icon="vehicle" title="Turtyper" sub="Standard, Comfort" onClick={() => {}} /><Row icon="bell" title="Lyd for ny tur" right={<span className="t-sec">Nordlys</span>} onClick={() => {}} /></div></Sec>
          <Sec title="Visning"><div className="s10-group"><Row icon="moon" title="Mørk cockpit" right={<button className="s10-toggle" role="switch" aria-checked={p.theme === "dark"} aria-label="Mørk cockpit" onClick={() => p.setTheme(p.theme === "dark" ? "light" : "dark")} />} /><Row icon="text" title="Stor tekst i cockpit" right={<span className="s10-toggle" role="switch" aria-checked="false" />} /></div></Sec>
          <Sec title="Konto"><div className="s10-group"><Row icon="lock" title="Personvern" onClick={() => {}} /><Row icon="help" title="Sjåførsupport" onClick={() => {}} /></div></Sec>
          <button className="s10-btn ghost" style={{ marginTop: 16, color: "var(--critical)" }} onClick={() => go("login")}>Logg ut</button>
        </Scroll>);

      case "states": return <States go={go} />;
    }
    return null;
  })();

  return (
    <Stage product="SNAR Driver" screens={SCREENS} current={screen} onSelect={(id) => go(id)} theme={p.theme} setTheme={p.setTheme} motion={p.motion} setMotion={p.setMotion} haptic={p.haptic}
      flows={[
        { label: "Flyt A · Hel tur", sub: "Offline → online → tur → aksepter → hent → start → kjør → fullfør → inntekt", start: () => go("offline") },
        { label: "Flyt B · Skiftinnsikt", sub: "Inntekt → AI-innsikt → anbefaling → tilbake til kart", start: () => go("earnings") },
        { label: "Onboarding", sub: "Innlogging → godkjenning → selfie", start: () => go("login") },
      ]}>
      <Phone theme={p.theme} motion={p.motion} statusOnDark={screen === "splash"}>
        {m && <SnarMap {...m} />}
        {content}
      </Phone>
    </Stage>
  );
}

function Verify({ go }: { go: (id: string, h?: string) => void }) {
  const [step, setStep] = useState<"intro" | "camera" | "done">("intro");
  useEffect(() => { if (step !== "camera") return; const t = setTimeout(() => { setStep("done"); go("verify", "medium · verifisert"); }, 2600); return () => clearTimeout(t); }, [step]);
  if (step === "intro") return (
    <Scroll>
      <TopBar onBack={() => go("documents")} />
      <span className="s10-ico" style={{ width: 56, height: 56, borderRadius: 18 }}><Icon name="camera" size={26} /></span>
      <div className="t-title" style={{ marginTop: 18 }}>Bekreft at det er deg</div>
      <p className="t-sec" style={{ marginTop: 8 }}>Passasjerer stoler på at sjåføren i appen er den som kjører. Vi sammenligner en selfie med førerkortet ditt. Bildet slettes etter 30 dager.</p>
      <div className="s10-group" style={{ marginTop: 20 }}>
        <Row icon="sun" title="Godt lys foran deg" /><Row icon="user" title="Ta av lue og solbriller" /><Row icon="lock" title="Kun brukt til verifisering" />
      </div>
      <button className="s10-btn primary" style={{ marginTop: 24 }} onClick={() => setStep("camera")}>Start kamera</button>
    </Scroll>);
  return (
    <div className="s10-fade" style={{ position: "absolute", inset: 0, background: "#0a141f", color: "#eef2f7", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 110 }}>
      <div style={{ position: "relative", width: 240, height: 300 }}>
        <img src={DRIVER_IMG} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", borderRadius: "50% / 42%", opacity: 0.9 }} />
        <svg viewBox="0 0 240 300" width="240" height="300" style={{ position: "absolute", inset: 0 }}>
          <ellipse cx="120" cy="150" rx="116" ry="146" fill="none" stroke={step === "done" ? "#3ccf9a" : "rgba(255,255,255,.6)"} strokeWidth="3" pathLength={1} strokeDasharray={step === "done" ? "1 0" : "0.04 0.02"} style={{ transition: "stroke 300ms" }} />
        </svg>
      </div>
      <div className="t-heading" style={{ marginTop: 32 }}>{step === "done" ? "Verifisert" : "Hold telefonen i øyehøyde"}</div>
      <p style={{ opacity: 0.65, fontSize: 14, marginTop: 6 }}>{step === "done" ? "Takk, Jonas. Du kan gå online." : "Vi tar bildet automatisk"}</p>
      {step === "done" && <button className="s10-btn primary" style={{ position: "absolute", bottom: 40, left: 24, right: 24, width: "auto" }} onClick={() => go("offline", "lett")}>Til cockpit</button>}
    </div>
  );
}

function States({ go }: { go: (id: string, h?: string) => void }) {
  const [i, setI] = useState(0);
  const S = [
    { k: "GPS", icon: "locate", tone: "warn", title: "Svakt GPS-signal", body: "Posisjonen din kan være upresis i tunnelen. Turen fortsetter, og vi korrigerer automatisk.", action: "Ok" },
    { k: "Nett", icon: "wifiOff", tone: "warn", title: "Ingen nettilkobling", body: "Du er fortsatt i turen. Navigasjonen fungerer offline, og nye turer kommer når du er tilbake.", action: "Prøv igjen" },
    { k: "Tillatelse", icon: "locate", tone: "crit", title: "SNAR trenger posisjon «Alltid»", body: "Uten den kan vi ikke sende deg turer mens appen er i bakgrunnen.", action: "Åpne innstillinger" },
    { k: "Område", icon: "globe", title: "Utenfor tjenesteområdet", body: "Du er i Asker. Kjør inn mot Oslo for å motta turer igjen.", action: "Vis tjenesteområde" },
    { k: "Økt", icon: "lock", title: "Du er logget ut", body: "Av sikkerhetshensyn logger vi ut etter 30 dager. Logg inn igjen med BankID.", action: "Logg inn" },
    { k: "Tomt", icon: "trip", title: "Ingen turer ennå i dag", body: "Når du fullfører en tur, dukker den opp her med inntekt og kvittering.", action: "Gå online" },
  ];
  const s = S[i];
  return (
    <Scroll>
      <TopBar title="Tilstander" onBack={() => go("offline")} />
      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 32, scrollbarWidth: "none" }}>
        {S.map((x, k) => <button key={x.k} className="s10-chip" onClick={() => setI(k)} style={{ background: k === i ? "var(--surface-inverse)" : undefined, color: k === i ? "var(--on-inverse)" : undefined }}>{x.k}</button>)}
      </div>
      <StateView key={i} {...(s as Parameters<typeof StateView>[0])} onAction={() => go(s.k === "Økt" ? "login" : "offline", "lett")} />
      <div style={{ marginTop: 40 }}><div className="t-over" style={{ marginBottom: 10 }}>Laster</div><div className="s10-group" style={{ padding: 16, display: "grid", gap: 10 }}><div className="s10-skel" style={{ height: 28, width: "50%" }} /><div className="s10-skel" style={{ height: 56 }} /></div></div>
    </Scroll>
  );
}

export default DriverApp;
