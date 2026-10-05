import { Link, Route, Routes } from "react-router-dom";
import { ApplyPage } from "./ApplyPage";
import PremiumHome from "./PremiumHome";
import { TripSharePage } from "./TripSharePage";
import LegalPage from "./LegalPage";
import { Card, Footer, Header } from "./SnarUI";
import { contactEmail, FLEET_URL } from "./siteConfig";

const onboardingSteps = [
  ["01", "Send søknad", "Firma, kontaktinformasjon, løyver og kjøretøy."],
  ["02", "Dokumentasjon", "Løyvebevis, vognkort, forsikring og bankinformasjon."],
  ["03", "SNAR kontrollerer", "Søknaden og dokumentasjonen gjennomgås før aktivering."],
  ["04", "Fleet åpnes", "Godkjente partnere får tilgang til SNAR Fleet."],
];

const partnerValues = [
  ["12 %", "SERVICEAVGIFT", "En enkel og tydelig sats. Mer av turinntekten blir igjen i virksomheten."],
  ["UKENTLIG", "OPPGJØR", "Digitale betalinger kan avregnes automatisk hver uke."],
  ["ÉN", "FLEET-OVERSIKT", "Sjåfører, turer, kjøretøy, økonomi og dokumentstatus samlet på ett sted."],
  ["NORSK", "PARTNERSTØTTE", "Direkte oppfølging når konto, dokumentasjon eller oppgjør må avklares."],
];

function PartnerPage() {
  return (
    <div className="snar-page">
      <Header />
      <main id="content">
        <section className="snar-section snar-shell snar-partner-hero">
          <div>
            <span className="snar-kicker">FOR LØYVEHAVERE</span>
            <h1>Behold mer.<br />Jobb smartere.</h1>
            <p>
              SNAR er bygget for løyvehavere som vil bruke mindre tid på administrasjon og beholde mer av verdien de skaper.
              Du får booking, betaling og flåteverktøy i én løsning — med 12 % serviceavgift og ukentlig oppgjør.
            </p>
            <div className="snar-actions">
              <Link className="snar-btn snar-btn-primary" to="/loyvehaver/soknad">Søk om å bli partner</Link>
              <a className="snar-btn snar-btn-secondary" href={FLEET_URL}>Åpne Fleet Panel</a>
            </div>
            <p className="snar-caption">12 % serviceavgift · Ukentlig digitalt oppgjør · Full flåteoversikt</p>
          </div>
          <Card>
            <span className="snar-kicker">FLEET PANEL</span>
            <h3>Sjåfører. Turer.<br />Dokumenter. Oppgjør.</h3>
            <p>Alt du trenger for å følge driften — uten å gi fra deg kontrollen over virksomheten.</p>
          </Card>
        </section>

        <section className="snar-section snar-shell">
          <div className="snar-section-copy">
            <span className="snar-kicker">MER IGJEN PER TUR</span>
            <h2>Hvorfor gi fra deg<br />mer enn nødvendig?</h2>
            <p>
              Moderne teknologi trenger ikke bety at plattformen tar en stor del av verdien rundt hver tur.
              Med SNAR får du en tydelig 12 % serviceavgift og verktøyene du trenger for å drive effektivt.
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
            <div className="snar-section-copy">
              <span className="snar-kicker">DIN VIRKSOMHET</span>
              <h2>Teknologien skal jobbe for deg.</h2>
              <p>
                Du beholder løyvene, bilene, sjåførene og virksomheten. SNAR leverer teknologien rundt booking, betaling,
                dokumentasjon og drift — slik at du kan bruke mer tid på flåten og mindre tid på administrasjon.
              </p>
            </div>
          </div>
        </section>

        <section className="snar-section snar-shell">
          <div className="snar-section-copy">
            <span className="snar-kicker">SLIK BLIR DU PARTNER</span>
            <h2>Én kontrollert vei inn.</h2>
            <p>
              Tilgang til Fleet åpnes først etter at firma og dokumentasjon er kontrollert.
              Det gir en ryddig onboarding for både SNAR og løyvehaveren.
            </p>
          </div>
          <div className="snar-partner-value-grid">
            {onboardingSteps.map(([n, title, copy]) => (
              <article key={n}>
                <span className="snar-number">{n}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="snar-section snar-shell">
          <span className="snar-kicker">KLAR FOR NESTE STEG?</span>
          <h2>Bli SNAR-partner.</h2>
          <p>Bygg videre på virksomheten du allerede har — med lavere plattformfriksjon, tydelig økonomi og moderne verktøy rundt turene.</p>
          <div className="snar-actions">
            <Link className="snar-btn snar-btn-primary" to="/loyvehaver/soknad">Start søknaden</Link>
            <a className="snar-btn snar-btn-secondary" href={`mailto:${contactEmail("partner")}`}>Kontakt partnerteamet</a>
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
