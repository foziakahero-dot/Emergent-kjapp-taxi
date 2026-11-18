# SNAR – releaseplan for Oslo-beta

## 1. Prioritert arbeid

| Prioritet | Arbeid | Ferdig når |
| --- | --- | --- |
| P0 | Avklar faktiske PostgreSQL/Budibase-ressurser mot eksisterende Mongo-QA | Miljø, tjenester og eierskap dokumentert; ingen uautorisert migrering |
| P0 | PR145 økonomi | ObjectId/scoping, uforanderlige tursnapshots, varig konfigurasjon og rabatt/capture/oppgjør avstemmes |
| P0 | Founding 500 | Samtidighetstest beviser maks 500 unike verifiserte telefoner, én innløsning og atomisk reservert/forbrukt budsjett |
| P0 | Admin/Fleet | PR150 browser-scenarier består; QA-routing og privat tilgang fungerer; deretter normal QA-merge |
| P0 | Tilgang og sjåføraktivering | Superadmin 2FA, godkjent flåte, invitasjon, dokumenter og kjøretøybinding fungerer med syntetiske data |
| P0 | Full tur og betaling | Én korrelert gjennomføring fra onboarding til kvittering og avstemt Admin/Fleet; Stripe TEST og kontant |
| P1 | Mobil leveranse | Native preflight består og nye QA-bygg inkluderer PR149; fysisk test dokumenterer riktig installert build |
| P1 | Wallet/OTP/støtte | Konfigurasjon og faktiske tester; menneskelig støttefallback og riktig SMS-/e-postisolering |
| P1 | Ytelse og UX | Små/større skjermer, tekstskalering, nettverksfeil og kontrollert last har målt resultat |
| P1 | Pilot | Drift, overvåking, support, rollback og 10–20 uttrykkelig inviterte testere er klare |

## 2. Utføringsrekkefølge

1. Bevar grener og eksakte kildeversjoner. Rebaser ikke automatisk over Claudes arbeid. PR144 er en åpen draft mot en annen preflight-gren, ikke en godkjent backend-integrasjon.
2. Fullfør finansielle regresjoner fra `probe_payment_candidate.py`. Bruk kjøretøy > flåte > plattform for nye avtaler og bevar autoritative historiske snapshots ved oppgjør. Definer varig, revidert konfigurasjon uten prosesslokal `os.environ` som eneste lagring.
3. Definer rabattmodellen entydig: brutto turpris, kundebelastning, normal transportørandel, SNAR-subsidie og faktiske Stripe-overføringer. Reservasjon, start, capture, webhook og kvittering må bruke samme beløpskontrakt. Ikke aktiver kampanjen mens dette er uavklart.
4. Håndter gjenlevering, sen webhook, tapt respons, kansellering, avvist kort og manglende flåtebetaling med idempotens og avstemming. Test telefonduplikater og samtidige kunder/turer.
5. Løs GitHub/Vercel-kontoblokkering uten å endre sikkerhetskontroller. Kjør PR150s isolerte browser-scenarier. Først deretter vurder QA-merge og deploy av nøyaktig kilde.
6. Klargjør navngitte syntetiske fixture-kontoer og de nødvendige driver-/dokumentrelasjonene. Ikke bruk ekte identitetsdokumenter eller kundeopplysninger. Ikke løs 2FA ved å slå den av.
7. Bruk eksisterende Maestro og de nye flow-filene. Test deling og henteinstruks med faktisk aktiv tur; ikke trykk «send» til ekte mottakere. Full onboarding-/Driver-/betalingskjede mangler fortsatt en ferdig samordnet flerenhetsflyt.
8. Kjør native preflight, bygg Android `qa` og iOS `testflight-qa`, registrer artifact/kilde og test på telefon. iOS simulator-test trenger egen simulator-artifact. Ikke send på nytt til TestFlight før Apple-avtalen er avklart av kontoeier.
9. Mål feil, tilgjengelige biler, dispatch og betaling i liten lukket pilot. Produksjonsdatabase, secrets, domener, webhookmodus, backup og rollback kontrolleres separat før en produksjonskandidat godkjennes.

## 3. Beta-sjekkliste

1. Ingen åpne P0; hele turkjeden og alle betalinger har reproduserbare testbevis.
2. Innlogging, utløpte sesjoner, serverbasert rolle- og flåteisolasjonskontroll, dokumentvern og administrativ 2FA er godkjent.
3. Oslo/Akershus håndheves på server; feil GPS og utdatert posisjon kan ikke åpne feil tjenesteområde.
4. Crash-rapportering er faktisk installert og testet med release-SHA, miljø og sourcemaps. Ingen produksjonsklar crash-/analytics-integrasjon er verifisert i denne kontrollen.
5. Analytics måler onboarding, søk, quote, bekreftet booking, aksept, kansellering og betaling med korrelasjons-ID. Ikke logg tokens, kortdata, full adresse eller privat meldingstekst. Fastsett nødvendig informasjons-/samtykkeflyt før aktivering.
6. Kundestøtte/feedback er synlig i appen, lager en bekreftet sak og blir lest av en ansvarlig. AI-503 har fungerende fallback.
7. Onboarding forklarer plassering, varsler, betalingsmåte og testbegrensninger; ingen tillatelse er et gyldig testscenario.
8. Minst Android/iOS, eldre telefon, liten skjerm, største relevante tekst, lyst/mørkt tema og norsk bokmål er testet. Delvis engelsk støtte presenteres som delvis.
9. Overvåking, alarmmottaker, kvitteringslevering, backupgjenoppretting og prøvd rollback er dokumentert.
10. En kandidat har én release-manifest med SHA-er, deploy, build-ID-er, betalingsmodus og rollbackmål. Lukket pilot og produksjon har separate, uttrykkelige godkjenninger.

## 4. Automatiseringspakke

Se `qa/mobile-beta/README.md` for kjørekommandoer, verktøysammenligning, språk/tilgjengelighet, CI, feilinjektering og last. Portrettlåsen er tilsiktet; 217 kr er eksempeldata og skal ikke hardkodes som produksjonspris.

## 5. Separat PostgreSQL/Budibase-spor

Brukerens nye skjema er implementert som isolert, testet SQL-/REST-kandidat under `integrations/budibase`; 44 lokale kontroller består. Dette erstatter ikke eksisterende Mongo-QA og løser ikke betaens P0-er. Tilkoblet Render-konto har ingen PostgreSQL-instanser. Budibase-innlogging ble stoppet av nettleserens sikkerhetspolicy etter brukerens metode-/kontovalg; automatisk kontroll avviste nytt forsøk. Fullmakt mangler ikke. Identifiser eksisterende database og et støttet innlogget Budibase-arbeidsområde før migrering/tilkobling. Skjermbygging, individuell IdP/MFA, faktisk DB-transport og to-sjåførtest er fortsatt blokkert/ikke kjørt. Ikke opprett en ny erstatningsdatabase eller svekk innlogging for å omgå disse punktene.

## Siste oppfølging – gratis Community

Brukeren har valgt gratis Community, uten nye betalte ressurser. Portalinnlogging er bekreftet; Cloud-tenantstatus er uavklart (tom liste, domene allerede i bruk). Neste avhengighet er eksisterende vert med Docker/Linux-containere og persistent disk, deretter identifisert PostgreSQL og individuell innlogging. Pakken er klar i integrations/budibase/selfhost. Ingen vert, database eller abonnement er opprettet.
