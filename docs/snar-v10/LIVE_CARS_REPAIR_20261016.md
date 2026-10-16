# SNAR — lokal implementasjon og kontroll, 16. oktober 2026

Denne rapporten beskriver kildekoden på leveransegrenen. Installerte apper bruker fortsatt tidligere kode. AI-chat er ikke implementert; obligatorisk valg om OpenAI-nøkkel gjenstår.

Utgangspunkt: `qa/snar-v10-phase5-staging-e2e`, commit `8f946d7426afd0ef3c023c755506b2dd505a49e6` i `foziakahero-dot/Emergent-kjapp-taxi`.
Lokal leveransegren: `fix/snar-live-available-cars-20261016`.

Prosjektet bruker FastAPI, MongoDB og Expo. Leveransen beholder eksisterende database og privat bildelagring. **Astra DB er ikke integrert eller migrert til.** Ingen ny tjeneste, database, DNS-endring eller Emergent-aktivering er utført.

## Status

| Oppgave | Implementert lokalt | Gjenstående verifisering |
| --- | --- | --- |
| Kundekart | Socket.IO, kundeautentisering, tilgjengelighet, fersk GPS, 5 km, bilmarkører og popup | Fysisk GPS, mobilnett og bakgrunnskjøring; reell forsinkelse er ikke sertifisert |
| Google Customer | Native flyt, tokenverifisering, roller, profilbilde og sikker JWT-lagring | Android OAuth-signaturregistrering er uverifisert, Customer iOS-klient mangler |
| Google Driver | Knapp, SDK, providerflyt og konfigurasjon fjernet; backend avviser Driver Google | Krever senere godkjent appbygg for installerte enheter |
| Bilvalg og bilder | Økonomi, Premium, SUV, serverpris, filtrert sjåførliste, privat bilde-/ikonopplasting | Kamera/galleri på enheter; flåtebiler må registreres som SUV for å vises i SUV-listen |
| Google Pay | Native Google Pay-oppsett, verifisert lagring, reservasjon og oppgjør via Stripe | Kun testmodus. QA-flagg, merchantoppsett og full fysisk Android-test gjenstår |
| AI-chat | Ikke implementert | Obligatorisk nøkkelvalg før API-arbeid |

Ingen APK-, iOS-, TestFlight- eller butikkbygg er startet. Ingen produksjonsbetaling eller aktivering er utført. Tidligere krav om sluttrapport og eksplisitt godkjenning før appbygg gjelder fortsatt.

## Kart og sanntid

- Socket.IO-navnerom `/customer-cars`, Engine.IO-sti `/socket.io`. JWT sendes i handshake-auth, aldri i URL. Kun kunder kan abonnere; rolle, sperret konto, tokenutløp og tilbakekalling kontrolleres på hvert øyeblikksbilde. Ingen global utsending av sjåførposisjoner.
- Fast radius på 5 km rundt kundens enhets-GPS. Numerisk bounding box mot eksisterende Mongo-felter etterfølges av eksakt haversine-avstand. Et manuelt hentested flytter ikke sirkelen for tilgjengelige biler.
- Bare godkjente, påloggede, tilgjengelige sjåfører med gyldig innloggingssesjon, tildelt flåtebil og gyldige driftskrav vises. Offline, demo, sperrede, opptatte og utløpte/tilbakekalte sesjoner filtreres bort. Eksisterende isolasjon av QA-testtilbud beholdes.
- Både GPS-tidspunkt på enheten og mottakstid på server må være under to sekunder gamle. Foreldede GPS-batcher og prøver som kommer i feil rekkefølge avvises.
- API-endringer varsler straks. Avstemming hvert 500 ms fanger også endringer fra andre arbeidere og GPS-utløp. Hvert kundeøyeblikksbilde erstatter tidligere markører. Lokal kontroll hvert 200 ms fjerner utløpte markører; frakobling og bakgrunn skjuler dem straks.
- Stillhet i strømmen i over to sekunder tømmer kartet. En mislykket eller for langsom databasespørring sender tomt resultat. Én opptatt bil kan ikke feile hele resultatet. En ny kontroll etter asynkrone flåteoppslag hindrer at en mellomliggende offline-endring gjenoppliver markøren.
- Driver ber om GPS hvert sekund, null minste bevegelse og ingen batching i forgrunn/bakgrunn. Én begrenset HTTP-publisering om gangen hindrer kø av gamle posisjoner.
- Tilpassede markører bruker eksisterende SVG-geometri med varianter for biltype/karosseri. Native Mapbox, web og rasterkart åpner popup med faktisk navn, modell og vurdering. Popup forsvinner sammen med bilen. Posisjon interpoleres over 250 ms.

Lokale WebSocket-tester bruker ekte REST-/Engine.IO-protokoll med isolerte testdata og kontrollerer endringsleveranse under to sekunder. Dette dokumenterer ikke nettverksforsinkelse eller OS-adferd på fysiske enheter. Eldre Driver-bygg som sender GPS hvert 12.–15. sekund vil bli skjult av den nye ferskhetspolicyen.

## Google og JWT

Customer beholder eksisterende Figma-knapper og eksplisitt kontokobling. Google-token kontrolleres kryptografisk med RS256, forventet audience/issuer og utløp. Bekreftet profilbilde lagres. Innloggingsfeil har norske meldinger uten rå token- eller verifiseringsdetaljer.

Driver Google er fjernet fra knapp, providerfunksjon, SDK-avhengighet og iOS-plugin. Backend annonserer Google bare for Customer og avviser Driver Google før tokenverifisering. Eksisterende Apple-flyt er beholdt.

Native JWT i begge apper lagres i Expo SecureStore. Gamle AsyncStorage-token migreres bare etter bekreftet sikker skriving. Ny tokenlagring feiler lukket. Andre innstillinger forblir i eksisterende lagring. Ny native avhengighet krever senere kontrollert appbygg.

Google Cloud viste «Site Unavailable» ved begge forsøk i nettleseren. Android OAuth-signaturregistrering og manglende Customer iOS-klient er derfor ikke ferdigstilt. Ekte Google-innlogging er ikke sertifisert.

## Bilvalg og privat media

Kundemenyen har nøyaktig tre valg: Økonomi (`ai-first`), Premium (`premium`) og SUV (`suv`). SUV er en egen serverkategori; tidligere XL/`trygg`-biler er ikke omklassifisert. Flåte-API godtar SUV. En eksplisitt `vehicle_rates.suv` brukes når den finnes; ellers gjenbrukes eksisterende romslig-bil-tariff (`trygg`). Ingen live pris- eller flåtedokumenter er endret.

Kategori bytter umiddelbart til beløpet i serverens eksisterende pristilbud og filtrerer tilgjengelige biler. Listen viser faktisk sjåførnavn, bilmodell, vurdering og privat profilbilde/bilikon. Bildeforspørsler krever kundeautentisering og samme tilgjengelighets-, sesjons-, GPS- og 5 km-policy som kartet. Versjonsnøkler hindrer at et gammelt bilde vises etter utskifting eller bilbytte.

Driver kan ta bilde eller velge fra galleri. Bilikonet knyttes til valgt bil. Eksisterende private Mongo-dokumentlagring gjenbrukes. Nye bilikoner begrenses til 3 MB/12 megapiksler, dekodes og lagres på nytt som PNG på maksimalt 512 px uten metadata. Tidligere versjon invalideres. Ingen ny lagringstjeneste er aktivert.

Økonomi og Premium bruker eksisterende lokale SNAR-illustrasjoner. SUV har en ny illustrasjon i samme stil. Alle tre bruker lokale filer med `contain`; eksterne kategorifotografier er fjernet. Enhetsrendering og pikselnøyaktig Figma-samsvar er ikke sertifisert av komponenttestene.

## Google Pay via eksisterende Stripe

Android-knappen bruker Stripes native `PlatformPayButton`, og lagring åpner Google Pays eget betalingsark med `confirmPlatformPaySetupIntent`. Kunden får informasjon om lagring, reservasjon ved bestilling og belastning etter avsluttet tur. SetupIntent opprettes for `off_session`; tidspunkt og omfang for aksept lagres i metadata.

Serveren kontrollerer at SetupIntent er fullført, at Stripe-kunde og eier stemmer, og at Stripe faktisk klassifiserer kortets wallet som `google_pay`. Vanlig kort kan ikke feilmerkes som Google Pay. Standard betalingsmåte velges bare etter bekreftet serverrespons. Webhook-gjenoppretting fungerer også når oppsettsknappen senere deaktiveres.

Eksisterende turbetaling reserverer det kanoniske beløpet før dispatch og tar oppgjør etter tur. Gjentatt oppgjør gir ikke dobbel belastning. Transaksjonsdokumentet inkluderer tur-ID, kunde-ID, beløp, valuta, status, Stripe-betalings-ID og wallet-type. Kortnummer og CVC lagres ikke av SNAR.

Nye native Stripe-kall bruker `StripeClient` med begrenset nettverksretry. Bare testnøkler godtas. QA leser det separate flagget `QA_GOOGLE_PAY_ENABLED`; produksjonsflagget aktiverer ikke QA ved et uhell. Det kjørende QA-miljøet er ikke endret eller aktivert i denne leveransen.

## Kodekart

Alle stier er relativt til prosjektroten.

| Del | Viktigste filer |
| --- | --- |
| Serverstrøm og Mongo-filtrering | `backend/live_cars.py`, `backend/server.py` |
| Kundeabonnement og GPS-livssyklus | `frontend/src/lib/liveCars.ts`, `frontend/src/lib/useAvailableCars.ts` |
| Kartmarkører og popup | `frontend/src/components/MapboxMap.native.tsx`, `Map.web.tsx`, `RasterMap.tsx`, `DriverMarkerPopup.tsx` |
| Driver GPS | `driver-app/src/lib/api.ts`, `driver-app/src/lib/nativeRuntime.ts`, `driver-app/app/(driver)/home.tsx` |
| Google-verifisering og native betaling | `backend/mobile_commerce.py` |
| Customer native Google | `frontend/src/lib/socialSignIn.native.ts` |
| Sikker native JWT | `frontend/src/utils/storage/index.ts`, `driver-app/src/utils/storage/index.ts` |
| Bilvalg og førerliste | `frontend/src/components/CustomerBookingView.tsx`, `V10CategoryImage.tsx`, `AvailableDriverList.tsx` |
| Beskyttet opplasting og visning | `backend/driver_media.py`, `driver-app/app/driver-profile-photo.tsx` |
| Google Pay-knapp og native flyt | `frontend/src/components/GooglePaySetupButton.native.tsx`, `frontend/src/lib/nativePayment.native.ts`, `frontend/app/payment-methods.tsx` |
| Reservasjon/oppgjør og transaksjoner | `backend/ride_reservations.py` |

## Kontrollresultater

**140 backendtester bestått**, én eksisterende Starlette/AnyIO-deprecation-advarsel. Ingen nettverks- eller produksjonstester inngår i dette tallet.

```bash
python -m pytest backend/tests/test_live_cars.py backend/tests/test_ride_search.py \
  backend/tests/test_driver_media.py backend/tests/test_security_regressions_unit.py \
  backend/tests/test_native_registration.py backend/tests/test_mobile_commerce.py \
  backend/tests/test_native_wallet_setup.py backend/tests/test_ride_reservations.py -q --tb=short
```

Beståtte JavaScript-/komponentkontroller:

- `node frontend/scripts/live-cars-regression.cjs`
- `node frontend/scripts/car-availability-regression.cjs`
- `node frontend/scripts/native-identity-regression.cjs`
- `node frontend/scripts/driver-media-regression.cjs`
- `node frontend/scripts/native-wallet-regression.cjs`
- `node scripts/verify-v10-screen-checkpoint.cjs`
- `node scripts/verify-figma-mobile.cjs`

TypeScript `--noEmit` for både Customer og Driver samt `git diff --check` består. Komponentkontrollene dekker faktiske komponenter og tilstandsendringer, men erstatter ikke native rendering, tredjeparts OAuth, GPS eller Stripe-test på enhet.

## Publiseringsblokkering

Automatisk godkjenningskontroll avviste opprinnelig push fordi målet ikke var uttrykkelig autorisert. Eier godkjente deretter push 16. oktober. Terminaltransporten manglet GitHub-innlogging; den tilkoblede GitHub-integrasjonen brukes til publisering med identisk Git-tre. Ingen main-merge eller appbygg er godkjent av dette push-samtykket.

Byggkontrollen fant og rettet en manglende `isQaBuild`-deklarasjon i `driver-app/app.config.js`. TypeScript-kontroll alene oppdaget ikke denne JavaScript-konfigurasjonsfeilen. Begge Expo-konfigurasjonene er nå evaluert med QA-profil, korrekt navn/pakke og SDK 57. Alle 12 tester for QA-byggbeskyttelse og backend-preflight består; disse tester kontrollene med simulerte nettverkssvar og bekrefter ikke en ny deploy.

Siste avleste Render QA-deploy er `dep-db8m6q8473hc73amf5f0`, commit `2bb10a1cfbefe450ac53536c371684f5e1f7f80d`. Denne leveransen er ikke deployet. Automatisk deploy er av på eksisterende `snar-api-qa` i «My Workspace».

## SUV-illustrasjonens opphav

Prosjektfil: `frontend/assets/vehicles/suv-category.png`. Laget med imagegen med eksisterende Økonomi/Premium-bilder som stilreferanser og transparent bakgrunn.

Prompt: “One charcoal black modern SUV, actual SUV silhouette with elevated roofline and crossover ground clearance, not a minivan. Match existing SNAR polished realistic 3D product rendering, front three-quarter view facing right, soft highlights, black tinted windows, clean silhouette, neutral dark wheels. Entire SUV visible, centered with minimal margins, roughly twice as wide as tall, premium but unbranded. Real transparent alpha background. No text, logos, floor plane, large cast shadow, people or scenery; consistent beside the two category assets at 84 × 50 px.”
