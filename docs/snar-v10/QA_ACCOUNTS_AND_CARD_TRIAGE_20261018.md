# QA login, Stripe investigation and physical test accounts — 2026-10-18

- QA API: https://api-qa.snarapp.no; Render srv-db61otlckfvc73bqp480, paid 0.5c-512mb compute.
- QA deployment dep-dbaitamq1p3s73brlkn0 is live at ef013881e1d246a1e52a9dc030aa83d7ed6abd75.
- Reported Driver login at 20:31 UTC returned HTTP 401. Exact account/password/role mismatch is not distinguishable from this response. Password-login-specific messaging corrected in ef01388; Driver TypeScript passed. Existing APK does not include this text correction.
- Created two persistent customers and two persistent approved internal QA drivers. All four correct-client logins passed. Driver vehicles are SNAR01/Tesla Model Y and SNAR02/Volkswagen ID.4. Both drivers passed online and offline HTTP 200 and were left offline.
- Internal ride allowlists now target the newly created four accounts. Previous internal-test account allowlists are replaced. Synthetic driver fixtures are not production identity/document approval. Seed switch disabled after provisioning to avoid resetting accounts on later deployments. Credentials delivered privately in the conversation, never committed.
- Customer account IDs: 6ad52dfbff9339a4b580d14d, 6ad52e0fff9339a4b580d14e. Driver account IDs: 6ad52e73555f7c220a0a351a, 6ad52e73555f7c220a0a351c.
- Stripe native configuration enabled in test mode. Both customer SetupIntent creations passed. Actual Stripe retrieval with configured publishable key passed: livemode=false, status=requires_payment_method. This verifies key/account alignment, NOT native PaymentSheet presentation, card confirmation or completed payment. User's card-add failure remains unreplicated; need exact screenshot/error from customer app.
- No new APK/IPA build or production modification. Driver Google button is still present in installed source; no removal claimed.
