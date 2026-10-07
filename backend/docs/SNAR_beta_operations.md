# SNAR: drift under beta

Oppdatert 7. oktober 2026. Dette dokumentet beskriver infrastrukturen som er kontrollert og flytene i denne kodeendringen. Ny kode må deployes og verifiseres før den regnes som aktiv. SNAR er en appplattform som kobler kunder med selvstendige løyvehavere.

## Publisering

- Nettside, Admin og Fleet bygges fra GitHub-grenen `main` i den nye Vercel-gruppen `snar1`.
- Adresser: `https://snarapp.no`, `https://admin.snarapp.no` og `https://fleet.snarapp.no`.
- Backend kjører på Render-tjenesten `kjapp-beta-api`, fra grenen `fix/beta-mobile-firebase-ops-20260926`. Automatisk deploy er **av**. Etter push må en Render-deploy startes og kontrolleres.
- Backend er felles for nettside, Admin, Fleet og mobilappene. En webdeploy oppdaterer ikke en installert mobilapp.

## Registrering og godkjenning

| Hendelse | Automatisk behandling | Operatørens oppgave |
| --- | --- | --- |
| Betaregistrering | Registrering lagres; bekreftelse legges i e-postkø | Velg testgruppe og åpne tilgang; registrering alene gir ikke konto |
| Innsendt partnersøknad | Søknad og dokumentreferanser lagres; mottaksbekreftelse til søker og varsel til admin legges i kø | Åpne søknaden i Admin og kontroller dokumentene |
| Godkjenn i Admin | Egen flåte og eierkonto knyttes sammen; svar legges i kø; Stripe-onboarding forberedes når Stripe er konfigurert | Godkjenn bare etter reell dokumentkontroll; avklar eventuelle konto-/rollekonflikter |
| Avslag | Svar med begrunnelse legges i kø | Oppgi forståelig begrunnelse |
| Sjåførinvitasjon fra Fleet | Lenke knyttes til inviterende flåte og valgt biltilgang; e-post forsøkes og får automatisk retry hvis mottaker er oppgitt | Ved mislykket sending: kontroller e-poststatus, bruk «Send på nytt» eller del lenken direkte |
| Sjåførregistrering | Konto og dokumenter knyttes til inviterende flåte; bekreftelse legges i kø | Admin kontrollerer og godkjenner sjåføren; opplastet fil alene betyr ikke verifisert dokument |

Godkjenningsmeldingen viser Fleet-adressen og e-postadressen fra søknaden, samt en engangslenke for å sette passord. Lenken opprettes under utsending, gjelder i én time, og bare tokenets hash lagres i databasen. Eier med eksisterende konto kan bruke sitt passord. «Glemt passord» er tilgjengelig ved behov. Bank-/identitetskontroll fullføres i Stripe via Fleet. Fleet-tilgang alene betyr ikke at Stripe-utbetalinger er klare.

Biltilgang lagres som tildelt bil, utvalgte biler eller alle aktive biler i egen flåte. Tilgangen trenger ikke settes på nytt før hver tur. Backend hindrer samtidig aktiv bruk av samme bil av flere sjåfører.

## E-post: kjent blokkering og retry

Live-kontrollen viste at e-post ikke var konfigurert. Sett `SENDGRID_API_KEY` i backend og verifiser avsenderen hos SendGrid før levering testes. `SENDER_EMAIL` er nå `noreply@kjappapp.no`; at adressen er konfigurert dokumenterer **ikke** at SendGrid har verifisert den. Ikke bytt avsender til et nytt domene uten verifisering.

Bekreftelser ligger i `onboarding_email_outbox`. Bakgrunnsarbeideren sjekker køen hvert 30. sekund når nøkkelen finnes. Den prøver inntil åtte ganger med økende mellomrom. Kontroller `pending`, `sending`, `sent` og `failed`; `queued` er ikke en leveringskvittering. Utsending kan skje på nytt hvis leverandøren mottar meldingen før prosessen mister bekreftelsen. Sjåførinvitasjoner har retry i samme bakgrunnsarbeider, men beholder invitasjonsreferansen i `driver_invites`: inntil åtte automatiske forsøk mens invitasjonen er gyldig og ubrukt. Kontroller `email_sent` og `email_attempts`; Fleet har også manuell resend og delbar lenke. Faktisk e-postlevering er ikke verifisert i produksjon før SendGrid er koblet til og testet.

## Dokumenter og backup

Mongo-fallback lagrer filinnhold i `document_blobs`, maks 8 MiB per fil. `uploaded_files` lagrer metadata og eierskap; `fleet_applications` og bruker-/flåteregistrene lagrer koblingene. Filene publiseres ikke som åpne nettadresser. Nedlasting krever innlogging og backendkontroll av rolle/eierskap. Rå identitetsselfier vises ikke til flåteeiere. Hvis Emergent-lagring senere konfigureres, må også den lagringen inngå i backupplanen.

**Aktiv backup er ikke bekreftet.** Repoet har en manuell Mongo-kopieringsskript, men ingen konfigurert backupjobb. Databaseleverandør og abonnement er heller ikke bekreftet; ikke anta at databasen er Atlas eller at backup følger med.

Før betaen utvides: kontroller leverandørens backup, aktiver daglige automatiske snapshots og avtalt oppbevaring, og test gjenoppretting i en separat database. Ta med hele databasen: dokumentinnhold, metadata, søknader, brukere, flåter, dokumentstatus, invitasjoner, e-postkø, tur-/betalingsposter og revisjonslogg. Kontroller etter restore at dokumentkoblinger og tilgang fungerer. Gjenta restoretesten etter lagringsendringer og regelmessig i drift. Kopiering alene er ikke en testet gjenopprettingsplan.

Google Drive er ikke koblet til. Det kan senere brukes til et begrenset sekundærarkiv, men erstatter ikke databasebackup. Ikke legg dokumenter i offentlige delte mapper eller send dem som vedlegg i adminvarsler.

Kilder: [MongoDB backup og restoretest](https://www.mongodb.com/docs/manual/tutorial/backup-and-restore-tools/), [Atlas backup og begrensninger](https://www.mongodb.com/docs/atlas/backup-restore-cluster/).

## Daglig kontroll og videre automatisering

- Kontroller `/api/health` for API/database og `/api/ready` for manglende konfigurasjon. Frisk health alene betyr ikke lanseringsklar tjeneste.
- Se på ubehandlede søknader, manglende/utløpte dokumenter, mislykkede e-poster, Stripe-onboarding og hendelser i Admin. Dokumentstatus skal gjenspeile kontrollen som faktisk er gjort.
- Etter deploy: verifiser versjon, API, innlogging og berørte flyter. Test betalt tur og appoppførsel med riktig mobilversjon i kontrollert miljø; ikke bruk fabrikkert GPS eller manuelle betalingsmarkeringer.
- Overvåking og varsler trenger en valgt mottaker og kanal. Det er ikke konfigurert eller sendt nye eksterne driftsvarsler i denne endringen. Koble senere varsler for API-feil, e-postfeil og backupfeil til den avtalte kanalen.

Venteprisen har to gratis minutter som standard og et konfigurerbart tak på 15 fakturerbare minutter. Satsen kan settes per bilkategori i Admin. Nye ventetillegg og tilhørende kortreservasjon krever den oppdaterte mobilversjonen med kundens uttrykkelige aksept. Eldre bookinger uten aksept får ikke det nye ventetillegget. Backend-/webdeploy alene aktiverer ikke denne aksepten i en gammel installert app.
