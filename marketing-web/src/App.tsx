import { Link, Route, Routes } from "react-router-dom";
import { ApplyPage } from "./ApplyPage";
import PremiumHome from "./PremiumHome";
import { TripSharePage } from "./TripSharePage";
import LegalPage from "./LegalPage";
import { Card, Footer, Header } from "./SnarUI";
import { contactEmail, FLEET_URL } from "./siteConfig";
import { useServiceFee, serviceFeeLabel } from './platformConfig';

const onboardingSteps = [
  ["01", "Send søknad", "Firma, kontaktinformasjon, løyver og kjøretøy."],
  ["02", "Dokumentasjon", "Løyvebevis, vognkort, forsikring og bankinformasjon."],
  ["03", "SNAR kontrollerer", "Søknaden og dokumentasjonen gjennomgås før aktivering."],
  ["04", "Fleet åpnes", "Godkjente partnere får tilgang til SNAR Fleet."],
];

const partnerValues = [
  ["AVTALT", "SERVICEAVGIFT", "En tydelig avtale for bruken av SNAR-plattformen."],
  ["UKENTLIG", "OPPGJØR", "Digitale betalinger kan avregnes automatisk hver uke."],
  ["ÉN", "FLEET-OVERSIKT", "Sjåfører, turer, kjøretøy, økonomi og dokumentstatus samlet på ett sted."],
  ["NORSK", "PARTNERSTØTTE", "Direkte oppfølging når konto, dokumentasjon eller oppgjør må avklares."],
];

function PartnerPage() {
  const fee = useServiceFee();
  const feeLabel = serviceFeeLabel(fee);
  return (
    <div className="snar-page">
      <Header />
      <main id="content">
        <section className="snar-section snar-shell snar-partner-hero">
          <div>
            <span className="snar-kicker">FOR LØYVEHAVERE</span>
            <h1>Din virksomhet.<br />Bedre oversikt.</h1>
            <p>
              SNAR er en bestillings- og formidlingsplattform for profesjonelle sjåfører og løyvehavere. Bestillinger, betaling, oppgjør og drift samlet på ett sted.
              {` ${feeLabel}. Utbetalinger går til din bankkonto gjennom Stripe når kontoen er bekreftet.`}
            </p>
            <div className="snar-actions">
              <Link className="snar-btn snar-btn-primary" to="/loyvehaver/soknad">Søk om å bli partner</Link>
              <a className="snar-btn snar-btn-secondary" href={FLEET_URL}>Åpne Fleet Panel</a>
            </div>
            <p className="snar-caption">{feeLabel} · Din egen flåte · Digitalt oppgjør</p>
          </div>
          <Card>
            <span className="snar-kicker">FLEET PANEL</span>
            <h3>Sjåfører. Turer.<br />Dokumenter. Oppgjør.</h3>
            <p>Følg sjåfører, biler, dokumentstatus og oppgjør i SNAR Fleet.</p>
          </Card>
        </section>

        <section className="snar-section snar-shell">
          <div className="snar-section-copy">
            <span className="snar-kicker">TYDELIGE VILKÅR</span>
            <h2>Din virksomhet.<br />Vår plattform.</h2>
            <p>
              Du beholder løyvene, bilene og sjåførene. SNAR gjør det enklere å motta bestillinger og følge drift og oppgjør.
              Standard serviceavgift vises her; din avtalte sats vises i Fleet-portalen.
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
                Du beholder løyvene, bilene, sjåførene og virksomheten. SNAR samler bestilling, betaling,
                dokumentasjon og drift — slik at du kan bruke mer tid på flåten og mindre tid på administrasjon.
              </p>
            </div>
          </div>
        </section>

        <section className="snar-section snar-shell">
          <div className="snar-section-copy">
            <span className="snar-kicker">SLIK BLIR DU PARTNER</span>
            <h2>Slik får du tilgang.</h2>
            <p>
              Tilgang åpnes etter at virksomheten og dokumentasjonen er godkjent.
              Løyvehavere må ha gyldig drosjeløyve, og sjåfører må ha gyldig kjøreseddel.
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
          <p>Send én søknad med virksomhet og dokumenter. Etter godkjenning får du din egen Fleet-portal og kan invitere sjåfører.</p>
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

