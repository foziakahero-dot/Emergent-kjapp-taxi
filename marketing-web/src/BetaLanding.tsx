import { useId, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import "./beta-launch.css";

type Device = "ios" | "android";
type IntakeStatus = "idle" | "submitting" | "success" | "error";

const districts = [
  "Alna", "Bjerke", "Frogner", "Gamle Oslo", "Grorud", "Grünerløkka",
  "Nordre Aker", "Nordstrand", "Sagene", "St. Hanshaugen", "Stovner",
  "Søndre Nordstrand", "Ullern", "Vestre Aker", "Østensjø", "Annet sted i Oslo",
];

const steps = [
  {
    number: "01",
    icon: "apply",
    title: "Søk om tilgang",
    copy: "Fyll ut skjemaet og søk om beta-tilgang i Oslo.",
  },
  {
    number: "02",
    icon: "review",
    title: "Vi vurderer søknaden",
    copy: "Vi gir beskjed på e-post hvis du får plass.",
  },
  {
    number: "03",
    icon: "phone",
    title: "Kom i gang",
    copy: "Få informasjon om installasjon og aktivering.",
  },
  {
    number: "04",
    icon: "rocket",
    title: "Test og gi feedback",
    copy: "Bruk SNAR og hjelp oss å gjøre opplevelsen bedre.",
  },
];

const benefits = [
  { icon: "spark", title: "Smartere mobilitet", copy: "En ny og enklere måte å bevege seg rundt i Oslo." },
  { icon: "clock", title: "Mindre venting", copy: "En reiseopplevelse utviklet med fokus på enkelhet." },
  { icon: "crown", title: "Tidlig tilgang", copy: "Vær blant de første som prøver SNAR og påvirker veien videre." },
  { icon: "chat", title: "Din stemme teller", copy: "Gi direkte tilbakemelding mens vi forbedrer plattformen." },
];

function Glyph({ kind, size = 29 }: { kind: string; size?: number }) {
  const common = {
    fill: "none", stroke: "currentColor", strokeWidth: 1.7,
    strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  };
  let shape;
  switch (kind) {
    case "apply":
      shape = <><path d="M5 3h11l4 4v14H5z"/><path d="M15 3v5h5M8 12h8M8 16h4"/><path d="m12 20 7-7 2 2-7 7-3 1z"/></>; break;
    case "review":
      shape = <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M17 14a6 6 0 0 1 4 6"/></>; break;
    case "phone":
      shape = <><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M10 5h4M11 19h2M12 9v6m-3-3 3 3 3-3"/></>; break;
    case "rocket":
      shape = <><path d="M4 15c-1-4 1-7 5-8 3-5 7-5 12-5 0 5-1 9-6 12-1 4-4 6-8 5l-3 3z"/><path d="M9 15 6 18M14 9h.01"/></>; break;
    case "spark":
      shape = <path d="m13 2-9 12h8l-1 8 9-12h-8z"/>; break;
    case "clock":
      shape = <><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 3"/></>; break;
    case "crown":
      shape = <><path d="m3 7 5 5 4-7 4 7 5-5-2 12H5L3 7z"/><path d="M6 22h12"/></>; break;
    case "chat":
      shape = <><path d="M21 11a8 8 0 0 1-8 8 9 9 0 0 1-4-1l-6 3 2-6a8 8 0 1 1 16-4z"/><path d="M8 11h.01M12 11h.01M16 11h.01"/></>; break;
    case "gift":
      shape = <><rect x="3" y="9" width="18" height="12" rx="1"/><path d="M3 13h18M12 9v12M12 9C4 9 5 3 9 3c2 0 3 4 3 6zm0 0c8 0 7-6 3-6-2 0-3 4-3 6z"/></>; break;
    case "lock":
      shape = <><rect x="5" y="11" width="14" height="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></>; break;
    case "arrow":
      shape = <><path d="M4 12h16m-6-6 6 6-6 6"/></>; break;
    default:
      shape = <path d="M12 2v20M2 12h20"/>;
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...common}>{shape}</svg>;
}

function SnarSignature() {
  return (
    <Link to="/" className="beta-signature" aria-label="SNAR – til forsiden">
      <img src="/assets/beta/snar-glow.svg" width="56" height="56" alt="" />
      <span className="beta-signature-type">
        <strong>SNAR</strong>
        <small>Smartere mobilitet</small>
      </span>
    </Link>
  );
}

export default function BetaLanding() {
  const formId = useId();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [device, setDevice] = useState<Device>("ios");
  const [district, setDistrict] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<IntakeStatus>("idle");
  const [error, setError] = useState("");
  const [website, setWebsite] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting" || status === "success") return;
    if (name.trim().length < 2 || !/^[+\d ()-]{8,30}$/.test(phone.trim()) ||
        phone.replace(/\D/g, "").length < 8 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        !district || !consent) {
      setStatus("error");
      setError("Kontroller opplysningene og godta kontakt om beta.");
      return;
    }

    setStatus("submitting");
    setError("");
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("/beta-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim().toLowerCase(),
          city: "Oslo",
          role: "passenger",
          device,
          district,
          website,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok !== true || result.status !== "registered")
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "Påmeldingen kunne ikke lagres. Prøv igjen senere.",
        );
      setStatus("success");
    } catch (reason) {
      setError(reason instanceof Error && reason.name === "AbortError"
        ? "Forespørselen tok for lang tid. Prøv igjen."
        : reason instanceof Error ? reason.message : "Det oppstod en feil. Prøv igjen.");
      setStatus("error");
    } finally {
      window.clearTimeout(timer);
    }
  }

  return (
    <div className="snar-page beta-v2" id="top">
      <a className="beta-skip-link" href="#beta-main">Hopp til innhold</a>
      <header className="beta-topbar">
        <div className="beta-container beta-topbar-inner">
          <SnarSignature />
          <nav aria-label="Hovedmeny">
            <a className="selected" href="#top">Beta</a>
            <Link to="/">Om SNAR</Link>
            <a href="#beta-faq">FAQ</a>
          </nav>
          <a className="beta-topbar-cta" href="#beta-signup">Søk om tilgang <span aria-hidden="true">↗</span></a>
        </div>
      </header>

      <main id="beta-main">
        <section className="beta-visual" aria-labelledby="beta-title">
          <div className="beta-visual-backdrop" aria-hidden="true" />
          <div className="beta-container beta-visual-content">
            <div className="beta-headline">
              <span className="beta-kicker"><span className="beta-kicker-light" /> EKSKLUSIV OSLO BETA · 2026</span>
              <h1 id="beta-title">Oslo beveger seg<br /><em>SNARere<span>.</span></em></h1>
              <p>
                SNAR er en smartere mobilitetsplattform som gjør det enklere
                å komme seg rundt i byen. Søk om tidlig tilgang til vår lukkede beta i Oslo.
              </p>

              <div className="beta-founding" aria-label="SNAR Founding 500">
                <div className="beta-found-number"><span>FOUNDING</span><strong>500</strong><span className="beta-found-stars" aria-hidden="true">✦ ✦ ✦</span></div>
                <div className="beta-found-copy">
                  <span className="beta-caption-red">FOR DE FØRSTE SOM ER MED</span>
                  <h2>Bli en del av Founding 500</h2>
                  <p>De første 500 som får beta-tilgang blir våre Founding Riders og får informasjon om egne betafordeler.</p>
                  <div className="beta-perks">
                    <span><Glyph kind="gift" size={16}/> Invitasjon før offentlig lansering</span>
                    <span><Glyph kind="spark" size={16}/> Førstetursfordel annonseres senere</span>
                  </div>
                </div>
              </div>
            </div>

            <aside className="beta-signup-panel" id="beta-signup">
              <div className="beta-panel-topline"><span>SNAR · OSLO</span><span className="beta-panel-status"><i /> LUKKET BETA</span></div>
              <h2>Søk om beta-tilgang i Oslo</h2>
              <p className="beta-form-intro">Bli blant de første som tester SNAR i en lukket beta.</p>
              {status === "success" ? (
                <div className="beta-form-success" role="status">
                  <span aria-hidden="true">✓</span>
                  <h3>Interessen din er registrert</h3>
                  <p>Vi kontakter deg på e-post hvis du får plass i en testgruppe. Dette er ikke en automatisk godkjenning.</p>
                  <Link to="/">Se mer om SNAR</Link>
                </div>
              ) : (
                <form className="beta-inline-form" onSubmit={submit} noValidate aria-busy={status === "submitting"}>
                  <label htmlFor={formId + "-name"}>Navn <b>*</b></label>
                  <div className="beta-field"><span aria-hidden="true">♙</span><input id={formId + "-name"} placeholder="Ditt fulle navn" name="name" autoComplete="name" maxLength={100} value={name} onChange={e=>setName(e.target.value)} required disabled={status==="submitting"}/></div>

                  <label htmlFor={formId + "-phone"}>Telefon <b>*</b></label>
                  <div className="beta-field"><span aria-hidden="true">☏</span><input id={formId + "-phone"} placeholder="+47 123 45 678" name="phone" type="tel" autoComplete="tel" maxLength={30} value={phone} onChange={e=>setPhone(e.target.value)} required disabled={status==="submitting"} /></div>

                  <label htmlFor={formId + "-email"}>E-post <b>*</b></label>
                  <div className="beta-field"><span aria-hidden="true">✉</span><input id={formId + "-email"} placeholder="din@epost.no" name="email" type="email" autoComplete="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} required disabled={status==="submitting"} /></div>

                  <fieldset className="beta-device-fieldset">
                    <legend>Enhet <b>*</b></legend>
                    <div className="beta-device-options">
                      <label className={device==="ios"?"active":""}>
                        <input type="radio" name="device" value="ios" checked={device==="ios"} onChange={()=>setDevice("ios")} disabled={status==="submitting"}/>
                        <span className="beta-radio-dot" /> iPhone
                      </label>
                      <label className={device==="android"?"active":""}>
                        <input type="radio" name="device" value="android" checked={device==="android"} onChange={()=>setDevice("android")} disabled={status==="submitting"}/>
                        <span className="beta-radio-dot" /> Android
                      </label>
                    </div>
                  </fieldset>

                  <label htmlFor={formId + "-district"}>Bydel i Oslo <b>*</b></label>
                  <div className="beta-field beta-select-field"><span aria-hidden="true">⌖</span><select id={formId + "-district"} name="district" value={district} onChange={e=>setDistrict(e.target.value)} required disabled={status==="submitting"}>
                    <option value="">Velg bydel</option>
                    {districts.map(value=><option value={value} key={value}>{value}</option>)}
                  </select></div>
                  <div className="beta-anti-spam" aria-hidden="true"><label>Nettside<input tabIndex={-1} autoComplete="off" value={website} onChange={e=>setWebsite(e.target.value)}/></label></div>

                  <label className="beta-consent">
                    <input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} required disabled={status==="submitting"} />
                    <span>Jeg samtykker til at SNAR kontakter meg om beta. <Link to="/personvern">Les personvern</Link>.</span>
                  </label>
                  {error && <p role="alert" className="beta-form-error">{error}</p>}
                  <button className="beta-submit" type="submit" disabled={status==="submitting"}>
                    {status==="submitting"?"Sender påmelding…":"Søk om beta-tilgang"} <Glyph kind="arrow" size={22}/>
                  </button>
                  <p className="beta-form-footnote"><Glyph kind="lock" size={12}/> Lukket beta · Begrenset antall plasser · Kun Oslo</p>
                </form>
              )}
            </aside>
          </div>
        </section>

        <section className="beta-content-section beta-container" aria-labelledby="beta-process-title" id="slik-fungerer-det">
          <div className="beta-section-title"><span/><h2 id="beta-process-title">Slik fungerer den lukkede betaen</h2><span/></div>
          <div className="beta-process-grid">
            {steps.map((step,index)=>(
              <article className="beta-process-step" key={step.number}>
                <div className="beta-process-icon"><Glyph kind={step.icon} size={31}/><i>{index+1}</i></div>
                <div><h3>{step.title}</h3><p>{step.copy}</p></div>
                {index<3&&<span className="beta-step-arrow" aria-hidden="true">→</span>}
              </article>
            ))}
          </div>
        </section>

        <section className="beta-content-section beta-container beta-benefits-section" aria-labelledby="beta-benefit-title">
          <div className="beta-section-title"><span/><h2 id="beta-benefit-title">Derfor bli med i SNAR-betaen</h2><span/></div>
          <div className="beta-benefits-grid">
            {benefits.map(benefit=>(
              <article className="beta-benefit" key={benefit.title}>
                <div className="beta-benefit-icon"><Glyph kind={benefit.icon} size={31}/></div>
                <div><h3>{benefit.title}</h3><p>{benefit.copy}</p></div>
              </article>
            ))}
          </div>
        </section>

        <section className="beta-faq-teaser beta-container" id="beta-faq">
          <div>
            <h2>Ofte stilte spørsmål</h2>
            <p>Lurer du på noe? Her finner du svar på de vanligste spørsmålene om betaen.</p>
          </div>
          <div className="beta-faq-items">
            <details><summary>Er registrering en godkjenning?</summary><p>Nei. Vi vurderer påmeldingene og inviterer en begrenset testgruppe når løsningen er klar.</p></details>
            <details><summary>Er turene gratis?</summary><p>Eventuelle kampanjefordeler blir kommunisert med tydelige vilkår ved invitasjon. Ingen gratis turer er aktivert nå.</p></details>
            <details><summary>Hvordan får jeg appen?</summary><p>Godkjente deltakere vil få egen informasjon om installasjon på Android eller iPhone.</p></details>
          </div>
        </section>
      </main>

      <footer className="beta-footer">
        <div className="beta-container beta-footer-inner">
          <SnarSignature />
          <div className="beta-footer-links"><Link to="/">Om SNAR</Link><Link to="/personvern">Personvern</Link><Link to="/vilkar">Vilkår</Link></div>
          <span className="beta-oslo">⌖ Oslo, Norge</span>
        </div>
      </footer>
    </div>
  );
}
