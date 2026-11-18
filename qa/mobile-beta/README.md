# SNAR – automatisert beta-QA

Dette er videreføring av eksisterende Expo/Maestro-oppsett. Ingen ny app eller backend. Kodegrunnlag: mobil `9e5aef948a2cba928d827267d1de7f0a6d5b8791`. Nye flyter er skrevet og YAML-kontrollert, men ikke kjørt på emulator i denne økten.

## 1. Forutsetninger

1. Disponibel Android-emulator, Android SDK/adb og Maestro. GPS-kommandoen krever Android API 31 eller nyere. Bruk API 35 eller nyere for denne pakken.
2. Customer APK fra en fullført EAS-jobb med profil `qa`, prosjekt `3631002e-5b25-4847-b5d8-05ec2ef304b5` og riktig kildecommit. Hent EAS-metadata og APK; sjekk profil, kanal, kilde og signering før manifestet fylles ut. En checksum alene beviser ikke kildeproveniens eller signering.
3. Kopier `release.example.json` til en privat arbeidsfil. Fyll faktisk `buildId`, APK-ens SHA-256 og SHA-ene fra den leveransen som testes. Mobil og backend har separate kildeversjoner.
4. Syntetisk, lovlig innrullert QA-kunde med e-post `qa-…@example.invalid`, aksepterte testvilkår og ingen aktiv tur. Ingen ekte personopplysninger eller betalingskort. Sett `MAESTRO_QA_CUSTOMER_EMAIL` og `MAESTRO_QA_CUSTOMER_PASSWORD` privat i prosessmiljøet. Passord skal ikke inn i Git, kommandolinjeargumenter, delte logger eller rapporter.
5. QA må rapportere isolert database, riktig backend-SHA, Stripe TEST og avslått automatisk live-belastning. Kontanttesten krever `cash_enabled=true`. Ingen produksjonsvert godtas.

## 2. Kjør de faktiske skjermflytene

Fra repository-roten:

```bash
# E-post/passord er allerede satt privat som miljøvariabler.
python3 qa/mobile-beta/run_beta_suite.py \
  --manifest /private/qa-release.json \
  --apk /private/SNAR-Customer-QA.apk \
  --serial emulator-5554 \
  --cases theme privacy_language

# Oppretter én QA-kontantbestilling; runneren forsøker å avbestille den etterpå.
python3 qa/mobile-beta/run_beta_suite.py \
  --manifest /private/qa-release.json \
  --apk /private/SNAR-Customer-QA.apk \
  --serial emulator-5554 \
  --cases booking offline
```

Rapporten skrives til `.qa-results/mobile-beta/report.json`, med PASS, FAIL, BLOCKED eller NOT RUN. Etter første FAIL kjøres ikke nye scenarier. Nettinnstillinger gjenopprettes i `finally`; turer i uventet fase flagges for kontroll fremfor å manipuleres. Ingen korttransaksjon opprettes. Rå testlogger er private og skal ikke lastes opp sammen med de sikre rapportene.

| Fil | Hva testen faktisk kontrollerer | Ekstra forutsetning |
| --- | --- | --- |
| `01-booking.yml` | Oslo S → SNAR → kontant → pris/vilkår → bekreftet bestilling | Syntetisk QA-tur, frisk serverpris; ingen påstand om fullført tur |
| `02-dark-mode.yml` | Valg av Mørkt, Hjem, restart og fortsatt valgt Mørkt | Skjermbilder viser utseendet; bildebaseline må godkjennes separat |
| `03-privacy-language.yml` | Personvern blir på egen side; engelsk lagres; norsk gjenopprettes | PR149 i APK; ingen kontoeksport eller sletting |
| `04-search-empty.yml` | Tydelig tomtilstand, ingen bestilling, nytt søk virker | Geokoder-fixtur må gi `[]` for den navngitte søkestrengen |
| `05-offline.yml` | Feilmelding ved nettbrudd, ingen falsk «ingen biler» | Kjøres via runner som kobler fra emulatoren etter innlogging |

Søk uten treff er ikke deterministisk mot en ekstern geokoder med tilfeldig tekst alene. Ikke registrer testen PASS før kontrollert fixtur eller et dokumentert faktisk tomt serversvar er brukt. HTTP 503 mens Wi-Fi er på testes i et separat lokalt API-adapterlag; nettbruddtesten beviser ikke at en bestemt 503-gren virker.

## 3. CI/CD

1. `.github/workflows/qa-mobile-regression.yml` kjører TypeScript, eksisterende komponent-/atferdstester, Driver-testene og runnerens sikkerhetsregresjoner ved relevante PR-er og push til mobil-QA-grenen.
2. Den separate native-jobben er avgrenset til push på QA-grenen og `SNAR_QA_NATIVE_CI=true`. Den bruker `EXPO_TOKEN` fra GitHub Secrets og kaller den nøyaktige commitens EAS-workflow. Aktivering må skje etter at fakturering, preview-miljø og syntetiske kontoer er klare. En utelatt native-jobb er ikke en E2E-godkjenning.
3. `frontend/.eas/workflows/qa-beta-customer.yml` har rekkefølgen kildekontroll/native preflight → QA APK → Maestro mot akkurat `needs.build.outputs.build_id`. Ingen gammel hardkodet APK, OTA, innsending eller produksjonspublisering inngår.
4. EAS preview må ha eksisterende QA Firebase-fil, signering og de to syntetiske kundevariablene. Ikke send secrets til PR-kode fra forks. Runnerfeil, manglende secrets og kø gir BLOCKED, ikke PASS.
5. iOS Maestro krever en simulator-build. En ferdig TestFlight/IPA for fysisk enhet er ikke automatisk en simulator-artifact. Behold fysisk Apple/Google-innlogging, wallet og push som egne tester.

Den nye EAS-workflowen er lokalt YAML-kontrollert. EAS CLI sin eksterne validering stoppet på manglende CLI-innlogging, så ekstern skjemagodkjenning er BLOCKED. GitHub-paneljobbene stoppet før oppstart på kontoens faktureringslås.

## 4. Visuell kontroll og tilgjengelighet

1. Lag godkjente referansebilder per enhet, skjermstørrelse, OS, språk, fontskala og tema. Frys pris/quote og syntetiske kontodata. Skjermbildet «217 kr» er eksempeldata, ikke en pris som skal hardkodes i testen.
2. Masker bare kartfliser, klokke og andre eksplisitt dynamiske områder. Pris, tilbudets gyldighet, kjøretøy og bekreftelsesknapper skal alltid sammenlignes.
3. Sammenlign med `compare_screenshot.py`, som avviser ulik bildestørrelse og ikke skalerer bort layoutfeil. Krever Pillow, eksempelvis den eksisterende backend-testavhengigheten `Pillow==11.3.0`.

```bash
python3 qa/mobile-beta/compare_screenshot.py \
  approved/pixel-theme-dark-font1.png actual/pixel-theme-dark-font1.png \
  --masks approved/dynamic-map-rectangles.json
```

4. Kjør fontskala 1.0, 1.3 og 2.0, appens Større tekst, økt kontrast og redusert bevegelse. Kontroller at beløp/valuta og tekst ikke kuttes, og at knapper kan nås ved scrolling. Gjenopprett emulatorinnstillinger etter testen.
5. Appkonfigurasjonen låser orientering til portrett. Forvent fortsatt portrett etter fysisk rotasjon; ikke meld manglende landskapslayout som feil. Valgt bil, destinasjon og serverens pris/vilkår skal bevares. Reell prisoppdatering kan endre beløpet: sammenlign samme quote eller krev ny bekreftelse.
6. Radio-knappens `checked=true` beviser lagret temavalg, ikke at hele kartet fikk riktige farger. Kjør bildebaselines og fysisk kartkontroll separat. VoiceOver/TalkBack og største OS-tekst krever egne enhetstester.

## 5. Last og ytelse

`load-qa.js` bruker k6, låst QA-vert, forventet backend-SHA, Stripe TEST og syntetisk kundetoken. Den spør bare etter nærliggende biler og klargjøringsstatus. Den booker ikke turer og belaster ikke kort. `SNAR_QA_VUS` er begrenset til 1–20, med 30 sek opptrapping, 60 sek jevn last og 30 sek nedtrapping. Standard er 10 samtidige virtuelle brukere.

```bash
# QA_CUSTOMER_TOKEN settes privat. Ikke bruk et ekte kundetoken.
SNAR_QA_LOAD=RUN_SYNTHETIC_QA SNAR_QA_VUS=10 \
EXPECTED_BACKEND_SHA=afd2bfaf5a5afe6f706a4ed3488a19fdc759cf6a \
k6 run qa/mobile-beta/load-qa.js
```

1. Mål baseline med én bruker, deretter 5, 10 og 20. Avbryt ved feilrate ≥1 %. Foreløpig mål for nærliggende biler er p95 <800 ms; dette er et akseptansemål, ikke et målt resultat.
2. Observer Render CPU/minne/5xx og Atlas-spørringer, indeksbruk og forbindelser samtidig. Skill cacheeffekt fra faktisk flaskehals og 429/ratebegrensning fra serverkrasj.
3. Denne REST-testen tester ikke Socket.IO, dispatch, GPS-strømming eller Stripe. Kjør egne syntetiske Socket.IO-klienter med sekvensnumre og mål GPS-alder/dispatch-latens før beta; k6 rå WebSocket er ikke automatisk en Socket.IO-klient.
4. Test mobilens kalde start, rammehakking, minne, batteri og GPS på fysiske enheter i tillegg. Ikke bruk emulatorens oppstartstid som mål for kundens telefon.

## 6. Verktøyvalg og kilder

| Verktøy | Bruk i SNAR |
| --- | --- |
| Maestro | Hovedverktøy for eksisterende Customer/Driver brukerreiser på Android/iOS |
| Playwright | Admin/Fleet, nettverksfeil, tilgang, dokumenter, retry og skjermbilder |
| Eksisterende Node/React-tester og pytest | Raske komponent-, kontrakt-, betalings- og idempotensregresjoner |
| Appium + UiAutomator2/XCUITest | Ved senere behov for mer omfattende enhetsstyring og native integrasjoner |
| Espresso / XCUITest direkte | Spesialiserte plattformtester når en konkret native feil krever det |
| k6 | Kontrollert belastning på backend; eget oppsett kreves for Socket.IO og mobilprofilering |

Offisielle referanser:

- [Maestro state selectors](https://docs.maestro.dev/reference/selectors/state-selectors)
- [Maestro airplane mode – bare Android](https://docs.maestro.dev/reference/commands-available/setairplanemode)
- [Maestro GPS og Android-krav](https://docs.maestro.dev/reference/commands-available/setlocation)
- [Expo Workflows Maestro og build outputs](https://docs.expo.dev/eas/workflows/pre-packaged-jobs/)
- [EAS CLI workflow:run](https://docs.expo.dev/eas/cli/)
- [Appium-drivere](https://appium.io/docs/en/latest/ecosystem/drivers/)
- [k6 scenarios](https://grafana.com/docs/k6/latest/using-k6/scenarios/)
