# Verifikasjon 18. november 2026

Denne kandidaten gjelder brukerens nye PostgreSQL/Budibase-skjema. Ingen migrering, rolleendring, deploy eller syntetisk testdata er kjørt på et eksternt SNAR-miljø.

| Kontroll | Resultat | Bevis og avgrensning |
| --- | --- | --- |
| Render-arbeidsområder | PASS | Ett tilgjengelig arbeidsområde returnert av tilkoblingen |
| Eksisterende Render PostgreSQL-mål | BLOCKED | `list_postgres_instances` returnerte `No Postgres instances found` i dette arbeidsområdet |
| Budibase metode-/kontovalg | PASS | Brukeren valgte Google og konto i sikker innlogging; ingen hemmeligheter lest eller lagret |
| Budibase innloggingsresultat | PASS | Senere bekreftet ved brukerens direkte HTTPS-portaladresse. Tenants- og Account-skjermene viste innlogget konto |
| Cloud tenant-aktivering | BLOCKED | Listen er tom også etter refresh; første Continue førte til abonnementsvalg, neste forsøk sa domenet allerede eksisterer. Opprettelses-/reservasjonsstatus er uavklart, ingen plan aktivert |
| Gratis Community-oppsett | PASS | Compose- og oppstartspakke klargjort, fire sikkerhets-/konfigurasjonskontroller består. Ingen lisens-/abonnementskjøp |
| Community-container oppstart | BLOCKED | Faktisk oppstartskommando returnerte exit 2: Docker finnes ikke på denne maskinen. Ingen container eller offentlig installasjon tilgjengelig |
| SQL første kandidat | FAIL | 17/19 bestod; NULL-versjon og vanlig SQL-endring kunne omgå stale-form-kontroll |
| SQL etter retting | PASS | 19/19, PGlite PostgreSQL i minnet; ingen Render-kobling |
| JWT/HTTP | PASS | 24 tester med ekte RSA-signaturer; repository simulert, ikke ekstern DB |
| OpenAPI 3.0 | PASS | Spec-validator og beskyttede operation-kontrakter; ingen import i Budibase påstått |
| Virkelig psycopg → Render | NOT RUN | Måldatabase/login ikke identifisert |
| Budibase builder og visuelle skjermer | NOT RUN | Innlogget arbeidsområde ikke tilgjengelig |
| To nettlesere / flere DB-workere | NOT RUN | Versjonsguard er testet sekvensielt, ikke en last-/samtidighetstest |
| Produksjons-/betalingsberedskap | BLOCKED | Denne integrasjonen verifiserer ikke SNARs tur-, betalings-, kampanje- eller oppgjørsflyt |

## Retting av lokale feil

1. Muteringene krever nå ikke-NULL versjon og handling; liste/paginering avviser eksplisitt NULL. Det er ikke tilstrekkelig med SQL-uttrykket `version <> p_version`, fordi NULL ellers gir ukjent betingelse.
2. BEFORE UPDATE-triggere øker versjonen for alle skrivere på drivers, vehicles og pricing_zones. Funksjonene øker ikke lenger versjonen separat. Gamle UI-verdier gir konflikt og ingen ekstra audit-rad.
3. Prisvalidering skiller typer fra tallkonvertering, avviser feil nøkler/null/negative/desimaler/overflow og sperrer lagring inntil krone/øre-enhet er bekreftet.
4. SQL-rollen har bare execute på de elleve offentlige gateway-handlingene. Direkte tabell-/identitetslesing og private helper-funksjoner avvises. Adminrollen avgjøres i databasen, og sjåførspørringene bruker `users.id`, slik brukerens FK-er krever.
5. REST-queryimporten ble validert og konvertert fra OpenAPI 3.1 til 3.0, inkludert nullable- og exclusiveMinimum-format. Det er en API-kontrakt, ikke en Budibase native app-eksport.

## Reprodusering

Node v24.22.3, Python 3.12.14, PGlite 0.5.16, FastAPI 0.115.6 og PyJWT 2.10.1. Kjør kommandoene i README. Automatisert workflow er lagt ved; GitHub CI er tidligere observert kontolåst på fakturering, så en fjernkjøring er ikke automatisk PASS fordi filen finnes.

## Hva som faktisk gjenstår

Brukeren valgte gratis Community etter at portalinnlogging ble bekreftet. Det kreves en eksisterende vert med Docker, et verifisert Budibase-arbeidsområde og eksisterende PostgreSQL-tilkobling i riktig konto/miljø. Individuell token-utstedelse/MFA, minsteprivilegert gateway-login, faktisk REST-import, skjermbygging, 30-sekunders polling og tester med admin og to ulike sjåfører må fullføres før godkjenning. Fullmakt er mottatt. Ingen betalt skyressurs opprettes for å omgå manglende vert eller ukjent PostgreSQL-mål. Totalt 48 lokale kontroller består: 19 SQL og 29 Python, inklusive fire nye self-hosting-kontroller. Docker-rendering, oppstart, readiness og innlogging i Community er ikke kjørt.
