# SNAR · tiltak og kontrollert utrulling

### Før ekstern beta

| Prioritet | Ansvarlig | Gjennomføring | Ferdig når |
| --- | --- | --- | --- |
| P0 | Eier og sikkerhetsansvarlig | Behandle historiske nøkkeltreff privat. Sammenlign mot leverandørens nøkkeloversikt, begrensninger, historikk og status. Dokumenter aktive, opphevede, offentlige og syntetiske treff separat. | Hvert mulig privat treff har eier og avgjørelse. Eventuell inneslutning og rotasjon er godkjent og etterprøvd. |
| P1 | Backend og panel | Fagfellevurder sesjon, opprinnelseskontroll, webhook, XML og avhengigheter på nøyaktig SHA. Rull backend og admin-klient koordinert i QA etter godkjenning. | Ny og eksisterende admin kan fullføre innlogging og første faktoroppsett, en gammel sesjon får påloggingskrav og ingen skrivehandling spilles automatisk av. |
| P1 | Driftsansvarlig | Gjennomgå effektive Atlas-brukere, roller, tilgangslister, backupoppsett, nøkkelforvaltning og separate QA-/produksjonskontoer. Avtal RPO/RTO. | Dokumentert gjenoppretting av syntetiske data til isolert mål. Kildeproduksjon har ingen skrivehendelser fra øvelsen. |
| P1 | Betaling og QA | Verifiser riktig mottaker, testmodus, 12 % etter vedtatt regel, refusjon, gjentatt webhook, kort og begge mobile wallets. | Testoppgjør, kvittering og forventet netto avstemmes, kun med syntetiske referanser. |
| P1 | Personvern og QA | Fullfør DPIA og test med to kunder, to flåter og fysisk mobilpar på eksakt kandidat. | Uavhengig kontroll av rettigheter, turforløp og betaling, samt dokumentert risikobeslutning. |
| P2 | Sikkerhetsansvarlig | Pilotér WebAuthn/passnøkler for privilegerte roller og gjennomgang av gjenoppretting. Vurder feltkryptering av TOTP-materiale og kortere privilegerte sesjoner med plan for gamle klienter. | Innrullering, tapt enhet, tilbakekalling og kontrollert gjenoppretting fungerer i QA. |

### Brannmur og tilgjengelighet

Behold Render som origin. Vurder eksisterende kantleverandør eller proxiet QA-domene med Cloudflare. Bruk verifisert sertifikat hele veien til Render. Kartlegg standarddomener, gamle domener, Netlify-proxy, HTTP, websocket og helsesjekker før noen DNS-endring. Kontroller hva Render faktisk bruker som probe. Bare GET/HEAD på /api/health har et avgrenset unntak i grenens opprinnelseskontroll.

1. Mål legitim trafikk per rutefamilie, inkludert innlogging, OTP, dokumenter, Stripe, websocket-reconnect og GPS. Bruk aggregater uten URL-parametere, kunde-ID eller koordinater. Verifiser hvor klient-IP kommer fra og hvilke mellomledd som overskriver headeren. Hold tillit til ubekreftede forwarding-headere avslått.
2. Start kantleverandørens administrerte regler og trafikkdeteksjon med telling/observasjon der valgt plan støtter dette. Se særskilt på mange mobilbrukere bak samme IP. Ikke legg CAPTCHA eller nettleserutfordring på native API, Socket.IO eller betalingswebhook.
3. Kontroller pålitelig proxy med SNAR_EDGE_MODE=observe og separat tilfeldig nøkkel i sikker konfigurasjon. Kanten må erstatte innkommende markør og tilføye sin egen. Frontend og Expo skal aldri motta nøkkelen. Kontroller at legitime betalingshendelser og websocket-oppgraderinger når origin gjennom kanten.
4. Etter godkjent QA-repetisjon kan drift velge enforce. Bind bare API-trafikk gjennom godkjent kant; kontroller alternativt Render-domene og andre publiserte aliaser. Liveness-proben forblir tilgjengelig. Sett egne budsjetter for OTP, geokoding og dokumentopplasting. Unngå en felles lav grense på posisjonsoppdateringer, webhooks og transaksjonsbekreftelser.
5. Mål falske avvisninger, tid til ny socketforbindelse, antall 401/403/429, webhook-kø og vellykket bestilling. Reverser fra enforce til observe ved dokumentert blokkering av legitime flyter.

**Kostnad og endringsmyndighet.** Ingen ny tjeneste er kjøpt. Middleware krever ingen ekstern lisens. DNS-proxy, administrerte regler, bot-/ratekontroller, loggeksport, oppbevaring og varsling kan ha ulike plan- eller trafikkostnader. Faktisk månedspris er uverifisert. Drift må dokumentere leverandørtilbud, volum, hardt kostnadstak, databehandleravtale og eiergodkjenning før betalte valg. [Cloudflare WAF](https://developers.cloudflare.com/waf/) · [Render-domener](https://render.com/docs/custom-domains)

### Hendelser som bør utløse varsling

| Signal | Første vurdering | Ansvar og reaksjon |
| --- | --- | --- |
| Mange 401/429 på login/OTP over normalnivå | Skill delt mobilnett, leverandørfeil og faktisk misbruk | Drift sjekker per rutemal, tidsrom og aggregat. Juster begrensning etter vurdering. |
| Signaturfeil eller stopp i vellykket Stripe-leveranse | Sjekk deploytid, endepunktkonfigurasjon og forsøk i Stripe | Betalingsansvarlig avstemmer før ny behandling. |
| Endringer i rettigheter, integrasjoner eller utbetalingsmåte | Sjekk godkjent endringssak og nylig autentisering | Sikkerhetsansvarlig eskalerer uventet endring til eier. |
| Økning i 403, trafikk uten kantbevis, uvanlig websocketsvinn | Sammenlign med klientversjon og kjent klienttrafikk | Drift isolerer ruten, bevarer redigerte logger og følger hendelsesplanen. |

Grenens logger gir signaler. Varslingskanaler, terskler og vaktmottak må prøves med syntetiske hendelser og justeres mot normaltrafikk i QA.

### Migrering og rollback

Ingen nye samlinger, skjemaendringer eller datamigrering inngår. Gamle privilegerte sesjoner kan kreve ny innlogging. En positiv tofaktoraktivering er en ekte sikkerhetsendring på kontoen. Bevar faktoren og gjenopprett tilgang via avtalt prosedyre. Før QA-utrulling registrerer drift forrige backend-SHA, panelartefakt, faktisk Python-versjon, helsesvar og kantmodus. Ved regresjon tilbakeføres det koordinerte backend-/panelsettet til forrige godkjente kandidat etter godkjenning. En slik tilbakeføring kan gjeninnføre gamle risikoer. Hold ekstern beta stengt, og verifiser innlogging, livekart og betalingskø på nytt.
