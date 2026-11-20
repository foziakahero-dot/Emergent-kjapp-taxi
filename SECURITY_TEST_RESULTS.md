# SNAR · bevis for sikkerhetskontrollene

**20. november 2026.** Kandidaten bygger på QA-commit 7824f6ed45f65a556385c0706964599253881cb7. Testene under bruker syntetiske kontoer og lokal ASGI-transport. Socket.IO testes gjennom protokollen. Nettverk til database, betalingsleverandør og offentlige API-er er sperret under Pytest.

| Kontroll | Resultat | Hva beviset dekker |
| --- | --- | --- |
| Offline backendpakke, Python 3.12, Render-avhengigheter | **679 bestått, 11 deltester bestått.** Tre advarsler, bl.a. blokkert DNS i test av leverandørisolasjon. | API-handlere, modellert database, to-faktor, sesjon, rettigheter, sjåfør-/flåtetilknytning, turstatus, livekart, reservasjon og kvitteringslogikk. |
| Nye sikkerhetstester | Inngår i pakken | Første faktoroppsett roterer sesjonen, gammel sesjon avvises, reservekode gir én godkjenning ved samtidige forsøk, brukt innloggingsutfordring avvises. Fersk autentisering håndheves for sensitiv skriving. Uønsket cookie-opprinnelse avvises. |
| Stripe | Bestått lokalt | Faktisk Stripe-SDK validerte en lokalt signert syntetisk hendelse og avviste endret innhold. Testene kontrollerte manglende signatur, hemmelighet og maksimal størrelse før forretningsbehandling. Ingen betalingsordre eller leverandørtransaksjon ble opprettet. |
| Personvern og transport | Bestått lokalt | Private inndata ble ikke reflektert i generiske validerings- eller feilsvar. Kontrollert appfeillogg bruker rutemal. HTTP og WebSocket ble prøvd i alle tre kantmodi. |
| Avhengigheter | Ny installasjon av Render-manifest, pip check OK | pip-audit av det da løste, oppdaterte miljøet fant ingen kjente advisories etter oppgradering av byggverktøyet pip. Det større hovedmanifestet lot seg også løse med pip dry-run. Dette gjelder skannet pakkeutvalg og tidspunkt, ikke gamle deployer eller mobilavhengigheter. |
| Statisk kodekontroll | Bandit, backend uten tests/scripts: 50 lave og 1 middels funn, 0 høye. Før: 51 lave og 2 middels. | XML-funnet er utbedret. Gjenværende middels funn gjelder bind-adresse og må vurderes i faktisk hostingtopologi. Ingen attestasjon av fravær av sårbarheter. |
| Historikk og daværende arbeidstre | Gitleaks 8.24.3 med redigerte funn: 33 historiske treff. 7 treff i daværende tre, alle i test-/eksempelfiler. | Historiske treff teller forekomster, ikke antall aktive hemmeligheter. Verdiene er ikke forsøkt brukt. Eierklassifisering pågår som åpen gate. |
| Admin | Produksjonsbygg av admin-klienten bestod lokalt. Proxy/rutingstest bestod. | Playwright med lokalt Chromium stoppet før første side da kjøreverten nektet Chromium å opprette sin prosess-socket. Nye nettleserasserts krever fungerende CI eller QA-nettleser. |
| Fleet | Produksjonsbygg og alle 9 lokale tester av dashboardets datatilstand bestod. | Isolerte paneltester. Fysisk og innlogget nettleserflyt gjenstår. |
| GitHub Actions på første kandidat (7d11678a) | GitHub registrerte failure for backend, Admin og Fleet før første steg. Alle tre jobbannotasjoner bekrefter kontosperre knyttet til fakturering. | Ingen CI-test ble kjørt. Etter at kontoeier har avklart sperren må begge arbeidsflyter få en verifisert kjøring. |
| Fysisk mobil og driftsmiljø | Kandidaten er ikke deployet | Ingen Maestro-kjøring på fysisk enhet, ingen Apple/Google-walletbetaling og ingen ny Apple-/Google-innlogging med virkelig leverandør i denne revisjonen. Tidligere rapportert tur ble gjennomført på en annen versjon. |

Tre feil fra kontrollgruppen ble undersøkt før godkjenning av den lokale pakken. To eldre tester forventet en Google Pay-flyt uten lagret, verifisert wallet. Testene kontrollerer nå både avvisning uten wallet, riktig betalingsmiddel og at dispatch/capture skjer én gang. En skjermtest var knyttet til foreldet skjermtekst og kontrollerer nå bekreftet betalingsstatus. Under arbeidet oppdaget suiten en regresjon i Socket.IO-autentiseringen. Den interne lesekonteksten er rettet og testen for inn-/utflytting av ledige biler bestod.

### Gjenta lokalt

Bruk et tomt Python 3.12-miljø uten tjenestehemmeligheter og kjør fra repoets rot.

```sh
python -m pip install -r backend/requirements-render.txt pytest-socket==0.8.1
python -m pip check
PYTHONPATH=backend python -m pytest -q --disable-socket --allow-unix-socket backend/tests --ignore-glob='*test_iter*' --ignore=backend/tests/backend_test.py
node scripts/panel-proxy-routing.test.mjs
```

De eldre iterasjonstestene og backend_test.py står utenfor denne suiten fordi de antar eksterne tjenester. Ingen aktiv sårbarhetsskanning mot QA/produksjon inngår. CI-definisjonen kjører samme avgrensede Python-suite ved relevante QA-PR-er. En GitHub-kjøring må ha eget resultat før den regnes som bestått.
