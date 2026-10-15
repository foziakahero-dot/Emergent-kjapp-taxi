# Fleet v2 source reconciliation and Customer 02/06

The user supplied the actual current Make ZIP on 14 October 2026. The unchanged uploaded ZIP remains the source archive. `reference/fleet-v2-20261014/manifest.json` records SHA-256 hashes and all screen IDs. The raw design source and new reference screenshots are retained locally, not published into this public repository.

## Verified scope of the source difference

The source lists are unchanged: Customer 36 states; Driver 30 states numbered 01–31 with 08–09 combined. `kit.tsx` is byte-identical to the earlier reference. CustomerApp differs only in home/returning 02/06, adding Reisestudio and moving the map tools. DriverApp differs only in offline home 04, adding Skiftstudio and its personal goal. The new shared signature stylesheet changes sheets, docks, inputs and primary actions. Customer 19–34 screen-specific source remains unchanged; its previous checkpoints do not need to be discarded. Native acceptance remains separate.

## Customer checkpoint

- Adds SNAR PERSONAL, the two-line source headline, launch card, Reisestudio modal, orbit, style selector and summary/actions. The rendered source's actual CSS cascade determines the 44px inverse studio actions, not a guessed red 56px action. The launch card uses the source 120-degree gradient; shared sheets use 165 degrees.
- The confirmed style updates the real Standard/Premium class selection and opens actual destination search. Draft selection and cancel cannot change a trip or submit a booking. Comfort remains disabled because the canonical class does not exist. ETA comes from the real per-class supply; no demo ETA is used in app code.
- The home map tools follow the measured sheet height. The modal provides selected tab semantics, cancel/back handling, serialized apply, failure/retry and unmount protection. Existing payment, consent, dispatch and private-photo contracts remain.
- Applies new-source shared Customer dock border, primary shadow, sheet gradient and auth/home/chat/AI input borders.

## Validation

Customer TypeScript and existing component/controller suites pass, including the new studio draft/cancel/apply/failure/duplicate checks. Original source and actual React Native Web components were rendered with the bundled Geist fonts. Light/dark home and studio fixtures have no JavaScript errors. Source studio height is 274.28125px; native-web studio height is 274.3125px at 330px content width. Home and studio frames were inspected. Fixtures use sample data and omit actual native map/OS/provider rendering; this is not full-screen native pixel certification.

Next: preserve/reconcile the uncommitted planned-trip layout, complete Customer state mapping, then Driver studio and remaining Driver differences. No APK, merge, production rollout or provider reconfiguration is requested in this continuation.
