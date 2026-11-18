# SNAR – bygg Admin og sjåførtilgang i Work Mode

Du er min senior fullstackutvikler, PostgreSQL-utvikler, Budibase-utvikler og QA-ansvarlig. Utfør arbeidet med tilgjengelige tilkoblinger og verktøy. Lever fungerende, testet arbeid og komplette filer. Ikke stopp ved en plan. Ikke still oppfølgingsspørsmål om rutinevalg; bruk fornuftige, dokumenterte valg. Dersom nødvendig tilgang mangler, dokumenter nøyaktig blokkering og ferdigstill alt som kan gjøres uten den.

## 1. Oppdrag og eksisterende arbeid

Bygg SNARs norske administrasjonspanel i Budibase mot mitt oppgitte PostgreSQL-skjema på Render. Første mål er en fungerende QA-versjon med sjåførgodkjenning, kjøretøygodkjenning, prisadministrasjon og aktive turer. Prioriter at kjernen er brukbar innen omtrent 15 minutter når tilkoblinger allerede fungerer. Fortsett nødvendig sikkerhet og testing før du erklærer løsningen produksjonsklar.

Prosjektet er eksisterende. Undersøk siste arbeid fra Claude/Astro og GitHub før endringer. Repository: `foziakahero-dot/Emergent-kjapp-taxi`.

Tidligere faktisk verifisert SNAR-QA brukte FastAPI, MongoDB Atlas, `admin-web` og `fleet-web`. Mitt PostgreSQL/Budibase-oppsett kan være et separat oppsett eller et nytt integrasjonsspor. Bekreft aktuell Render-database, databasenavn, tabeller og Budibase-app før du skriver. Ikke erstatt den eksisterende databasen, backendens API-kontrakter eller panelene på grunnlag av en antakelse. Bruk en isolert gren og et separat QA-oppsett ved behov.

Lag faktisk Budibase-app gjennom støttet API, tilkobling eller nettleser dersom tilgangen finnes. Bruk eksisterende innlogging når tilgjengelig. Ikke gjett credentials eller vis secrets. Hvis Budibase ikke kan betjenes her, lever et importoppsett i et faktisk støttet format eller en nøyaktig klikk-for-klikk-oppskrift, sammen med alle ferdige SQL-spørringer og bindinger. Ikke finn på at appen er opprettet eller publisert.

## 2. Databaseskjema – referanse, ikke instruks om å gjenskape eksisterende tabeller

Dette er mitt oppgitte grunnskjema. Inspiser faktisk database først. Hvis objektene finnes, skal du ikke kjøre CREATE på nytt eller slette data. Lag bare nødvendige, additive og idempotente migreringer etter kontroll av eksisterende definisjoner.

```sql
CREATE TYPE user_role AS ENUM ('PASSENGER', 'DRIVER', 'ADMIN');
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected', 'suspended');
CREATE TYPE ride_status AS ENUM ('requested', 'accepted', 'arrived', 'in_progress', 'completed', 'cancelled');
CREATE TYPE vehicle_class AS ENUM ('SNAR', 'PREMIUM', 'SUV', 'XL');

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'PASSENGER',
  created_at TIMESTAMP DEFAULT NOW(),
  is_blocked BOOLEAN DEFAULT false
);

CREATE TABLE drivers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  license_number VARCHAR(50) NOT NULL,
  license_expiry DATE NOT NULL,
  taxi_license_number VARCHAR(50) NOT NULL,
  taxi_license_expiry DATE NOT NULL,
  profile_image_url TEXT,
  status approval_status NOT NULL DEFAULT 'pending',
  reject_reason TEXT,
  approved_at TIMESTAMP,
  approved_by_admin_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE vehicles (
  id SERIAL PRIMARY KEY,
  driver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  license_plate VARCHAR(10) UNIQUE NOT NULL,
  model VARCHAR(100) NOT NULL,
  year SMALLINT NOT NULL,
  vehicle_class vehicle_class NOT NULL DEFAULT 'SNAR',
  insurance_expiry DATE NOT NULL,
  status approval_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE pricing_zones (
  id SERIAL PRIMARY KEY,
  vehicle_class vehicle_class UNIQUE NOT NULL,
  base_fare INTEGER NOT NULL,
  per_km INTEGER NOT NULL,
  per_minute INTEGER NOT NULL,
  minimum_fare INTEGER NOT NULL,
  night_surcharge INTEGER DEFAULT 0,
  rush_hour_surcharge INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE rides (
  id SERIAL PRIMARY KEY,
  passenger_id INTEGER REFERENCES users(id),
  driver_id INTEGER REFERENCES users(id),
  pickup_address TEXT NOT NULL,
  pickup_lat DOUBLE PRECISION,
  pickup_lng DOUBLE PRECISION,
  dropoff_address TEXT NOT NULL,
  dropoff_lat DOUBLE PRECISION,
  dropoff_lng DOUBLE PRECISION,
  estimated_distance_km INTEGER,
  estimated_duration_min INTEGER,
  estimated_price INTEGER,
  final_price INTEGER,
  status ride_status NOT NULL DEFAULT 'requested',
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_drivers_status ON drivers(status);
CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_rides_status ON rides(status);
```

Viktige kontrakter:

- `drivers.id` er en søknads-/sjåførpost. `drivers.user_id`, `vehicles.driver_id` og `rides.driver_id` peker til `users.id`. Ikke bland disse ID-ene.
- Bekreft kroner/øre og betydningen av tillegg i eksisterende pris-/API-kontrakt før prisvisning og skriving. Ikke konverter eksisterende beløp automatisk eller finn på priser.
- Bekreft tidssone for eksisterende TIMESTAMP-data. Vis tidspunkter i Europe/Oslo uten å dobbelkonvertere lagrede data.
- Grunnskjemaet har ikke fleet-eierskap, GPS-strøm, betalingsstatus eller innloggingshemmeligheter. Ikke presenter disse som implementert. Gjenbruk en verifisert eksisterende modell eller lag en separat, gjennomgått utvidelse hvis det trengs. Sjåførsiden er ikke automatisk en komplett løyvehaverportal.

## 3. Sider og handlinger

### A. Oversikt

Vis ventende sjåførsøknader, ventende kjøretøy og antall aktive turer. Hvert kort skal skille mellom laster, bekreftet null, datafeil og utdatert informasjon. Vis siste vellykkede oppdatering. Ikke bruk en statisk «System online».

### B. Sjåførgodkjenning

- Tabell, nyeste først: navn, telefon, førerkortnummer/utløp, oppgitt løyve-/kjøreseddelnummer/utløp, søknadsdato og status. Avklar dokumenttypen gjennom eksisterende kontrakt; ikke omdøp et felt til dokumentasjon det ikke inneholder.
- Filtrer pending/approved/rejected/suspended og søk etter navn eller telefon. Bruk paginering.
- Godkjenn, avvis med obligatorisk begrunnelse og suspender med begrunnelse.
- Valider at tilknyttet bruker er DRIVER, ikke blokkert og har gyldige påkrevde dokumentdatoer før godkjenning. Ikke erklær et dokument ekte bare fordi en dato er fylt ut.
- Lagre godkjenner, tidspunkt og revisjonsspor. Beskytt mot dobbeltklikk og samtidige saksbehandlere.
- Oppdater tabellen etter serverbekreftelse. Ved feil beholdes valget og en forståelig feilmelding med retry vises.

### C. Kjøretøygodkjenning

- Vis pending kjøretøy med tilknyttet sjåfør, reg.nr., modell, årsmodell, klasse, forsikringsutløp og status.
- Godkjenn/avvis; avvisning krever begrunnelse. Utvid skjemaet additivt hvis årsak/revisjon mangler.
- Godkjenning krever gyldig forsikring og korrekt, godkjent og ublokkert sjåførtilknytning.
- Slett aldri historiske turer som del av en godkjenning eller avvisning.

### D. Prisadministrasjon

- Vis SNAR, PREMIUM, SUV og XL, med eksisterende verdier. Ingen oppdiktede satser.
- Grunnpris, per km, per minutt, minstepris og tillegg skal kunne redigeres.
- Lagre en celle/rad straks redigeringen bekreftes; ikke for hvert tastetrykk. Vis «lagrer» og vis ny pris som bekreftet først etter vellykket databaseoperasjon.
- Valider enhet, heltall, ikke-negative verdier og meningsfulle relasjoner. Bruk parameteriserte spørringer og konfliktkontroll, eksempelvis en versjonskolonne.
- Revider endringer med før-/etterverdier og autentisert aktør. Kontroller at prisendringen faktisk leses av booking-backenden. Hvis PostgreSQL og backend ikke deler prismodell, dokumenter integrasjonsblokkeringen i stedet for å hevde at appprisene er endret.

### E. Aktive turer

- Vis accepted, arrived og in_progress som aktive; requested vises separat som bestillingskø.
- Vis passasjer, sjåfør, hente-/leveringsadresse, status og korrekt merket estimert/sluttpris.
- Oppdater hvert 30. sekund mens siden er synlig; stopp overlappende forespørsler og polling etter navigasjon.
- Bevar filtre. Vis siste vellykkede oppdatering og utdatert-status ved nettfeil. Ikke presenter null turer ved API-feil.
- Dette er en automatisk oppdatert turliste. Ikke påstå at den viser live GPS-posisjon uten faktisk posisjonskilde.
- Ikke la en listehandling markere betaling eller fullføre tur uten backendens autoriserte domeneflyt.

### F. Sjåførens egen side

- Vis bare innlogget sjåførs egne kjøretøy og turer.
- Bruk `vehicles.driver_id = authenticated_users_id` og `rides.driver_id = authenticated_users_id`, der identiteten bestemmes på server.
- ADMIN kan se administrasjonssidene. PASSENGER skal ikke ha tilgang. DRIVER skal ikke kunne åpne admin-ruter, kjøre admin-spørringer eller endre andre sjåførers rader ved å bytte ID.

## 4. Tilgang og sikker implementasjon

1. Budibase-identitet og rollen i SQL-tabellen er forskjellige kilder. Koble autentisert identitet til riktig SQL-bruker på server via en pålitelig identitetsmapping. Et role-felt i frontend eller en innsendt admin_id er ikke autorisasjon.
2. Håndhev rolle og radtilgang i server-/datalaget. Skjulte knapper og sidefiltre er bare brukeropplevelse.
3. Verifiser Budibases aktuelle muligheter for query-/app-permissions og server-bindinger i offisiell dokumentasjon. Ikke anta at klientbundne query-parametere er uforfalskbare.
4. Bruk minst mulige databaserettigheter. Ikke bruk databaseeier/superuser som felles admin- og sjåførtilkobling. Begrens base-tabeller, views og funksjoner. Hvis sikker radtilgang ikke kan bevises med delt SQL-tilkobling, bruk eksisterende autentiserte API som mellomlag.
5. Bruk SSL, parameterbinding, validerte enum-overganger, transaksjoner, revisjonslogg og beskyttelse mot tapte samtidige oppdateringer. Ved SECURITY DEFINER: lås search_path, kvalifiser objekter og begrens EXECUTE.
6. Secrets skal ligge i støttet hemmelighetslagring, aldri i prompt, repository, SQL-eksempler med faktiske passord eller brukerens nettleser.
7. Arbeid i QA/utkast. Produksjonsmigrering, offentlig publisering og irreversible inngrep krever konkret gjennomgått resultat og separat uttrykkelig godkjenning. Ikke endre live-betaling.

## 5. Dette skal du faktisk produsere

Lever én samlet mappe/pakke med:

1. `00_INSPECT.sql`: skrivebeskyttet miljø-/skjemakontroll.
2. `01_SAFE_MIGRATION.sql`: nødvendige additive, idempotente endringer med transaksjons- og backupforutsetninger.
3. `02_VIEWS.sql`: oversikt, sjåførsøknader, kjøretøysøknader, priser og aktive turer.
4. `03_ACTIONS.sql`: sikre, parameteriserte handlinger for godkjenning/avvisning/suspensjon/prislagring; ingen betalt-/turfase-snarveier.
5. `04_PERMISSIONS.sql`: minst mulige rettigheter, identitetsmapping og valgt serverbasert radtilgang.
6. `05_SYNTHETIC_TEST_DATA.sql`: klart merkede, isolerte testdata uten ekte personopplysninger; skal ikke kjøres automatisk i produksjon.
7. `06_BUDIBASE_SETUP.md`: nøyaktig skjermnavn, komponenter, spørringsnavn, parametertyper, faktiske bindinger, modal-/knappehandlinger, validering, polling og feilmeldinger. Ingen udefinerte variabler eller pseudokode.
8. En faktisk Budibase-app/importfil hvis støttet tilgang og format er tilgjengelig; ellers komplett oppsett som kan følges uten å gjette. Beskriv konkret hva som hindret automatisk opprettelse.
9. `07_TEST_REPORT.md`: PASS/FAIL/BLOCKED/NOT RUN, versjoner, testbevis og reelle begrensninger.
10. `08_RELEASE_AND_ROLLBACK.md`: tilkobling/miljø, endrede objekter, backup, reversering og åpne produksjonskrav. Ikke lever en rollback som blindt sletter data.

Bruk offisiell PostgreSQL-/Budibase-dokumentasjon for versjonsavhengige detaljer. Ikke finn på eksportformat, API-endepunkter eller funksjoner som ikke er tilgjengelige.

## 6. Obligatorisk testing

Test i isolert QA:

- ADMIN har tilgang; DRIVER/PASSENGER/anonym nektes admin-spørringer og direkte handlinger.
- Sjåfør A kan ikke lese eller endre sjåfør B ved URL-, parameter- eller query-manipulasjon.
- Gyldig søknad kan godkjennes én gang. Utløpte dokumenter/blokkert bruker hindrer godkjenning.
- Avvisning/suspensjon krever begrunnelse og lager korrekt revisjonsspor.
- Kjøretøy med feil eier eller utløpt forsikring godkjennes ikke.
- Ugyldig pris avvises. To samtidige prisendringer overskriver ikke hverandre ubemerket.
- Turstatusene filtreres korrekt. Automatisk 30-sekunders oppdatering virker og stopper ved navigasjon.
- Feilet henting viser feil/utdaterte data, ikke et falskt nullresultat. Utgått sesjon fjerner beskyttet visning.
- Norske tegn, lange navn, små skjermer, tastaturnavigasjon og tilgjengelige knappetekster fungerer.
- Alle scripts kjøres mot et tomt isolert testskjema og mot forventet eksisterende skjema der dette lar seg gjøre. Gjentatt migrering skader ikke data.

## 7. Arbeidsmåte og sluttresultat

Start nå med å identifisere den faktiske databasen og Budibase-appen. Gjør deretter de trygge endringene, bygg skjermene, koble handlingene og kjør testene. Bevar Claude/Astros arbeid og rapporter kildecommit/deploy separat.

Ikke stopp ved anbefalinger. Ikke påstå at en SQL-fil er kjørt, et panel er opprettet eller tilgang er sikker uten konkret bevis. Manglende tilgang skal blokkere bare den avhengige delen; resten av pakken ferdigstilles.

Avslutt kort med: hva som er bygget, lenke/filer, hva som er testet, hva som er blokkert og konkret neste steg. Merk løsningen «QA-klar», «produksjonsklar» eller «blokkert» etter dokumenterte resultater.
