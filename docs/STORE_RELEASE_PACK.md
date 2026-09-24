# KJAPP Store & TestFlight Release Pack

Status: beta preparation. No app redesign is part of this pack.

## App identities

| App | Display name | Bundle / package | Expo project |
| --- | --- | --- | --- |
| Customer | KJAPP | `no.kjapp.app` | `3631002e-5b25-4847-b5d8-05ec2ef304b5` |
| Driver | KJAPP Driver | `no.kjapp.driver` | `1dec8949-0423-4fbf-a080-0703f93519d7` |

Canonical public URLs:
- Support: https://kjappapp.no/help
- Privacy: https://kjappapp.no/personvern
- Terms: https://kjappapp.no/vilkar
- Password reset fallback: https://kjappapp.no/reset-password/:token
- Marketing: https://kjappapp.no

The privacy/terms routes are stable beta URLs. Final legally approved text remains a public-release gate.

## Customer — proposed Norwegian store metadata

Name: **KJAPP**

Subtitle:
**Taxi i Oslo – enkelt og trygt**

Short promotional text:
**Bestill tur, følg sjåføren live og ha hele reisen samlet i KJAPP.**

Description:
KJAPP er en norsk taxi-app bygget for en enkel og oversiktlig reiseopplevelse.

Med KJAPP kan du:
- finne og velge hentested og destinasjon
- se prisestimat før bestilling
- følge tildelt sjåfør og ETA
- få turstatus og varsler
- betale gjennom støttet betalingsflyt
- se turhistorikk, kvittering og vurdering
- kontakte support og bruke sikkerhetsfunksjoner under tur

Oslo-betaen brukes til kontrollert testing med ekte sjåfører og turdata.

Keywords draft:
`taxi,oslo,drosje,transport,tur,ride,taxiapp`

Category suggestion:
**Travel** / secondary category only after App Store Connect review.

## Driver — proposed Norwegian store metadata

Name: **KJAPP Driver**

Subtitle:
**Sjåførappen for KJAPP**

Promotional text:
**Motta turer, naviger til kunden, del ekte GPS og følg inntekt og turhistorikk.**

Description:
KJAPP Driver er den separate arbeidsappen for godkjente KJAPP-sjåfører.

Appen støtter:
- online/offline skiftstatus
- ekte foreground- og background-GPS
- turforespørsler med aksepter/avslå
- rute og ETA til hentested
- ankomst, turstart og fullføring
- kontakt med kunde
- inntektsoversikt og turhistorikk
- varsler og restart recovery

Tilgang gis bare til godkjente sjåførkontoer.

Keywords draft:
`taxi,driver,sjåfør,drosje,oslo,kjapp`

## Beta release notes

### Customer 1.0 beta
- Kontrollert Oslo-beta.
- Forbedret booking- og dispatch-integritet.
- Ekte sjåfør-GPS og ETA under aktiv tur.
- Pushvarsler for viktige turtilstander.
- Betalings-, kvitterings- og ratingflyt.
- Glemt passord / tilbakestilling.
- Personvern, support og kontosletting koblet til faste KJAPP-adresser.
- Stabilitets- og sikkerhetsforbedringer.

### Driver 1.0 beta
- Kontrollert Oslo-beta for godkjente sjåfører.
- Nearest-driver dispatch med serverstyrte tilbud.
- Foreground/background GPS og stale-GPS-beskyttelse.
- GPS-validering ved hentested og destinasjon.
- Pushvarsler, restart recovery og navigasjon.
- Inntekt, historikk og rating.
- Glemt passord / tilbakestilling.
- Stabilitets- og sikkerhetsforbedringer.

## Apple privacy-label preparation

This is a technical inventory, not the final App Store Connect declaration. The responsible publisher must confirm the exact Apple privacy labels against production behavior, retention, legal basis and third-party processors.

Potential data categories to review because the current product handles them:
- contact/account identifiers: email, name, optional phone
- precise location for Customer ride pickup and Driver live/background operation
- user content: chat, support/safety notes and uploaded driver/fleet documents where applicable
- purchase/payment metadata and transaction status (card data itself is handled through Stripe rather than stored as raw card numbers)
- trip history, ratings and operational identifiers
- diagnostics: beta client error message/stack/app version/platform
- authentication identifiers including Apple/Google linkage
- push notification token/device delivery metadata

Review purposes in App Store Connect:
- app functionality
- account management
- payments
- safety/support
- analytics/diagnostics only where actually used

Do not declare advertising/tracking unless production code actually introduces it.

## iOS permission/capability checklist

The first beta is intentionally phone-first. Both Expo configs set `ios.supportsTablet=false`; iPad-specific layout/support can be added later after dedicated QA instead of being implied by the first App Store/TestFlight build.

Customer:
- bundle ID `no.kjapp.app`
- Push Notifications
- Sign in with Apple
- location while in use
- microphone for KJAPP Assist voice feature
- non-exempt encryption declaration already set false in Expo config

Driver:
- bundle ID `no.kjapp.driver`
- Push Notifications
- background location
- background remote notifications
- foreground location service on Android counterpart
- non-exempt encryption declaration already set false in Expo config

Never commit Apple .p8 credentials or signing secrets to Git.

## Screenshot status

Customer:
- App Store 6.7-inch screenshots exist under `frontend/store-assets/`.
- Google Play phone screenshots + feature graphic exist.
- They must be visually re-checked against the current build before public store submission.

Driver:
- Files exist under `driver-app/store-assets/`, but the current files match the Customer assets byte-for-byte.
- Treat them as placeholders/copies, **not approved Driver store screenshots**.
- Capture real current Driver screens (online map, incoming offer, active trip, earnings) before public App Store / Play submission.
- This does not block an internal signed build or TestFlight beta.

## TestFlight gate

Before submitting either app to external TestFlight testers:
1. Beta Gate CI green, or the equivalent `scripts/beta_local_gate.ps1` result is recorded while the GitHub Actions startup issue is unresolved.
2. Signed iOS build succeeds.
3. Correct Apple Team/App IDs/credentials in EAS.
4. APNs capability works.
5. Customer Apple Sign In works on a physical iPhone.
6. Driver background location works on a physical iPhone.
7. New-trip push works with Driver screen locked.
8. One complete physical Customer -> Driver ride succeeds using `docs/PHYSICAL_BETA_QA.md`.
9. Auto-charge remains OFF unless Stripe test E2E has separately passed.

Native GitHub APK/iOS compile workflows are manual-only to avoid redundant builds on every PR update. The explicit EAS beta workflows are the signed-artifact path.

## Public App Store gate

In addition to the TestFlight gate:
- final legal privacy/terms text approved and published
- App Store privacy labels confirmed
- Customer screenshots verified against current build
- real Driver screenshots captured
- support/privacy URLs live
- release notes finalized
- production API hostname decision completed
- payment/settlement test passed
