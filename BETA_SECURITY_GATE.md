# SNAR · beslutning om sikker beta

**20. november 2026: HOLD for ekstern beta.** Sikkerhetsgrenen er til review og isolert QA. Eier kan bare akseptere en restrisiko på informert grunnlag, med konsekvens, kompenserende kontroll, utløpsdato og ansvarlig.

| Prioritet | Krav for åpning | Nåstatus | Hvem leverer bevis |
| --- | --- | --- | --- |
| P0 | Alle potensielt private historiske nøkler er entydig klassifisert og ev. sikret | Åpen. Gyldighet, rettigheter og eventuell bruk er uavklart. Kritisk kompromittering er ikke påvist. | Leverandøreier og sikkerhetsansvarlig |
| P1 | Sikkerhetsendringene er reviewet og testet på nøyaktig QA-kandidat | Backend testet lokalt. GitHub Actions fikk ikke starte pga. faktureringssperre. Felles QA kjørte tidligere SHA ved kontroll. | Backend + drift |
| P1 | Admin/Fleet, faktoraktivering, sesjonsutløp, økonomiske rettigheter og dokumentinnsyn fungerer gjennom faktisk panel | Lokal API-dekning og panelbygg. Runtime-bevis på sikkerhetskandidaten mangler. | Panelansvarlig |
| P1 | Kunde registrerer seg med planlagte påloggingsmetoder og OTP | Offline-kontroller finnes. QA-OTP er dokumentert avslått. Begge leverandørinnlogginger og OTP på fysiske relevante enheter gjenstår. | Mobil + QA |
| P1 | Testtur knytter sammen flåtesøknad, godkjenning, Fleet-login, sjåførinvitasjon, dokumentkontroll, online/offline, bestilling, dispatch, GPS, fullføring og kvittering | Tidligere brukerrapportert fullført tur og separate QA-observasjoner. Ingen komplett sammenhengende kjøring på denne SHA. | QA-eier |
| P1 | Stripe testmodus, kort og wallet, mottaker og 12 % avstemmes mot kvittering | Google Pay rapportert på i testmodus, Apple Pay av. Fysisk Android/iPhone-kvittering og godkjent Apple merchant/entitlement mangler. Reelle penger utsettes til egen godkjenning av mottakerkonto og live-oppsett. | Betalingsansvarlig |
| P1 | Drift kan gjenopprette, oppdage og begrense hendelser. Personvernrisiko har navngitt eier | Restore, alarmmottak, DPIA og oppbevaringsmatrise krever attestasjon. | Drift + personvernansvarlig |
| Før kampanjestart | Founding 500 overholder én innløsning, totalgrense, budsjett og korrekt flåteoppgjør | Ingen fullstendig testet innløsningsflyt på kontrollert QA-gren. | Produkt + betaling |

Registrer bevistype, dato, Git-SHA, appbygg, miljø og resultat per steg. Skill simulert leverandørsvar, faktisk testmodusleveranse og fysisk brukerhandling. Bruk anonyme løpsreferanser i lukket QA-logg. Unngå personopplysninger og eksterne kontoidentifikatorer i kildekoden.

Neste beslutning er først privat klassifisering av P0, deretter fagfellevurdert QA-utrulling og fysisk kjøring. Produksjon, livebetalinger og eventuell aktivering av ekstern brannmur er egne beslutninger.
