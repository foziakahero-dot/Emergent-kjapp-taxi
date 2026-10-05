import { Card, Footer, Header } from "./SnarUI";

/* Restore the existing beta legal-route notice; no legal terms are invented. */
export default function LegalPage({ kind }: { kind: "privacy" | "terms" }) {
  const privacy = kind === "privacy";
  return (
    <div className="snar-page">
      <Header />
      <main id="content" className="snar-legal snar-shell">
        <span className="snar-kicker">SNAR · BETA</span>
        <h1>{privacy ? "Personvern" : "Vilkår"}</h1>
        <p>
          {privacy
            ? "Denne siden er opprettet som fast personvernadresse for SNAR. Endelig juridisk godkjent personvernerklæring publiseres her før offentlig kommersiell lansering."
            : "Denne siden er opprettet som fast vilkårsadresse for SNAR. Endelig juridisk godkjente kunde-, sjåfør- og plattformvilkår publiseres her før offentlig kommersiell lansering."}
        </p>
        <Card>
          <strong>
            {privacy ? "Personvernkontakt" : "Spørsmål om vilkår"}
          </strong>
          <p>
            <a
              href={
                privacy
                  ? "mailto:privacy@kjappapp.no"
                  : "mailto:support@kjappapp.no"
              }
            >
              {privacy ? "privacy@kjappapp.no" : "support@kjappapp.no"}
            </a>
          </p>
        </Card>
        <p>
          Denne betasiden erstatter ikke den endelige juridiske teksten. Den
          gjør URL-en stabil for appene mens teksten ferdigstilles og
          godkjennes.
        </p>
      </main>
      <Footer />
    </div>
  );
}
