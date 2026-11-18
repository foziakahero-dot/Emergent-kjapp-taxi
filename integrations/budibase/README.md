# SNAR – isolert PostgreSQL/Budibase-integrasjon

## Faktisk status

Implementert og lokalt testet SQL og REST-adapter. **Ingen Budibase-app eller Render-database er opprettet, koblet til eller deployet.** SNARs verifiserte QA kjører fortsatt FastAPI/MongoDB og eksisterende Admin/Fleet-paneler.

18. november 2026 viste Render-tilkoblingen ett arbeidsområde og ingen PostgreSQL-instanser. Budibase-innlogging er senere bekreftet gjennom brukerens oppgitte HTTPS-adresse `/portal/tenants`. Tidligere URL-policy-blokkeringer er historiske; ikke oppgi innlogging som siste blocker. Kontolisten viste ingen tenants. Etter brukerens godkjenning førte `Continue` for `snarnexorahub` til abonnementssiden. Ved ny kontroll var listen fortsatt tom, og et nytt forsøk meldte at domenet allerede eksisterer. Om domenet er reservert eller tenant er opprettet uten å være synlig/aktivert, er uavklart. Ingen plan er kjøpt eller aktivert.

Bruker har nå valgt **gratis Community / self-hosted**. Oppstartspakken ligger i `selfhost/README.md`. Ingen Docker-/Podman-motor er tilgjengelig her, og ingen eksisterende vert er tilkoblet. Pakken er derfor klargjort og sikkerhetskontrollert, men ikke startet. Nyeste lokale verifikasjon er 19 SQL-tester pluss 29 Python-kontroller; ingen full installasjon eller UI-flyt er påstått bestått.

Følgende må identifiseres før tilkobling: faktisk Budibase-arbeidsområde, eksisterende PostgreSQL-host/database og miljø, og støttet individuell innlogging. Ikke opprett en ny betalt database som erstatning for en ukjent eksisterende database.

## Filer og korrekt kjørerekkefølge

| Fil | Bruk |
| --- | --- |
| `sql/00_inspect.sql` | Skrivebeskyttet kontroll av reelt mål og tabeller |
| `sql/01_migration.sql` | Additive kolonner, versjonering, identitetskobling, audit og handlinger |
| `sql/02_permissions.sql` | Avgrenset NOLOGIN-rolle; ingen passord eller base-tabelltilgang |
| `gateway.py` | Separat FastAPI-adapter som verifiserer signert identitet før SQL |
| `budibase-rest.openapi.json` | Import av REST-spørringer; **ikke** en ferdig Budibase-app-eksport |
| `tests/base_schema.sql` | Brukerens originale SQL, kun som isolert test-fixture |
| `tests/database.test.mjs` | Reell PostgreSQL-motor i minnet via PGlite |
| `tests/test_gateway.py` | JWT-/HTTP-regresjoner med simulert repository |

1. Kontroller mål og sikkerhetskopi. Kjør `00_inspect.sql` på den identifiserte PostgreSQL-databasen. Sammenlign FK-er, enum-verdier, kolonner og eksisterende grants. Denne pakken oppretter ikke grunnskjemaet utenfor testen.
2. Test migrering på en isolert kopi først. `01_migration.sql` og deretter `02_permissions.sql` kjøres av schema-eier; begge har transaksjon. Migreringen sletter ingen tabeller eller rader. Den installerer versjoneringstriggere på tre tabeller; kontroller påvirkning på andre skrivere før virkelig bruk.
3. Koble en eksisterende, verifisert IdP-identitet til `users.id` i `snar_admin.identities` som schema-eier. `issuer` og `subject` kommer fra den faktiske, verifiserte IdP-en. SQL-eksempel med bind-parametre, aldri rå frontendverdier:

   ```sql
   INSERT INTO snar_admin.identities(issuer,subject,user_id)
   VALUES ($1,$2,$3);
   ```

4. Bruk en separat PostgreSQL-login med medlemskap i `snar_bb_gateway`, uten eierskap, base-tabellgrants eller adminrettigheter. Opprettelse av login og overføring av hemmeligheter skjer i sikker driftskonfigurasjon. Ikke legg denne login-en inn som en delt Budibase SQL-kilde: den kan sette identitetskontekst og er kun for JWT-adapteren.
5. Bekreft prisens lagringsenhet mot den reelle bookingberegningen. Ingen priser er lagt inn eller endret. Prislagring er sperret inntil schema-eier setter `snar_admin.config.price_unit` til korrekt `NOK` eller `NOK_ORE` og `confirmed_at` til nå. Ikke gjett enheten eller endre eksisterende verdier ved konvertering.
6. Konfigurer gatewayens miljøvariabler nedenfor. Bruk Render intern URL når tjeneste/database ligger i samme region og arbeidsområde. Ved ekstern tilkobling må TLS sertifikatverifiseres (`sslmode=verify-full`, korrekt CA ved behov). Intern URL betyr ikke at en fremmed database er riktig mål.
7. Start gatewayen på et isolert QA-mål. Importer OpenAPI-filen til en Budibase REST-tilkobling, sett den **verifiserte** gatewayadressen, og koble individuell kortlivet bearer-token. Test funksjonene før eventuell publisering.

## Miljøvariabler og oppstart

| Navn | Verdi som må komme fra faktisk miljø |
| --- | --- |
| `SNAR_ADMIN_DATABASE_URL` | Tilkobling for separat, avgrenset gateway-login |
| `SNAR_ADMIN_JWT_ISSUER` | Eksakt HTTPS issuer fra individuell IdP |
| `SNAR_ADMIN_JWT_AUDIENCE` | Egen audience for denne adapteren |
| `SNAR_ADMIN_JWT_PUBLIC_KEY_FILE` | Montert fil med RSA-public-key, minst 2048 bits |
| `SNAR_ADMIN_CORS_ORIGINS` | Valgfri kommaseparert liste av eksakte HTTPS-origins, aldri `*` |

```bash
cd integrations/budibase
python -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/uvicorn gateway:app_factory --factory --host 0.0.0.0 --port 8000 --no-access-log
```

Gatewayen verifiserer RS256, `iss`, `aud`, `sub`, `iat` og `exp`, og avviser token med levetid over 30 minutter. Rollesjekk skjer mot databasen på hver handling. `admin_id`, `user_id` eller tokenets `role` gir aldri adminrettigheter. Ingen innlogging, session-utsteder, passordlagring eller MFA-flyt er implementert i adapteren. En reell IdP og MFA for administratorer må integreres og testes. Et generisk Budibase-token eller Google-token med feil audience kan ikke brukes som erstatning.

Gatewayen sjekker login-rettigheter ved oppstart, bruker faste parameteriserte SQL-uttrykk og setter identitet transaksjonslokalt. Data og audit committes sammen. Ingen åpne muteringsendepunkter. Direkte SQL-/API-tilgang må fortsatt beskyttes med nettverk, TLS og ratebegrensning ved utrulling.

## Budibase-skjermer og handlinger

Dette er bindingskontrakten for builderen. Den er ikke påstått importert eller fysisk testet.

| Side | Query / data | Kolonner og handlinger |
| --- | --- | --- |
| Oversikt | `dashboard` | Avventer sjåfører/biler, aktive turer, separate forespørsler, `as_of` |
| Sjåførgodkjenning | `drivers`, `rows`, `total` | `id` (søknad), `user_id`, navn, telefon, førerkort, taxiløyve, utløpsdatoer, status, `version`. Nyeste først. Filter `all/pending/approved/rejected/suspended`, søk og paginering |
| Kjøretøygodkjenning | `vehicles`, `rows`, `total` | Eier/sjåførnavn, `driver_id` (users.id), skilt, modell, forsikring, status, `version` |
| Priser | `prices`, `rows`, `price_unit` | Fire bilklasser. Alle sju pris-/aktiv-felter og `version` sendes samlet til `save_price`. Ingen lagring når enhet er ubekreftet |
| Aktive turer | `active_rides`, `rows` | Passasjer, sjåfør, hentested, destinasjon, estimert/sluttpris og status. Kun accepted/arrived/in_progress; requested vises separat. Maks 500; ikke påstå komplett oversikt over mer enn 500 |
| Mine kjøretøy | `my_vehicles`, `rows` | Ingen input for annen sjåfør. Backend henter fra signert identitet |
| Mine turer | `my_rides`, `rows`, `total` | Ingen input for annen sjåfør. Paginering |

1. Begrens admin-sidene med egen Budibase Admin-rolle. Skjul navigasjon for øvrige, og kall `/me` før sideinnhold lastes. Backendens `users.role` avgjør alltid den faktiske tilgangen.
2. Godkjenn sjåfør: `POST /admin/drivers/{driver_id}/status` med `{"version": <radens versjon>, "action": "approved"}`. ID er `drivers.id`, ikke `user_id`.
3. Avvis/suspender: samme endepunkt, action `rejected`/`suspended`, og `reason` fra dialogen. Minst tre tegn. Suspensjon krever godkjent sjåfør. Deaktiver knapp mens forespørsel pågår; oppdater query etter suksess.
4. Godkjenn/avvis bil: `POST /admin/vehicles/{vehicle_id}/status`, samme body og versjonskrav. Godkjenning krever godkjent tilknyttet sjåfør, gyldige dokumenter og forsikring. Avvisning krever begrunnelse.
5. Prisredigering: `PUT /admin/prices/{vehicle_class}` med `{ "version": <radens versjon>, "values": { "base_fare": ..., "per_km": ..., "per_minute": ..., "minimum_fare": ..., "night_surcharge": ..., "rush_hour_surcharge": ..., "is_active": true } }`. Lagre full rad ved bekreftet celle-/radendring, ikke hvert tastetrykk. Prisfeltene er ikke-negative heltall. Minstepris må være minst grunnpris.
6. Aktive turer: last på sideåpning og hvert 30. sekund **mens siden er aktiv**. Avslutt timer ved sidebytte. Ikke start overlappende requests. Vis sist vellykkede `as_of`; ved feil vis «Kan ikke oppdatere aktive turer akkurat nå» og Prøv igjen. Ikke erstatt feil med en tom liste eller «System online».
7. Håndter HTTP 401 med ny innlogging, 403 med Tilgang nektet, 409 med «Data er endret. Oppdater visningen», 422 som valideringsfeil og 503 med tydelig feiltilstand/retry. Tomt resultat vises først etter vellykket query. Bevar siste data med markering om at de ikke er oppdatert.

## Tester og praktiske begrensninger

```bash
npm ci
npm test
.venv/bin/python -m pytest -q tests/test_gateway.py tests/test_openapi.py tests/test_selfhost.py
.venv/bin/python export_openapi.py
.venv/bin/python -c 'import json; from openapi_spec_validator import validate; validate(json.load(open("budibase-rest.openapi.json"))); print("OpenAPI PASS")'
```

Testene bruker syntetiske kontoer med `.invalid`-domener. PGlite er ekte PostgreSQL i én prosess/forbindelse, ikke Render eller test av flere samtidige workere. Gateway-testene verifiserer ekte RSA-signaturer, men simulerer repository; psycopg-tilkoblingen til et reelt miljø er ikke testet. Ingen Budibase-builder, personlig MFA, ekte browser-flyt, 30-sekunders polling eller mobilbetalingsflyt er godkjent av disse testene.

Grunnskjemaet har ingen flåtetabell eller flåtemedlemskap, dokumentfiler, betalinger, kvitteringer, oppgjør eller sanntidsposisjoner. Ikke kall dette et fullstendig Fleet-panel, betalingssystem eller live-kart. Driver-eierskap er støttet; full flåteavgrensning må bygge på verifisert medlemskapsmodell. Ingen slike tabeller eller flyter er oppfunnet i produksjon.

## Kilder for oppsettet

- Budibase PostgreSQL: https://docs.budibase.com/docs/postgresql
- Budibase REST query import: https://docs.budibase.com/docs/rest-query-import
- PostgreSQL funksjonssikkerhet: https://www.postgresql.org/docs/current/sql-createfunction.html
- PGlite: https://pglite.dev/docs/
