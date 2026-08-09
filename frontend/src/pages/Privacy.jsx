import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

export default function Privacy() {
  const navigate = useNavigate();
  return (
    <div className="phone-shell grain">
      <div className="px-4 pt-4 flex items-center gap-2 sticky top-0 bg-bg/95 backdrop-blur z-10">
        <button onClick={() => navigate(-1)} className="w-10 h-10 grid place-items-center text-[#7a8388]" data-testid="privacy-back">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-white text-lg font-medium">Personvernerklæring</h1>
      </div>
      <div className="px-6 pt-4 pb-16 text-[#c9cfd3] text-[14px] leading-relaxed space-y-5">
        <div className="text-[11px] text-[#7a8388] uppercase tracking-widest">Sist oppdatert: 9. januar 2026</div>

        <Section title="1. Behandlingsansvarlig">
          KJAPP AS (org.nr. under registrering), heretter «KJAPP», er behandlingsansvarlig for personopplysningene som samles inn og behandles gjennom KJAPP-appen og tilhørende tjenester.
        </Section>

        <Section title="2. Hvilke opplysninger vi samler inn">
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><b>Konto:</b> navn, e-post, telefonnummer, valgt passord (hashet), profilbilde (ved Google/Apple-innlogging).</li>
            <li><b>Turer:</b> hentested, destinasjon, tidspunkt, distanse, pris, vurdering, chat med AI.</li>
            <li><b>Posisjon:</b> GPS-koordinater mens du bruker appen (ved samtykke) for å finne nærmeste sjåfør og lage rute.</li>
            <li><b>Enhetsdata:</b> operativsystem, appversjon, IP-adresse, push-abonnement.</li>
            <li><b>Betaling:</b> siste 4 sifre av kort og betalingsmetode. Vi lagrer <b>aldri</b> hele kortnummeret — det håndteres av Stripe/Vipps.</li>
          </ul>
        </Section>

        <Section title="3. Formål med behandlingen">
          Vi behandler opplysningene for å levere taxi-tjenesten (matche deg med sjåfør, beregne pris, sende varsler), oppfylle rettslige krav (skatterapportering iht. drosjeregelverk), forbedre appen, og for kundesupport.
        </Section>

        <Section title="4. Rettslig grunnlag">
          Behandling skjer på grunnlag av avtalen mellom deg og KJAPP (personvernforordningen art. 6 nr. 1 bokstav b), samt lovpålagte krav (art. 6 nr. 1 bokstav c) for drosjeoperatører i Norge.
        </Section>

        <Section title="5. Deling av opplysninger">
          Vi deler opplysninger med: sjåføren som utfører turen (navn, telefon, hentested, destinasjon), Skatteetaten (turdata iht. lov), Stripe/Vipps (betaling), SendGrid (e-post), OpenStreetMap/OSRM (kart og rute — koordinater sendes uten navn), og våre AI-partnere (Anthropic Claude for KJAPP AI). Vi selger <b>aldri</b> opplysninger.
        </Section>

        <Section title="6. Lagringstid">
          Turdata lagres i minst 10 år iht. bokføringsloven. Konto-opplysninger lagres så lenge du har aktiv konto + 3 år etter sletting for skatteformål.
        </Section>

        <Section title="7. Dine rettigheter">
          Du kan når som helst kreve innsyn, retting, sletting eller dataportabilitet ved å kontakte oss på <a className="text-mint" href="mailto:personvern@kjapp.no">personvern@kjapp.no</a>. Du kan også klage til Datatilsynet (datatilsynet.no).
        </Section>

        <Section title="8. Sikkerhet">
          Vi bruker TLS-kryptering, bcrypt for passord, JWT-tokens med kort levetid, og infrastruktur i EU. Push-varsler sendes via kryptert web-push med VAPID-nøkler.
        </Section>

        <Section title="9. Kontakt">
          KJAPP AS · personvern@kjapp.no · <a className="text-mint" href="mailto:support@kjapp.no">support@kjapp.no</a>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h2 className="text-white text-[15px] font-semibold mb-1">{title}</h2>
      <div>{children}</div>
    </div>
  );
}
