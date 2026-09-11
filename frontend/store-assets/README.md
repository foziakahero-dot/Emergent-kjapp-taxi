# KJAPP — Butikk-grafikk (klar til opplasting)

Alle bilder er generert fra ekte app-skjermer (ingen fiktive data).
Kildeskjermer ligger i `raw/`. Regenerer med `python /app/gen_store.py`.

## Google Play
- `play-feature-graphic-1024x500.png` — **Feature graphic** (påkrevd), 1024×500.
- `play-screenshot-1..4-1080x1920.png` — **Telefon-skjermbilder**, 1080×1920 (9:16).
  Last opp minst 2 (maks 8) under "Grafiske ressurser → Telefon".
- App-ikon til Play: bruk `../assets/adaptive-icon.png` (Play henter 512×512 fra bygget automatisk).

## Apple App Store
- `appstore-screenshot-1..4-1290x2796.png` — **iPhone 6.7"** skjermbilder, 1290×2796 (påkrevd størrelse).
  App Store Connect bruker 6.7"-settet også for mindre enheter.
- App-ikon: genereres automatisk fra `../assets/icon.png` (1024×1024) i bygget.

## Motiver (rekkefølge)
1. Nordisk taxi, reimaginert — onboarding
2. Se biler i nærheten — sanntidskart
3. Fast pris, ingen overraskelser — bestilling
4. Følg sjåføren live — live-sporing

## Tips
- Du kan laste disse rett opp i Play Console / App Store Connect.
- Endrer du appen senere: kjør `python /app/cap.py A` og `python /app/cap.py B`
  (med en aktiv demo-tur) for nye kildeskjermer, deretter `python /app/gen_store.py`.
