# SNAR V10 final QA release reconciliation — 15 October 2026

Release source rules:

- Customer and Driver V10 screen source is PR #101 / `implementation/snar-v10-screens-20261013` at `9976fc0931cab4987b8dad8c444d03f84bdb3e57`.
- QA release base is `qa/snar-v10-phase5-staging-e2e` at `9ed8805b3f420a8714af9d056c4e447a9fab4348`.
- Canonical QA backend remains `https://api-qa.snarapp.no`; production API is not permitted for the `qa` EAS profile.
- Customer and Driver paid-beta EAS workflows are manual only; a Git push must not start a paid native build.
- The Driver auth reconciliation preserves V10 Google/Apple session handling plus transient Render/backend wake retries and role/approval enforcement.
- QA Google/Apple native authentication remains provider-blocked until QA-specific OAuth configuration is enabled server-side; this is not represented as verified.
- No APK, iOS/TestFlight or production deployment is certified by this document. Build artifacts must be generated from the final reconciled merge SHA only.
