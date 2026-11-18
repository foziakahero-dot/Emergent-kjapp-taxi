# SNAR – GO / NO-GO for Oslo-beta

**Beslutning 18. november 2026: NO-GO for produksjon og lukket reell Oslo-beta. GO for videre isolert QA og syntetisk testarbeid.**

## 1. Hva som hindrer beta

1. Fem reproduserte økonomiske feil i PR145. 12 % som standard er ikke tilstrekkelig når overrides, historiske avtaler, persistens og rabattert reservasjon feiler.
2. Founding 500s telefonunikhet, 500-grense, engangsinnløsning, reservert budsjett og Growth Fund mangler samtidighetsbevis. Kritiske read-then-write-mønstre består.
3. Hele Fleet/Admin/Driver/Customer/Stripe TEST-kjeden er ikke utført med korrelert kvittering og avstemt oppgjør.
4. PR150 er ikke QA-merget/deployet; browser-verifikasjon er blokkert av lokalt nettlesermiljø og GitHub-fakturering. Offentlige paneldomener er utilgjengelige med HTTP 402.
5. Siste mobilbygg mangler PR149. Ny native preflight står i kø. TestFlight-innsendinger har Apple-avtaleblokkering.
6. Administrativ 2FA er ikke innrullert på observert QA-superadmin. OTP og wallets er avslått; fysisk funksjon og supportleveranse er ikke godkjent.
7. Brukerens nye PostgreSQL/Budibase-grunnlag må identifiseres som separat ressurs eller dokumentert migreringsspor før noen endring av faktisk Mongo-QA.

## 2. Utført arbeid som er trygt å bygge videre på

1. Verifisert faktisk GitHub-/Render-/Atlas-tilstand og de fire byggene fra 17. november.
2. PR150 har fått automatisk, isolert testgate. Kontoens blokkering holdes adskilt fra kodefeil.
3. PR151 lukker offentlig kampanjemutasjon og reparerer testoppsettet; merget til betalings-featuregrenen med 107 lokale tester bestått. PR145 er fortsatt holdt utenfor QA.
4. Kjørbare Maestro-scenarioer, SHA-/APK-voktet QA-runner, CI-oppsett, k6-lasttest og bildebaseline-verktøy er skrevet. De er ikke omklassifisert til bestått native E2E.

## 3. Krav for et senere GO

1. Alle P0 i releaseplanen lukket med reproduserbare bevis; ingen automatisk ignorering av feil.
2. Full tur, avvisning, kansellering, nettfeil, sesjoner, flåteisolasjonsfeil og økonomiske gjenleveringer består på den konkrete kandidaten.
3. Nyeste Android/iOS-bygg med verifisert API, kilde, versjon og signering er testet på enhet. App Store/TestFlight-status dokumenteres separat fra kompilering.
4. Overvåking, support, datahåndtering, sikkerhetskopi og rollback er testet. Oslo/Akershus og kampanjebudsjett håndheves på server.
5. Første pilot har 10–20 navngitte inviterte testere og ansvarlige sjåfører. Live-betaling, masseinvitasjoner, offentlig distribusjon og produksjonspromotering krever fortsatt brukerens uttrykkelige godkjenning.

Ingen slik overgang er utført. Det er ikke nødvendig å be om produksjonsgodkjenning mens kandidaten fortsatt er NO-GO.

Oppfølging PostgreSQL/Budibase: 44 lokale kontraktkontroller består i en separat kandidat. Ingen verifisert Render PostgreSQL-instans eller innlogget Budibase-builder er tilgjengelig i denne økten. Ingen ny admin-app er deployet, og testene endrer ikke NO-GO-beslutningen for SNAR-beta.
