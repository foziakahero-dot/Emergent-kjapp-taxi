# KJAPP Store / TestFlight Release Pack

This file prepares release metadata and credentials without changing the existing Customer/Driver visual design.

## App identities

### Customer
- Product name: KJAPP
- Bundle ID: `no.kjapp.app`
- Android package: use the existing value in `frontend/app.json`
- Production API target: `https://api.kjappapp.no`
- Closed TestFlight beta may use the current Emergent beta API profile.

### Driver
- Product name: KJAPP Driver
- Bundle ID: `no.kjapp.driver`
- Android package: use the existing value in `driver-app/app.json`
- Production API target: `https://api.kjappapp.no`

## Apple capabilities

Customer:
- Sign in with Apple
- Push Notifications

Driver:
- Push Notifications
- Background location modes
- Background remote notifications

APNs credentials belong in Apple/EAS credentials. Never commit .p8 keys to Git.

## TestFlight build path

GitHub workflow: `.github/workflows/eas-ios-release.yml`

Inputs:
- Customer / Driver / all
- optional submit to TestFlight

Required external secret:
- GitHub `EXPO_TOKEN`

Required EAS/Apple account state:
- App IDs created for both bundle IDs
- distribution signing/provisioning available
- APNs configured
- App Store Connect records created before submission

## Android beta path

GitHub workflow: `.github/workflows/eas-android-beta.yml`

Goal:
- Customer APK
- Driver APK

Both beta builds use the same beta backend.

## Draft store copy

### KJAPP
**Short description**
Norsk taxi med tydelig bestilling, live turstatus og sikker betaling.

**Beta release note**
Første kontrollerte KJAPP-beta i Oslo. Bestilling, sjåførtildeling, live posisjon, turstatus, betaling, kvittering og support testes med et begrenset antall brukere og sjåfører.

### KJAPP Driver
**Short description**
KJAPP-appen for godkjente sjåfører og aktive turer.

**Beta release note**
Første kontrollerte Driver-beta. Turtilbud, GPS, bakgrunnsposisjon, navigasjon, hentestatus, turfullføring og inntektsoversikt testes i Oslo.

## Screenshot capture list — no redesign

Capture the existing app exactly as implemented.

Customer:
1. Home/map with destination search
2. Vehicle/price selection
3. Searching for driver
4. Driver assigned/live ETA
5. Active trip
6. Receipt/rating
7. Profile/payment methods

Driver:
1. Offline dashboard
2. Online map
3. New ride offer
4. Driver on way to pickup
5. At pickup
6. In trip/navigation action
7. Ride completed/earnings
8. Driver profile/settings

Use real-looking controlled beta data but no personal data belonging to real testers.

## Privacy / legal publication gate

Do not mark the public App Store/Play release ready until:
- final privacy notice is legally approved and published at `https://kjappapp.no/personvern`
- final terms are approved and published at `https://kjappapp.no/vilkar`
- App Store privacy labels / Google Data safety answers are reviewed against actual code and vendors
- processor/vendor disclosures cover MongoDB hosting, Stripe, Expo push/APNs/FCM, maps/geocoding, email and any AI provider actually enabled

The repository currently uses stable legal URLs, but placeholder beta legal pages are not a substitute for final approval.

## Production API rule

Do not ship long-lived public store builds hard-coded to the Emergent hostname.

Before public store release:
1. establish `https://api.kjappapp.no`
2. initially point/proxy it to the known-good backend if needed
3. make production mobile/web profiles use that hostname
4. later migrate backend infrastructure behind the same hostname

## Final store gate

- signed Customer iOS build installed on real iPhone
- signed Driver iOS build installed on real iPhone
- Customer Android APK installed on real Android
- Driver Android APK installed on real Android
- physical QA checklist passes
- Stripe test cases pass
- push/background GPS pass
- legal/privacy gate approved
- backend release smoke passes
- PR merged only after release gate
