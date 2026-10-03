# Customer screen audit — 4 October 2026

All rows are PARTIAL until actual native/device acceptance. Source existence is never a PASS. Full requested columns, source lines and API/auth mappings are in the companion JSON.

| Screen | Route | Figma section | Remaining acceptance |
|---|---|---|---|
| Splash | / | Splash.tsx | Cold launch/font/icon screenshot acceptance |
| Permissions | /permissions | Permissions | Grant/reject on physical iOS and Android |
| Login | /login | Login.tsx | Authenticated runtime + rejected credentials/2FA |
| Google login | /login | Login.tsx | P0: provision OAuth clients/package signing; physical login |
| Apple login | /login | Login.tsx | Physical iOS capability/private relay/existing account |
| Register | /register | Login.tsx | Unique email/password/consent runtime acceptance |
| Forgot password | /forgot-password | Not supplied as separate Make screen | P0: email sender and actual delivery |
| Reset password | /reset-password/[token] | Not supplied as separate Make screen | Real email deep link, expired token, session invalidation |
| Legal consent | /legal-consent | Login/setup consent | Native links + server persistence |
| Home/map | /(app)/home | Browse/LiveMap | P0: Mapbox token + native map acceptance |
| Destination search | /(app)/home | Browse | Search latency/zero-results/offline acceptance |
| Recent/favorite locations | /(app)/home | Browse | Verify real customer history; no demo places |
| Saved locations | /saved-places | Profile addresses | CRUD and cross-customer runtime acceptance |
| Ride categories | /(app)/home | Browse; latest tier SVGs | Latest source has Standard/Comfort/Premium/Van/accessible; primary mapping retained. Realistic category renders not supplied/complete |
| Price estimate | /(app)/home | Browse/Confirm | Road geometry/time/fare/service-area live acceptance |
| Booking review | /(app)/home | Confirm | Native keyboard/sheet/layout + exact server fare |
| Booking submit | /booking/[tripId] | Confirm | Real rider/driver runtime; duplicate/lost response |
| Driver matching | /booking/[tripId] | Matching | Real available driver accepts; no timed fake state |
| Driver approaching | /booking/[tripId] | Arriving/DriverCard | Real location/heading/ETA/photo on device |
| Driver arrived | /booking/[tripId] | Arriving | Real at_pickup status and push |
| Active/in-ride | /booking/[tripId] | InRide | Driver-controlled start/end/route progress device E2E |
| Customer-driver chat | /booking/[tripId] | Arriving/InRide chat action | Two-party runtime/retry/keyboard acceptance |
| Safety/SOS/share trip | /booking/[tripId] | InRide/Profile safety | Native call/share and trip-link permissions |
| Active trip minimize | /booking/[tripId] | InRide/Arriving; added required minimized view | Component minimize/reopen/completion verified; device layout/tab sequence pending |
| Active trip reopen | /(app)/home -> /booking/[tripId] | Browse/active trip recovery | Cold restart/background/tab recovery with real active trip |
| Payment methods | /payment-methods | Wallet/Profile payment | P0: Stripe test keys; setup callback device acceptance |
| Google Pay | /receipt/[tripId] | Wallet | P0: keys + enable test Google Pay; Android physical payment |
| Apple Pay | /receipt/[tripId] | Wallet | P0: Merchant ID/certificate/entitlement; iOS physical payment |
| Stripe card | /receipt/[tripId] | Wallet/Receipt | P0: keys; webhook success/duplicate/status reconciliation |
| Receipt | /receipt/[tripId] | Receipt | Real settled trip/receipt; email sender missing |
| Rating | /receipt/[tripId] | Receipt | Duplicate/backend persistence/clean home acceptance |
| Activity/history | /(app)/history | Activity | Completed/live/cancelled route runtime acceptance |
| Profile | /(app)/profile | Profile | Identity error branding updated; live link/device layout pending |
| Customer profile picture | /(app)/profile | Profile avatar | Protected backend tests PASS; camera and authenticated native Image/device reload pending |
| Privacy/GDPR export/delete | /(app)/profile -> /settings | Profile privacy | Photo included and auth-scoped in tests; OS export sharing/erasure acceptance pending |
| Settings | /settings | Profile safety/privacy/language | Network error/retry and update rollback implemented; persistence device acceptance |
| Support | /(app)/profile | Support | Replies/ticket IDs use server; reward redemption unavailable, explicitly reported by UI |
| Notifications/push | all authenticated Customer routes | Permissions | Physical FCM/APNs permission/token/delivery/background acceptance |
| Offline/network errors | all Customer routes | No dedicated Make screen | Transient session failure preserves token; physical outage sequence still pending |
| Profile setup | /profile-setup | ProfileSetup | Real onboarding resume/required data runtime acceptance |
| Wallet | /(app)/wallet | Wallet | Configure Stripe; compare device Wallet screenshot |
| Assist | /(app)/assist | Support AI | Actual model/transcription permissions/runtime acceptance |
| Payment callbacks | /payment/success and /payment/cancel | No dedicated Make screen | Native external-browser return/deep-link/cancel acceptance |
