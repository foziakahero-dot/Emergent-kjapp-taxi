# Internal Android APK request — 4 October 2026 (Europe/Oslo)

The user explicitly requested starting Customer and Driver APK builds via Render or directly. Internal Android builds are authorized for device testing while documented readiness checks remain open. This does not authorize store submission, native iOS builds or a production PASS.

Source base: 72e162f03da5c8b9c282d64616ea957afe5f08c6 (Customer PR #67).
No new Claude Driver branch was present in the inspected branch list. Driver implementation is retained at this source.

Customer profile apk-internal-20261004 extends the existing internal APK profile, selects preview and Node 22.16.0. Only the exact Android profile and dated authorization can continue through the Customer quality gate; default apk, production and iOS stay blocked. No check is rewritten to PASS.

Backend target: https://api.kjappapp.no. Existing TEST Stripe/native/Google Pay config is enabled in the API. Google OAuth, Mapbox token, email, physical payments/wallets and end-to-end device acceptance remain unverified/missing. The APK must not be described as production ready.

Direct EAS/GitHub builds are preferred because GitHub Actions billing prevents jobs from starting and the earlier Render native APK runs failed. Existing Expo credentials are retained; no secret is placed in Git.
