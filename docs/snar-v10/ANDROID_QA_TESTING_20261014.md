# Test de nye Android QA-appene

Bruk de to QA-APK-ene fra Expo og de separate innloggingene som er levert til brukeren. Passord finnes ikke i dette dokumentet eller Git.

1. Logg inn i Sjåfør med QA-sjåførens e-post og passord. Godta vilkårene selv i appen. Kontroller at valgt bil er `SNAR QA Testbil 14.10`, `QA0014`, og tillat posisjon før du går online.
2. Logg inn i Kunde med QA-kundens e-post og passord. Godta vilkårene selv. Velg faktisk hentested og reisemål innenfor testmiljøets serviceområde. Backend bruker Stripe-testmodus.
3. Kontroller at bilvalg, pris, bekreftelse og eventuell kortreservasjon gir tydelig faktisk status. Først etter at turen er opprettet kan sjåføren ta imot og teste pickup, tur og avslutning. Ikke regn manglende bekreftelse som en bestilling.
4. Kontroller tekststørrelse, lyst/mørkt tema, redusert bevegelse, meny, historikk, kvittering og sikkerhetskontroller på telefonen. Rapporter hvilken app, skjerm og handling som feiler.
5. I Kundestøtte er AI deaktivert i QA. Feil skal bevare meldingsutkastet; «send til kundestøtte» skal gi et faktisk saksnummer. Backend-intake og adminfelt er kontrollert mot QA etter siste utrulling.

Kontoene er vedvarende kontoer med normal autentisering, og sjåføren har tildelt aktiv QA-bil. Bil-, dokument- og identitetsopplysningene er syntetiske testdata i den isolerte QA-databasen. Ingen produksjonsgodkjenning er gitt.

APK-arkiv, app-ID, ARM64-biblioteker og QA-backend i JavaScript-bundelen kontrolleres før levering. Fysisk Android-akseptanse av GPS, kart, betaling, varslinger og alle 67 Figma-stater må bekreftes ved testen; et vellykket bygg dokumenterer ikke disse resultatene.
