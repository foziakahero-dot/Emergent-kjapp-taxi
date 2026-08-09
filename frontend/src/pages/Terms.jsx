import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

export default function Terms() {
  const navigate = useNavigate();
  return (
    <div className="phone-shell grain">
      <div className="px-4 pt-4 flex items-center gap-2 sticky top-0 bg-bg/95 backdrop-blur z-10">
        <button onClick={() => navigate(-1)} className="w-10 h-10 grid place-items-center text-[#7a8388]" data-testid="terms-back">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-white text-lg font-medium">Brukervilkår</h1>
      </div>
      <div className="px-6 pt-4 pb-16 text-[#c9cfd3] text-[14px] leading-relaxed space-y-5">
        <div className="text-[11px] text-[#7a8388] uppercase tracking-widest">Sist oppdatert: 9. januar 2026</div>

        <Section title="1. Om KJAPP">
          KJAPP AS («KJAPP», «vi», «oss») driver en digital plattform som formidler drosjetjenester mellom passasjerer og godkjente sjåfører i Norge. Vi utfører ikke transporten selv — sjåføren er selvstendig og løyveinnehaver.
        </Section>

        <Section title="2. Godtakelse av vilkår">
          Ved å opprette konto eller bruke KJAPP-appen godtar du disse vilkårene og vår <a className="text-mint" href="/privacy">personvernerklæring</a>. Er du under 18 må du ha samtykke fra foresatte.
        </Section>

        <Section title="3. Bestille tur">
          Når du bestiller en tur, inngås en transportavtale mellom deg og sjåføren. Pris estimeres på forhånd (startpris + km-pris + minutt-tillegg iht. norsk taxi-tariff). Faktisk pris kan avvike ved forsinkelser eller endringer under turen.
        </Section>

        <Section title="4. Betaling">
          Betaling skjer via valgt metode (Vipps, kort, ol.) automatisk etter fullført tur. Ved betalingsfeil kan tur begrenses inntil oppgjør. Kvittering sendes i appen og eventuelt på e-post.
        </Section>

        <Section title="5. Kansellering">
          Du kan kansellere en tur før sjåføren har hentet deg uten kostnad. Kansellerer du etter at sjåføren er ankommet, kan et gebyr tilsvarende startpris (fra 55 kr) belastes.
        </Section>

        <Section title="6. Oppførsel">
          Både passasjer og sjåfør skal opptre respektfullt. Vi forbeholder oss retten til å utestenge kontoer ved trakassering, hærverk, ruspåvirkning, eller andre brudd. Sjåfører kan avslå tur ved rimelig grunn (sikkerhet, mangel på plass).
        </Section>

        <Section title="7. Sjåfører">
          Sjåfør-kontoer kan kun opprettes via invitasjon fra godkjent løyvehaver, og må godkjennes av KJAPP før tildeling av turer. Sjåfør er ansvarlig for gyldig løyve, kjøreseddel, forsikring og teknisk stand på kjøretøy.
        </Section>

        <Section title="8. Ansvarsbegrensning">
          KJAPP formidler tjenesten og er ikke ansvarlig for skader eller tap under transporten utover det som følger av ufravikelig lovgivning. Sjåførens forsikring dekker skader iht. norsk vegtrafikklov.
        </Section>

        <Section title="9. AI-tjenesten (KJAPP AI)">
          KJAPP AI (Claude Sonnet 4.5) er en digital assistent. Den kan gi feil informasjon. Ikke bruk AI-svar som juridisk, medisinsk eller finansiell rådgivning.
        </Section>

        <Section title="10. Endringer">
          Vi kan endre vilkårene med varsel i appen. Ved fortsatt bruk etter endring anses vilkårene som godtatt.
        </Section>

        <Section title="11. Lov og verneting">
          Norsk rett gjelder. Verneting er Oslo tingrett. Forbrukerklager kan sendes til Forbrukertilsynet.
        </Section>

        <Section title="12. Kontakt">
          KJAPP AS · <a className="text-mint" href="mailto:support@kjapp.no">support@kjapp.no</a>
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
