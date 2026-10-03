# KJAPP Figma Make comparison — 2026-10-02

Source: Figma Make `y94k21wsXX8d9sI966cOAY`, root `0:1`.
Rule: Figma is visual/motion source of truth. Existing KJAPP APIs are runtime source of truth. Demo data from Make must never be shipped.

## Comparison matrix

| Area | Figma Make target | Native KJAPP on this branch | Status |
|---|---|---|---|
| Global palette | ice `#F4F6FA`, navy `#001F3F`, red `#FF0000`, green `#12B981` | Customer + Driver tokens aligned | IMPLEMENTED |
| Typography | Inter 400/500/600/700 + JetBrains Mono | Customer + Driver themes switched from Geist to Inter; JetBrains Mono retained | IMPLEMENTED, BUILD NOT YET VERIFIED |
| Brand mark | red gradient squircle, double forward chevron | mark gradients and native KJAPP mark aligned | IMPLEMENTED |
| Splash motion | pulse rings + subtle vertical float | Customer + Driver native Animated pulse/float | IMPLEMENTED |
| Customer login | gradient light shell, centered mark, Apple + Google, labeled fields, red pill CTA | hierarchy, labels, background and red gradient CTA aligned; real native auth retained | IMPLEMENTED |
| Customer Home | full-screen map, floating destination search, location FAB, rounded bottom sheet | ported; real location and real nearby vehicles retained | IMPLEMENTED |
| Search | full-screen white search, explicit Avbryt, clear control | ported; real places API retained; voice entry kept as existing KJAPP capability | IMPLEMENTED |
| Ride selection | vertical vehicle rows, selected soft-red state, visible CTA | ported; backend vehicle prices retained | IMPLEMENTED |
| Confirm ride | separate review screen, route card, fare card, payment row, red pill CTA | ported; real estimate/payment data retained | IMPLEMENTED |
| Matching | map + dim layer + centered white spinner card | ported, 900ms linear red ring + KJAPP mark | IMPLEMENTED |
| Driver arriving (customer) | top ETA surface + verify driver/car bottom sheet + call/message | ported; real driver/photo/car/plate/rating/ETA retained | IMPLEMENTED |
| Customer in ride | persistent top trip banner + map + bottom action surface | ported; share/chat/SOS use real APIs | IMPLEMENTED |
| Customer receipt | automatic-paid status + compact fare card + rating + Done | ported; unresolved Stripe payment flow retained | IMPLEMENTED |
| Receipt support shortcuts | praise / report / lost item | no verified matching production routes were found in this pass | INTENTIONALLY NOT FAKED |
| Nearby map cars | red forward marker + glow + heading rotation | native marker family aligned; real backend `heading` still drives rotation | IMPLEMENTED |
| User map marker | red pulse/glow visual | customer/driver map marker recolored to Figma red family | IMPLEMENTED |
| Driver login | driver-only shell, labeled fields, navy pill CTA, invite-only note | ported; approved-driver backend gate retained; social buttons removed from this surface | IMPLEMENTED |
| Driver dashboard offline | light gradient, earnings/stats, online action | state-specific native surface uses real summary data | IMPLEMENTED |
| Driver dashboard online | live map, floating identity/toggle, bottom waiting sheet | ported without fake demand heatmap or simulated-request button | IMPLEMENTED |
| Driver incoming request | dim live map, 30px sheet, countdown, fare/route, decline/accept | ported using real pending offer + expiry + route data | IMPLEMENTED |
| Driver decline reasons | reason sheet | ported; existing decline endpoint used because backend has no reason payload contract | IMPLEMENTED UI |
| Driver to pickup | top navigation surface + passenger bottom sheet | ported; real navigation/chat/phone retained | IMPLEMENTED |
| Driver pickup | verify passenger + destination + start action + no-show | ported; real no-show backend checks retained | IMPLEMENTED |
| Driver in trip | top navigation surface + action sheet + end action | ported; real navigation/chat/SOS retained | IMPLEMENTED |
| Driver complete | earnings/status summary + pause / continue online | ported using real paid/estimated state; no demo earnings | IMPLEMENTED |
| Separate permission/setup screens | Figma Make contains onboarding stages before app | production currently requests permissions in runtime flows; dedicated visual port not completed in this branch yet | OPEN |
| Customer register/forgot/reset | Make contains dedicated flows | existing production routes remain; not yet screen-by-screen re-skinned in this branch | OPEN |
| Driver forgot/reset | Make contains dedicated flows | existing route remains; login screen ported, forgot/reset screens not yet screen-by-screen re-skinned | OPEN |
| Same-size screenshot diff | native capture vs Figma reference at identical dimensions | cannot be completed until native app builds/runs | BLOCKED BY BUILD |
| Android/iOS build | must compile after port | GitHub Actions starts no jobs and returns `startup_failure` | BLOCKED — NOT VERIFIED |

## Non-regression rules

- Do not replace FastAPI/Mongo trip state with Figma demo state.
- Do not use Figma's random nearby cars; use `carsApi.nearby`.
- Do not hard-code Figma driver names, plates, ETA, fares, earnings or demand.
- Do not remove payment reconciliation, GPS freshness, no-show rules, safety, chat, native push, driver approval, or fleet ownership rules for visual parity.
- No PR may be marked pixel-perfect or merge-ready until a native render has been compared at the same viewport dimensions and Android + iOS build gates are green.

## Build evidence

Latest checked PR workflow reached `completed/startup_failure` with zero jobs. This is infrastructure/startup failure, not a passing or failing TypeScript/native build. Source structure and style-reference checks were run on the modified files, but that is not a substitute for compilation.
