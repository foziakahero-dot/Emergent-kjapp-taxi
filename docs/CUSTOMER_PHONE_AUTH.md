# Customer phone authentication

Customer phone login uses Twilio Verify in the existing FastAPI/MongoDB backend.
Driver remains invite-only with no public OTP registration or social signup.

## Configuration

QA uses only these dedicated variables:

- `QA_CUSTOMER_OTP_ENABLED=true`
- `QA_CUSTOMER_OTP_SIGNUP_ENABLED=true` when registration is ready for QA
- `QA_TWILIO_ACCOUNT_SID`
- `QA_TWILIO_AUTH_TOKEN`
- `QA_TWILIO_VERIFY_SERVICE_SID`

Production uses the same names without `QA_`. Keep the QA Verify service
separate from production. Never commit their values. Configure Norway delivery,
provider fraud protection and account spending limits before real SMS testing.

`GET /api/auth/customer/otp/config` reports whether login and signup are enabled
and supplies the current legal version. Both features remain off when provider
credentials are absent. Signup has an additional explicit feature flag.

## Flow and account ownership

Old clients send only a phone number and can log in to an existing, unique
Customer account. They do not create accounts for unknown numbers.

New clients can explicitly select phone registration, provide a name/email and
accept the current terms. These details are stored in a five-minute challenge;
no account or login session is created until Twilio approves the bound code.
An existing phone logs into its original Customer account without overwriting
name/email. An unknown phone creates only role `user`. Existing email accounts
are not silently linked or taken over. Email remains unverified by SMS.

`phone_e164` is the canonical verified login number. A partial unique index
protects Customer phone identities, while legacy formatting is supported until
the first successful verification. Editing a display phone does not replace a
verified login number. Concurrent signup, duplicate legacy phones, replayed or
expired challenges, disabled accounts and second-factor requirements are checked.

## Validation before enabling

Run `backend/tests/test_customer_otp.py` and
`scripts/customer-phone-signup-ui.test.cjs`. Tests isolate the provider and never
send SMS. After provider setup, test a permitted phone with a controlled SMS
budget, verify signup and an existing account, and check that invalid codes and
replays fail. SMS config flags alone do not prove real delivery.
