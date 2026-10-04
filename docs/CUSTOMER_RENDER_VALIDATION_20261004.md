# Customer source validation recovery — 4 October 2026

Signed-in GitHub inspection confirmed that Actions jobs are blocked by recent account payment failure or a spending limit. No job starts, so changing app code cannot repair this account-level block.

Render source validation uses the existing GitHub Customer audit branch and `bash scripts/customer-render-validation.sh`. The command runs 47 isolated backend tests, Customer TypeScript/component tests, Expo Doctor, source API mapping and Android/iOS Hermes exports. It never calls EAS, Gradle or Xcode, supplies no live database/payment credentials, and leaves native build authorization false. Only the minimal summary directory `customer-validation-out` is published.

Deployment result: PASS and live. Render service `srv-db0q908u01pc73bgc6ig`, deploy `dep-db0q90gu01pc73bgc790`, exact source `88f29335676d14390f00c22d33cbe8b3272e3af6`, finished `2026-10-04T00:59:32.900576Z`. The checked terminal build log emitted `SNAR_CUSTOMER_SOURCE_VALIDATION_PASS; NATIVE_BUILD_BLOCKED`. This is source-validation recovery, not approval of native APIs or physical E2E. GitHub Actions remains blocked until account billing is resolved.

Only NODE_VERSION/PYTHON_VERSION were configured in this validation service. No live API secrets were copied into it. Public result.json was subsequently retrieved over HTTP 200 and confirmed the exact source commit, all seven source checks PASS and nativeBuildAuthorized false. Browser access to the onrender.com result URL was blocked by the client; direct HTTP verification succeeded.

## Latest validation and read-only runtime smoke

Source `ecd22ceb414533454e64c8024e0d68674c2b345c`, deploy `dep-db0qj4vavr4c738tve8g`, finished `2026-10-04T01:21:31.361078Z`, status live/PASS. All source checks reran successfully. The new `customer-public-config-smoke.py` only reads public health/readiness/native config endpoints; it prints whitelisted status/booleans, never keys. The safe log confirms database healthy, native Stripe TEST enabled, TEST publishable key present and Google Pay enabled. Google OAuth/email/Apple merchant configuration remains missing. No payment/booking/database mutation is performed, and no API secrets are supplied to the validation runner. Physical E2E and native compilation remain unverified; Customer gate remains closed.
