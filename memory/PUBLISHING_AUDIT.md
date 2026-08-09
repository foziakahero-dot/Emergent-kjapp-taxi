# KJAPP — APK & iOS Publishing Audit

**Status**: Beta-klar som PWA. Kan installeres på iOS + Android hjemmeskjerm i dag.  
**Neste steg**: Native APK og iOS-app-butikk publisering krever wrapping av eksisterende PWA + native konto-oppsett.

---

## 1) Nåværende situasjon (2026-08)

Appen er en **fullverdig Progressive Web App (PWA)**:
- `manifest.json` med KJAPP-ikoner (192, 512 SVG), startside, farger, portrettmodus
- `apple-touch-icon`, `apple-mobile-web-app-capable`, status-bar-tema
- Service worker (`/sw.js`) med push-varsler
- Responsiv (mobil-første, safe-area for iPhone-notch)
- Fungerer offline for statiske assets via SW caching (må utvides)

**Installer nå (0 kroner):**
- **iPhone/iPad**: Åpne i Safari → Del → "Legg til på Hjem-skjerm"
- **Android**: Åpne i Chrome → meny → "Installer app" / "Legg til på Hjem-skjerm"

Dette gir et fullskjerms-app-ikon som ser nesten identisk ut med native — perfekt for beta-testing.

---

## 2) Native APK (Google Play) — hva som mangler

### Krever
| Punkt | Kostnad | Tid |
|---|---|---|
| **Google Play Console-konto** | $25 engangs | 1 dag |
| **Utvikler-verifisering** (ID, adresse) | 0 kr | 1–5 dager |
| **Bank-konto for utbetaling** | 0 kr | 1–3 dager |
| **App-ikon 512×512 PNG** + featured 1024×500 | 0 kr | 1 t |
| **Skjermbilder** (min 2, opp til 8) — telefon + tablet | 0 kr | 2 t |
| **Personvernerklæring URL** (public) | 0 kr | 2 t |
| **App-innhold-rating** (skjema) | 0 kr | 30 min |
| **Retningslinjer** (fint hvis dataen selges/deles) | 0 kr | 1 t |

### Teknisk pakking (2 alternativer)

**A) Trusted Web Activity (TWA) — Anbefalt for oss** (raskest)
- Wrap PWA i en tynn Android-app via [PWABuilder](https://www.pwabuilder.com/) eller [Bubblewrap CLI](https://github.com/GoogleChromeLabs/bubblewrap)
- Krever "digital asset link" fil på server (`/.well-known/assetlinks.json`) for å binde til APK-signatur
- Fordel: Sender bare URL — appen oppdateres når PWA oppdateres (ingen ny APK-release for hver endring)
- Ulempe: Krever Chrome 72+ på enheten (99% i Norge)

**B) Capacitor** (full native-tilgang)
- `npm i @capacitor/core @capacitor/cli && npx cap init KJAPP no.kjapp.app`
- `npx cap add android` → åpner i Android Studio → build APK/AAB
- Fordel: Kan bruke native API-er (kamera, kontakter, ekte push, biometri) senere
- Ulempe: Ny build kreves for hver oppdatering

**Anbefaling**: Start med **TWA** for lansering (raskt), migrer til Capacitor når native-features trengs.

### Konkret handling
1. Bruk PWABuilder: gå til pwabuilder.com, skriv inn din KJAPP-URL, last ned Android-pakken
2. Legg `assetlinks.json` på server (må serveres på `/.well-known/assetlinks.json`)
3. Signer AAB (Play krever `.aab`, ikke `.apk` fra 2021)
4. Last opp i Play Console → Internal Testing → Closed Testing → Production

---

## 3) Native iOS (App Store) — hva som mangler

### Krever
| Punkt | Kostnad | Tid |
|---|---|---|
| **Apple Developer Program** | $99/år | 24–48 t godkjenning |
| **Mac med Xcode** | Egen | — |
| **Utvikler-sertifikat** + provisioning profile | 0 kr | 30 min |
| **App Store Connect app record** | 0 kr | 1 t |
| **App-ikon 1024×1024 PNG** (ingen alpha) | 0 kr | 30 min |
| **Skjermbilder** (6.7", 6.5", 5.5" iPhone, iPad 12.9") | 0 kr | 2–4 t |
| **Personvernerklæring URL** | 0 kr | — |
| **App-review-info** (test-konto, kontakt) | 0 kr | 30 min |

### Teknisk pakking

**Capacitor er eneste realistiske vei** (Apple godtar ikke ren TWA):
```bash
npx cap add ios
npx cap open ios   # åpner Xcode
```
I Xcode:
1. Sett bundle-ID: `no.kjapp.app`
2. Legg til `NSLocationWhenInUseUsageDescription` i Info.plist (kart-tillatelse)
3. Legg til Sign in with Apple capability (hvis brukes)
4. Archive → Upload til App Store Connect
5. Submit for review (typisk 24–48 t)

### Apple-spesifikke krav vi må oppfylle
- ✅ **Personvernerklæring** — obligatorisk
- ⚠️ **Sign in with Apple** — påkrevd hvis vi har Google Sign In (Apple-regel 4.8). Vi må implementere ekte Apple Sign In før iOS-release.
- ⚠️ **In-App Purchase** — hvis vi tar betalt i appen for digitale ting (ikke turer, som er fysiske tjenester → OK å bruke Stripe/Vipps)
- ✅ **Åpen for review-team** — de tester appen; vi trenger test-konto
- ✅ **Kart-tillatelse forklaring** i Info.plist
- ⚠️ **Betalings-flyt** — turer er "fysiske varer/tjenester" → tredjeparts betaling er OK. Digitale tjenester ville krevd IAP.

---

## 4) Backend / infrastruktur — hva som må være på plass før produksjon

| Område | Status | Aksjon |
|---|---|---|
| **HTTPS** | ✅ Emergent-URL har SSL | OK |
| **Custom domene** (kjapp.no) | ❌ | Kjøp domene, peker til Emergent deployment |
| **Personvernerklæring** | ❌ | Skriv i tråd med GDPR + norsk personvernlov |
| **Vilkår** | ❌ | Skriv brukervilkår + sjåfør-avtale |
| **Kunde-support** e-post/chat | Delvis | Konfigurer support@kjapp.no |
| **Løyve-verifisering** (Norge: krav for taxi) | ❌ | Sjåfører må ha løyve — vi må validere |
| **Utstederrapportering** til Skatteetaten | ❌ | Alle drosjeturer må rapporteres via godkjent kontrollutstyr |
| **Kredittkort-PCI compliance** | ❌ | Bruk Stripe/Vipps som overholder for oss |
| **MongoDB backup** | ❌ | Sett opp daglig backup + retention |
| **Rate limiting** | ❌ | Legg til slowapi/fastapi-limiter |
| **Feil-monitoring** (Sentry) | ❌ | Anbefalt før prod |
| **Logging** | Delvis | Send structured logs til CloudWatch/Datadog |

### Norske juridiske krav (viktig!)
- **Taksameter og kontrollutstyr**: Fra 1. november 2020 må alle drosjer ha godkjent taksameter eller alternativt registreringssystem (annet enn taksameter, ARS). En taxi-app kan **kvalifisere som ARS** hvis den er godkjent av Skatteetaten.
- **Løyve**: Sjåfører må ha kjøreseddel + løyve (endret regelverk gjør at hvem som helst kan søke, men fortsatt kreves løyve)
- **Rapportering**: Alle turer må rapporteres daglig til Skatteetaten
- Vi må søke om godkjenning av KJAPP som ARS-leverandør før kommersiell lansering — dette er den største juridiske jobben

---

## 5) Konkret 6-ukers roadmap til App Store + Google Play

**Uke 1: Business + juridisk**
- Kjøp `kjapp.no` domene
- Skriv personvernerklæring + vilkår (bruk mal fra Datatilsynet)
- Start søknad om ARS-godkjenning hos Skatteetaten

**Uke 2: Design + assets**
- Design ikon 1024×1024 + featured graphics
- Ta skjermbilder for begge plattformer
- Skriv app-beskrivelse (norsk + engelsk)

**Uke 3: Native wrapping**
- Sett opp Capacitor
- Bygg iOS + Android
- Test på ekte enheter
- Implementer ekte Apple Sign In

**Uke 4: Backend prod-hardening**
- Sentry + logging
- Rate limiting
- Backup + monitoring
- Custom domene på deployment
- Bytt Google auth til KJAPP-eiet Google OAuth-client

**Uke 5: Store-submission**
- Google Play Console: opprett, last opp AAB, fyll ut Store Listing
- App Store Connect: opprett app, last opp bygg, fyll ut alt
- Submit til review

**Uke 6: Iterasjoner**
- Løs eventuelle avvisninger
- Godkjenning + kommersiell lansering

---

## 6) Kostnadsestimat (engangs + løpende)

**Engangs:**
- Apple Developer: $99 (~1050 kr)
- Google Play: $25 (~265 kr)
- Domene `kjapp.no`: ~150 kr/år
- Juridisk gjennomgang (advokat): 5000–15000 kr

**Løpende (månedlig):**
- Hosting: 500–2000 kr (avhengig av trafikk)
- SendGrid (e-post): 0–500 kr
- Sentry: 0 kr (gratis tier)
- Stripe/Vipps: 2.5% + fast per transaksjon

**Total oppstart**: ~10 000 – 20 000 kr

---

## Oppsummering

**Kortsiktig (i dag)**: Appen kan installeres som PWA på både iOS og Android. Bruk denne kanalen for beta-testing med reelle brukere.

**På 4–6 uker**: Native APK og iOS-app publisert i butikkene, forutsatt ARS-godkjenning kommer inn tidsnok.

**Kritisk sti**: Skatteetaten ARS-godkjenning er lengste vei — start med det. Alt annet er 2–3 ukers arbeid.
