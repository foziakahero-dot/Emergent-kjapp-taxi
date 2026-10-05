# Prompt til Claude — SNAR Driver

Du er ansvarlig for å klargjøre SNAR Driver i GitHub-repoet foziakahero-dot/Emergent-kjapp-taxi. Codex arbeider samtidig med Customer og Render. Utfør reelle forbedringer, og lever en reviewbar draft PR.

Start med å lese AGENTS.md, gjeldende Driver-kode, backendkontrakter og docs/CUSTOMER_PREBUILD_REPORT_20261004.md. Hent audit/customer-prebuild-snar-20261003 og opprett egen gren claude/driver-readiness-20261004 fra nyeste head. Registrer base-SHA. Denne grenen inneholder umerget Customer-arbeid: hold egen PR-diff begrenset til Driver, og bruk audit-grenen som PR-base. Ikke skriv til audit-grenen, main eller Render sin fix/beta-mobile-firebase-ops-20260926. Ikke merge, force-push, deploy eller start APK/EAS/TestFlight.

Driver-koden ligger under driver-app/. Bekreft strukturen fra repoet; ikke lag et nytt Driver-prosjekt. Behold eksisterende identifikatorer, backend/API, Fleet-integrasjon og etablerte designs. Bruk FastAPI/Mongo; ikke introduser Supabase. Avklar tilgjengelig Driver-design fra faktiske filer; manglende design skal oppgis, ikke oppfinnes.

Lag først en kort skjerm-/handlingsmatrise med fil, API, feil og akseptansekriterium. Prioriter: rollebasert sjåførinnlogging og Fleet-invitasjon; riktig tildelt bil/profilfoto; online/offline med godkjenning og fersk GPS; tilbud/aksept/ankomst/start/slutt/avbrudd; én kanonisk aktiv tur; gjenoppretting ved nettbrudd/kaldstart/bakgrunn; chat og sikkerhet; historikk/inntekter/utbetalinger.

Undersøk de tre kjente feilene i backend/tests/test_beta_trip_integrity_contract.py:
- test_driver_app_does_not_mask_money_failures_or_recompute_trip_earnings
- test_driver_bundle_contains_no_google_or_self_registration_auth_path
- test_driver_app_exposes_vehicle_selector_and_profile_photo_without_redesign
Finn faktiske årsaker. Inntekter må komme fra server og avvente betaling; manglende beløp/nettfeil må aldri vises som null eller beregnes lokalt. Ikke legg inn Customer Google-login eller åpen selvregistrering i Driver. Ikke svekk tester eller lim inn tekst bare for å tilfredsstille kildeasserts; korriger foreldede tester bare med dokumentert funksjonell begrunnelse.

Endre Driver-filer og relevante isolerte tester. Ved behov for delt backend, Customer/frontend, betaling, dispatchkontrakt, felles pakker eller Render-konfigurasjon: dokumenter konkret foreslått endring i docs/DRIVER_SHARED_CHANGE_REQUEST.md og la den stå til felles gjennomgang. Ikke endre disse samtidig med Codex. Bruk kun lokale testdata, aldri ekte turer/betalinger eller produksjonsdata. Ingen hemmeligheter i kildekode, logger, chat eller rapporter.

Kjør prosjektets relevante TypeScript/lint/enhetstester og de nevnte regresjonstestene. Baseline for den tidligere utvidede 92-testseleksjonen var 89 bestått/3 Driver-feil; etabler egen baseline på faktisk base-SHA. Rapporter eksakte kommandoer og resultater. Ikke kall mocktester fysisk E2E. Google/Mapbox/e-post og fysisk testing er fortsatt åpne; Stripe TEST-konfigurasjonen er aktiv i Render. GitHub Actions starter ikke grunnet kontoens betaling/forbruksgrense; ikke endre fakturering eller hevde at CI er grønn. Customer build-gate skal ikke åpnes.

Implementer, verifiser, push med [eas skip] i commitmeldinger og opprett en draft PR med problemet, ny oppførsel, testbevis og gjenstående blokker. Lever docs/DRIVER_READINESS_REPORT_20261004.md med PASS/FAIL/BLOCKED/UNVERIFIED per funksjon og en kort koordinasjonsoppsummering til Codex. Ikke stopp ved en plan når implementering er mulig.
