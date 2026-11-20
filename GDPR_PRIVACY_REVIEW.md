# Personvernvurdering · SNAR-beta

**Anbefaling til NexoraHub AS:** Fullfør og godkjenn en DPIA før ekstern beta med ekte passasjerer og sjåfører. Løpende stedssporing, turhistorikk, identitetsdokumenter og kontroll av yrkesutøvere kan samlet gi høy risiko. Dette er en foreløpig risikovurdering. Virksomheten må selv ta og dokumentere avgjørelsen, fordele behandlingsansvar med løyvehaverne og rådføre seg med eventuelt personvernombud.

| Behandling | Formål og mulig grunnlag som må bekreftes | Lagring, tilgang og tiltak |
| --- | --- | --- |
| Konto, innlogging og kontakt | Tjenesteavtale art. 6(1)(b) for nødvendige kontofunksjoner. Sikkerhet kan kreve interesseavveiing etter (f). | Skill fritekst fra sikkerhetslogger. Koden definerer utløp for OTP (5 min), tilbakekalling og tilbakestilling. Kontroller faktisk TTL og sletting i drift. |
| GPS, hentested, destinasjon og tur | Gjennomføring av bestilt reise. Kontinuerlig overvåking utenfor tur krever særskilt nødvendighetsvurdering. | Begrens til tilgjengelig sjåfør eller aktiv tur. Egen tilgang til historikk. Fastsett kort tidsfrist for rå GPS, særfrist ved tvist og separat statistikk. Test at sporing stanser ved utlogging/avslutning. |
| Turdeling med lenke | Brukerinitiert deling med en valgt mottaker. Forklar hvilken posisjon og hvilke detaljer som blir synlige. | Koden tidsbegrenser deling til 24 timer. Test tidligere avslutning, tilgang etter tur og cache på enhet og kant. |
| Sjåfør-, løyve- og studentdokumenter, eventuelt selfie | Verifikasjon av rett til rollen eller fordelen. Kartlegg presist kontrakts-/lovgrunnlag og hvilke felter som trengs. | Kun godkjent saksbehandler/flåte med tjenstlig behov. Koden har konfigurerbar selfiefrist med standard 30 dager. Det er ikke påvist at alle oppryddingsjobber faktisk kjører. Vurder om verifikasjonsresultat alene kan beholdes. |
| Identitetskontroll med bilde | Avklar om behandling innebærer teknisk behandling for entydig identifisering. Da må også art. 9 vurderes før aktivering. | Dokumenter manuell overprøving, hvem som kan se originalen og alternativer til bilde. Et vanlig bilde gir ikke automatisk biometriklassifisering. |
| Betaling, beløp, mottaker og kvittering | Avtalefullføring, samt rettslig plikt for bestemte regnskapsdata der plikten gjelder. | Stripe håndterer betalingsinstrumentet. Begrens lagring av betalingsreferanser, definer frister per opplysning og dokumenter eventuelle lovpålagte unntak fra sletting. |
| Support, analyse og markedsføring | Egne, spesifiserte formål og grunnlag. Skill nødvendig kundeservice fra frivillig markedsføring. | Minimer meldingstekst til AI/andre leverandører, beskytt kontaktpreferanser og test reservasjon/tilbaketrekking. Produksjonsdata skal ikke bli QA-fixtures. |

### Uavklarte forhold som krever beslutning

1. Før behandlingsprotokoll med ansvar, berørte grupper, formål, datakilder, mottakere, frister og innsyn mellom NexoraHub, løyvehavere og leverandører. Vurder faktisk rolle per tjeneste for Atlas, Render, Netlify, Stripe, kart, e-post/SMS, pålogging, Expo/push og eventuell AI. Avtaler, underleverandører, land, overføringsgrunnlag og supplerende tiltak er ikke kontrollert.
2. Vurder sannsynlighet, konsekvens og restrisiko for sporing, økonomisk tap, feil identitetsavgjørelse og dokumentinnsyn. Inkluder sjåførens perspektiv, delte telefoner og personer som trenger skjermet adresse. Dokumenter begrunnelse for presisjon, synlighet og alternativer.
3. Test innsyn, retting, sletting, begrensning, protest og portabilitet med syntetisk bruker. Verifiser identiteten forholdsmessig. Identifiser hvilke registre og leverandører en henvendelse må nå. Dokumenter unntak og svarfrist. Test at gjenoppretting fra backup ikke utilsiktet gjeninnfører slettepliktige data.
4. Få signert oppbevaringsmatrise for konto, dokument, tur, support, GPS, sikkerhetslogg og backup. Angi ansvarlig jobb, siste bekreftede kjøring og avviksalarm. En TTL erklært i kode er ikke destruksjonsbevis.
5. Ved fortsatt høy risiko etter tiltak vurderes forhåndsdrøfting med Datatilsynet etter art. 36 før behandlingen starter. Personvernansvarlig dokumenterer avgjørelsen og oppdaterer DPIA ved nye datakilder eller nye formål.

[Datatilsynet om høy risiko og DPIA](https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/vurdering-av-personvernkonsekvenser/nar-er-risiko-hoy/) · [Personvernforordningen](https://eur-lex.europa.eu/eli/reg/2016/679/oj)
