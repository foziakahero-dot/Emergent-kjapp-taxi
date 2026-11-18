# SNAR – verifisert status 18. november 2026

Beslutning: NO-GO for Oslo-beta. Eksisterende QA er undersøkt; ingen ny prototype, databasemigrering eller produksjonspromotering er utført.

## 1. Faktisk arkitektur og versjoner

| Kilde | Verifisert verdi |
| --- | --- |
| Repository | foziakahero-dot/Emergent-kjapp-taxi |
| Backend QA / Render live | afd2bfaf5a5afe6f706a4ed3488a19fdc759cf6a |
| Render live deploy | dep-dblu4lt9fdbs73b756fg |
| Render service | srv-db61otlckfvc73bqp480, autoDeploy=no |
| Mobil QA | 9e5aef948a2cba928d827267d1de7f0a6d5b8791 |
| Nyeste ferdige mobilbygg | 78a263c57d5c2e40af9f68b4b3271f4cb4a026c3, 17. november |
| Database i faktisk QA | MongoDB Atlas, prosjekt SNAR Phase 5 QA, snar-qa / snar_qa |
| Faktiske paneler i QA | admin-web og fleet-web, begge på afd2bfaf |

Bruker har senere oppgitt et PostgreSQL/Budibase-oppsett med eget SQL-skjema. Det er ikke verifisert som erstatning for ovennevnte runtime. Ingen migrering eller overskriving er foretatt. Det nye oppsettet skal identifiseres før videre databasearbeid.

## 2. Ferdig og verifisert i denne økten

1. GitHub, Render service/deploy og avgrensede Atlas-lesinger er kontrollert mot siste statuslogg, versjon 53.
2. QA health/ready er HTTP 200, QA-isolering er bekreftet av runtime, `auto_charge_enabled=false` og betalingskonfigurasjon `test_mode=true`.
3. Mobilens 117 Node-/komponentregresjoner og seks Driver-regresjoner består. TypeScript og låst offline Expo-avhengighetskontroll består i begge apper. Offline kontroll er ikke en fersk online Expo Doctor-vurdering.
4. Admin/Fleet bygger; ni Fleet-unit-tester og proxy-/binærdokumentkontrollen består.
5. Sikkerhetsrettelse og testreparasjon er levert i PR151 og merget til PR145s feature-gren. 107 fokuserte backendtester består. Dette er lokal syntetisk kodeverifikasjon, ikke Stripe-providerbevis.

## 3. Implementert, ikke deployet

| Arbeid | Tilstand |
| --- | --- |
| PR149 innstillinger/personvern/språk/støtte | Merget til mobilgren; mangler i gårsdagens fire APK/iOS-bygg |
| PR150 Admin/Fleet tilstander | Fortsatt åpen; ny CI-sjekk lagt til på f989d9cd6a19c5eaccc36f142b2ce55921c5eb68 |
| PR145 serviceavgift/kampanje | Fortsatt åpen; økonomiske blokkeringer består |
| Nye Maestro-flyter | Booking, tema, personvern/språk, tomt søk og nettbrudd skrevet; ikke kjørt native |
| Ny QA-runner/k6/visuell sammenligning | Skrevet, sikkerhetsregresjoner/syntaks kontrollert; ingen lasttest eller godkjent visuell baseline |

## 4. Feil og blokkeringer

1. PR145s finansielle probe gir fem FAIL: flåteoverride med ekte ObjectId, kjøretøyoverride med ObjectId, historisk 0 %-snapshot, gebyrendring etter worker-restart og rabattert reservasjon som ikke kan starte dispatch. Plattformdefault 12 % består.
2. De seks opprinnelige Founding 500-feilene er gjenskapt og rettet i testadapter/-forventning/-mock. Nye HTTP-sikkerhetsregresjoner viser at opprinnelige interne kampanjeendepunkter var offentlig muterbare; rutene er fjernet på feature-grenen. De ni regresjonene feilet før og består etter rettelsen.
3. Kampanjens 500-grense, telefonunikhet, engangsinnløsning, reservasjonsbudsjett og Growth Fund må bevises atomisk under samtidighet. Statisk gjennomgang avdekker read-then-write-mønstre og manglende kobling mellom rabatt og reservasjon. Disse kontrollene er ikke godkjent.
4. GitHub Actions-kjøring 44375318630 stoppet før oppstart: kontoen er låst på grunn av fakturering. Vercel har separate account-deployment-blocked-feil. Offentlige snarapp.no/admin/fleet-domener returnerer HTTP 402; det er ikke en dokumentert DNS-feil.
5. Lokale browser-tester er BLOCKED: påkrevd Chrome mangler; tilgjengelig Chromium kan ikke opprette nødvendig socket; nedlastingen av Playwrights headless shell feilet. Ingen browser PASS påstås.
6. Native preflight 01a1f004-a489-755d-a0ef-e46cc98f6d93 er startet på 9e5aef9, men står i Expo Free Tier-kø. Sist observert køanslag omtrent 73 minutter, ikke en ferdig test.
7. Siste Customer/Driver iOS-innsendinger fra 17. november feilet på påkrevd/utløpt Apple-avtale. Det er ikke undersøkt gjennom en ny innsending om kontoeier siden har akseptert avtalen.
8. OTP og OTP-signup er avslått. Google Pay/Apple Pay er avslått i QA. Superadmin finnes, men Atlas viser `totp_enabled=false`; privat innlogging og 2FA-flyten er ikke funksjonelt godkjent.
9. Atlas: tre pending og én draft flåtesøknad; ingen approved. QA-evidens inneholder én typed-fixture-probe. Tur-/betalingsaggregater er ikke bevis på komplett onboarding eller avstemt 12/88-oppgjør.

## 5. Kilder

- [PR150](https://github.com/foziakahero-dot/Emergent-kjapp-taxi/pull/150), [PR145](https://github.com/foziakahero-dot/Emergent-kjapp-taxi/pull/145), [PR149](https://github.com/foziakahero-dot/Emergent-kjapp-taxi/pull/149), [PR151](https://github.com/foziakahero-dot/Emergent-kjapp-taxi/pull/151).
- `docs/qa/20261118/runtime-checks.json` og `financial-probe.json` inneholder faktiske, avgrensede observasjoner.
- [GitHub CI-blokkering](https://github.com/foziakahero-dot/Emergent-kjapp-taxi/actions/runs/44375318630).

## 6. Oppfølging – PostgreSQL/Budibase

Render-tilkoblingen er kontrollert på arbeidsområdenivå: ett tilgjengelig arbeidsområde (`tea-dassqnrbc2fs73a770i0`), ingen PostgreSQL-instanser. Dette avkrefter ikke at brukeren har en database i en annen konto eller hos en annen tilbyder; målhost og schema er fortsatt ikke identifisert. Ikke erstatt faktisk Mongo-QA med en ny database.

Etter brukerens eksplisitte innloggingstillatelse ble Google og konto valgt via sikker innlogging. Ved «Fortsett» stoppet nettleserens URL-policy overgangen. Et nytt forsøk ble avvist av automatisk sikkerhetskontroll som en alternativ nettleserflate rundt den samme sperren. Budibase-innlogging er **ukjent/ikke bekreftet**; ikke rapporter feil passord eller manglende konto.

Separat kandidat ligger under `integrations/budibase`: additiv PostgreSQL-migrering, audit/versjonering, begrensede SQL-handlinger, JWT-verifiserende REST-adapter og OpenAPI 3.0-queryimport. Dette er ingen deployet Budibase-app. To reelle feil i første lokale kandidat ble gjenskapt og rettet: NULL-versjon som omgår konfliktkontroll, og manglende versjonsøkning ved andre SQL-skrivere. Se kandidatens test- og blokkeringsrapport. Eksisterende app-/backendkilde er ikke endret.

## Siste oppfølging – gratis Community

Budibase-innlogging er nå bekreftet via brukerens direkte HTTPS-portaladresse. Ingen tenant vises. Første godkjente opprettelsesforsøk gikk til abonnementsvalg; et senere forsøk sa at domenet snarnexorahub allerede eksisterer. Opprettelse/reservasjon er uavklart; ingen betalt plan er aktivert. Bruker har valgt gratis Community. Docker/Podman finnes ikke i arbeidsmiljøet, og ingen eksisterende vert er tilkoblet. Oppstartspakke med persistent volum og loopback-binding er klargjort i integrations/budibase/selfhost, men er ikke startet. PostgreSQL-målet er fortsatt ikke identifisert.
