import { Link, Route, Routes } from "react-router-dom";
import { ApplyPage } from "./ApplyPage";
import PremiumHome from "./PremiumHome";
import { TripSharePage } from "./TripSharePage";
import LegalPage from "./LegalPage";
import { Card, Footer, Header } from "./SnarUI";

const onboardingSteps = [
  ["01", "Send søknad", "Firma, kontaktinformasjon, løyver og kjøretøy."],
  [
    "02",
    "Dokumentasjon",
    "Løyvebevis, vognkort, forsikring og bankinformasjon.",
  ],
  [
    "03",
    "SNAR kontrollerer",
    "Søknaden og dokumentasjonen gjennomgås før aktivering.",
  ],
  [
    "04",
    "Fleet åpnes",
    "Godkjente partnere får tilgang til fleet.kjappapp.no.",
  ],
];
const partnerValues = [
  [
    "10 %",
    "SERVICEAVGIFT",
    "En tydelig modell for beta. 90 % av turinntekten beholdes hos sjåfør/løyvehaver før øvrige egne kostnader.",
  ],
  [
    "7 DAG",
    "UKENTLIG OPPGJØR",
    "Digitale betalinger kan avregnes automatisk hver uke.",
  ],
  [
    "ÉN",
    "SAMLET OVERSIKT",
    "Sjåfører, turer, kjøretøy, økonomi og dokumentstatus i Fleet Panel.",
  ],
  [
    "NO",
    "NORSK OPPFØLGING",
    "Direkte kontakt når konto, dokumentasjon eller oppgjør må avklares.",
  ],
];
function PartnerPage() {
  return (
    <div className="snar-page">
      <Header />
      <main id="content">
        <section className="snar-section snar-shell snar-partner-hero">
          <div>
            <span className="snar-kicker">FOR LØYVEHAVERE</span>
            <h1>
              Din flåte.
              <br />
              Din kontroll.
            </h1>
            <p>
              SNAR gir løyvehavere et moderne system for sjåfører, turer,
              kjøretøy, dokumentasjon og oppgjør — uten å ta virksomheten fra
              deg.
            </p>
            <div className="snar-actions">
              <Link
                className="snar-btn snar-btn-primary"
                to="/loyvehaver/soknad"
              >
                Søk om å bli partner
              </Link>
              <a
                className="snar-btn snar-btn-secondary"
                href="https://fleet.kjappapp.no"
              >
                Åpne Fleet Panel
              </a>
            </div>
            <p className="snar-caption">
              10 % serviceavgift i beta · Ukentlig digitalt oppgjør · Norsk
              oppfølging
            </p>
          </div>
          <Card>
            <span className="snar-kicker">FLEET PANEL</span>
            <h3>
              Sjåfører. Turer.
              <br />
              Dokumenter. Oppgjør.
            </h3>
            <p>Reelle flåtedata vises først etter innlogging.</p>
          </Card>
        </section>
        <section className="snar-section snar-shell">
          <div className="snar-section-copy">
            <span className="snar-kicker">PARTNERMODELL</span>
            <h2>
              Mindre administrasjon.
              <br />
              Mer kontroll.
            </h2>
            <p>
              SNAR skal gjøre det enklere å drive en moderne taxiflåte.
              Partneren beholder løyvet, sjåførene og virksomheten. SNAR leverer
              teknologien rundt turene.
            </p>
          </div>
          <div className="snar-partner-value-grid">
            {partnerValues.map(([metric, title, copy]) => (
              <Card key={title}>
                <strong className="snar-partner-metric">{metric}</strong>
                <h3>{title}</h3>
                <p>{copy}</p>
              </Card>
            ))}
          </div>
        </section>
        <section className="snar-section snar-vehicles">
          <div className="snar-shell">
            <span className="snar-kicker">SLIK BLIR DU PARTNER</span>
            <h2>Én kontrollert vei inn.</h2>
            <p>
              Tilgang til Fleet åpnes først etter at firma og dokumentasjon er
              kontrollert. Det gir en ryddig onboarding for både SNAR og
              løyvehaveren.
            </p>
            <div className="snar-partner-value-grid">
              {onboardingSteps.map(([n, title, copy]) => (
                <article key={n}>
                  <span className="snar-number">{n}</span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="snar-section snar-shell">
          <span className="snar-kicker">KLAR FOR NESTE STEG?</span>
          <h2>Bli SNAR-partner.</h2>
          <p>
            Søknaden gir ikke automatisk tilgang. Fleet-konto aktiveres etter
            kontroll og godkjenning av dokumentasjonen.
          </p>
          <div className="snar-actions">
            <Link className="snar-btn snar-btn-primary" to="/loyvehaver/soknad">
              Start søknaden
            </Link>
            <a
              className="snar-btn snar-btn-secondary"
              href="mailto:partner@kjappapp.no"
            >
              Kontakt partnerteamet
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PremiumHome />} />
      <Route path="/loyvehaver" element={<PartnerPage />} />
      <Route path="/loyvehaver/soknad" element={<ApplyPage />} />
      <Route path="/tur/:token" element={<TripSharePage />} />
      <Route path="/personvern" element={<LegalPage kind="privacy" />} />
      <Route path="/vilkar" element={<LegalPage kind="terms" />} />
      <Route path="*" element={<PremiumHome />} />
    </Routes>
  );
}
