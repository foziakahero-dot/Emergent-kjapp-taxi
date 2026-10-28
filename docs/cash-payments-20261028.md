# SNAR cash payments — 28 October 2026

Customers can explicitly select **Kontant** at booking without a stored card or an enabled Stripe account. Existing card/Google Pay bookings keep their verified-instrument and reservation requirements. Cash is never selected automatically after a failed card payment.

## Behavior

- `payment_provider=cash` snapshots `payment_flow=cash`, `payment_method=cash` and the existing zero-commission subscription terms. The server prices the trip and starts the existing bounded sequential dispatch with `payment_status=cash_due`.
- The Customer review discloses direct cash collection, including the accepted waiting-fee policy. Cash waiting fees use the accepted, bounded policy; no fake card hold is recorded.
- The Driver offer and active trip identify cash payment. Arrival never marks cash paid or charges a card. Early/GPS-unverified endings keep the existing operator price-review gate.
- Only the assigned authenticated Driver can POST `/api/driver/trip/{trip_id}/cash/confirm` with the exact positive integer `amount_ore`. The trip must be arrived and price review cleared. An atomic transition records who received cash, the amount and timestamp, completes the trip, and releases the driver availability lock. Replays repair the unique cash ledger and existing idempotent receipt delivery.
- Uncollected cash remains visible after remount/restart, including beyond the ordinary 15-minute finished-summary window. New offers/acceptance remain blocked until collection is confirmed. A retry can resume an interrupted cash booking without entering Stripe authorization.
- Customer receipt says cash paid only after Driver confirmation, and never offers a second online payment for the same cash trip. Cash settlement is `driver_collected_cash`; no Stripe charge/transfer/refund is created. Cash earnings are included in earned totals and disclosed separately from pending electronic payouts.

## Configuration and release

`CASH_PAYMENTS_ENABLED` defaults to `true` in this candidate; set it to `false` to hide/reject new cash bookings. This is independent of Stripe mode and native-payment flags. Disabling new cash bookings does not stop existing cash collections. `/api/payments/native/config` publishes `cash_enabled` without exposing secret keys.

This work is based on Launch Candidate `6693e0bc3f792d49f6503cf9d7051ae35f1e508f`. The user explicitly requested this scoped payment addition after the design freeze. There is no redesign or dependency upgrade, and existing historical transactions are not migrated. Production promotion remains separate from the candidate and isolated QA deployment. Existing installed APKs do not gain these new controls automatically.

## Verification

- 555 backend tests and 11 subtests passed. Scope: local `backend/tests/test_*.py`, excluding historical `test_iter*` external-deployment scripts. The separate legacy `backend_test.py` requires a live `REACT_APP_BACKEND_URL` and is not part of this isolated regression run.
- Four actual React component regressions passed: cash selection without card, disable/hide behavior, cash review disclosure, cash receipt without duplicate payment, and Driver collection/review/dismissal behavior.
- Both Customer and Driver TypeScript checks passed. Existing search/notice, native payment import, offer clock and trip-summary checks passed (10 checks). `git diff --check` passed.
- Old AST-isolated arrival/receipt fixtures now import the actual `is_cash` helper; their assertions and safety rules are unchanged.
- Tests use synthetic local accounts/Mongo data and provider adapters. No real ride, cash receipt, Stripe payment, transfer or refund was created. Native device/full Customer–Driver runtime verification remains outstanding; this document is not QA result A and authorizes no APK/AAB/IPA/TestFlight build.
