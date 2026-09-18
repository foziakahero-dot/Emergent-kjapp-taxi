# KJAPP admin – produksjonsrevisjon

Dato: 18. september 2026  
Område: `https://admin.kjappapp.no` og API-et `https://github-app-builder-28.emergent.host/api`

## Resultat

Admin-panelet er kontrollert skjerm for skjerm i en lokal produksjonslik build, med samme API-kontrakt som produksjon. Følgende er rettet:

- lister som tidligere viste 0 elementer fordi API-et bruker eldre envelope-navn (`trips`, `drivers`, `users`, `vehicles`, `documents`, `tickets`, `events` osv.)
- blank Settings-side når `ride_classes` kommer som objekt
- live-kart med friske GPS-punkter, OSM-attribusjon og tydelig stale-status
- online-status som tidligere kunne vise en sjåfør med GPS-data fra flere dager siden
- aktive turer eldre enn to timer markeres som stale i stedet for å se aktive ut
- globalt søk viser en forklaring når produksjons-API-et mangler søkeendepunkt
- utlogging prioriterer eksplisitt Bearer-token foran en gammel cookie, og sesjonen kan revokeres per JTI

Det er ikke lagt inn testdata i produksjonsdatabasen.

## Skjermrevisjon

| Område | Kontroll | Resultat |
| --- | --- | --- |
| Innlogging | superadmin-rolle, ugyldig innlogging, 401/403 | Bestått lokalt; produksjon godtar fortsatt gammel seeded admin-konto |
| Dashboard | nøkkeltall, fersk GPS, stale turer, 2FA-varsel | Bestått |
| Live | kart, friske/stale sjåfører, siste signal | Bestått med OSM-kart og tydelig stale-varsel |
| Turer | tabell, søk/filtre, detaljdrawer og tidslinje | Bestått; fem produksjonsrader ble vist |
| Sjåfører | status, godkjenning, turantall | Bestått |
| Kunder | tabell og detaljer | Bestått |
| Flåter/løyvehavere | søknadsflyt og tomtilstand | API for superadmin-søknader svarer; visuell flyt kontrollert |
| Kjøretøy | status og sist signal | Bestått |
| Dokumenter | scopes og dokumentliste | Bestått |
| Økonomi | summer, serier og CSV-eksport | Bestått; eksport svarte med CSV |
| Support | ticket-liste og tomtilstand | Bestått |
| Revisjon | audit-logg og tomtilstand | Bestått |
| Innstillinger | provisjon, funksjoner, kjøretøyklasser, 2FA | Blank-side er fikset; 2FA-visning fungerer |
| Globalt søk | 404-håndtering | Forklaring vises når gammelt produksjons-API ikke tilbyr søk |

## Responsiv kontroll

Kontrollert ved 1440, 1280, 1024, 768 og 390 piksler. Tabeller får horisontal scrolling på små skjermer, navigasjon komprimeres, kart og drawer holder seg innenfor viewporten, og ingen skjerm kollapser.

## Sikkerhet

Anonym tilgang til admin-endepunkter gir 401, ugyldig token gir 401, og kundetoken får 403. Admin-brukeren får korrekt `superadmin`-rolle. Token-revokering har JTI-støtte, og Bearer-token har nå korrekt prioritet når en gammel cookie finnes.

Produksjonen har fortsatt to eksterne sikkerhetsoppgaver før beta:

1. `GET /auth/2fa/status` viser `required: true`, men `enabled: false`; 2FA må aktiveres for superadmin.
2. Den gamle seeded admin-kontoen med svakt passord godtas fortsatt av den deployede backend-versjonen. Sett en sterk `ADMIN_PASSWORD`/roter konto i Emergent-miljøet og deploy backend-versjonen fra denne grenen.

## Gjenstående deploy-blokkere

Den nåværende produksjons-backenden er eldre enn koden i denne grenen. Derfor svarte `/admin/transactions`, `/admin/refunds` og `/admin/search` med 404 i produksjon selv om frontend og backend-fiksene finnes her. Dette må deployes samlet før panelet kan godkjennes for ekte løyvehavere.

En produksjonsrad har også en aktiv tur og GPS-signal fra 10. september. Den vises nå som stale; operatør må enten avslutte eller undersøke turen.

## Verifikasjon

- `npm run build` – bestått
- `npx tsc --noEmit` – bestått
- `npm audit --audit-level=high` – 0 sårbarheter
- `python -m py_compile backend/server.py` – bestått
- `pytest backend/tests/test_security_regressions_unit.py -q` – 6 bestått
- `git diff --check` – bestått
- lokal browser-QA: ingen console-feil på Dashboard, Settings, Live eller Turer

Beta kan vurderes etter at denne grenen er deployet til Vercel/Emergent, 2FA er aktivert, admin-passordet er rotert, og den gamle aktive turen er gjennomgått.
