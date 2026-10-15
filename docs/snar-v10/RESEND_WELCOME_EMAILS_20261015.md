# SNAR transactional welcome email integration

## Implemented
- Render/FastAPI sends through Resend's HTTPS API with a server-only key, 15-second timeout and a stable hashed idempotency key. Existing SendGrid configuration is retained unless EMAIL_PROVIDER explicitly selects Resend.
- New customer registrations (password, native Google/Apple and existing web social routes) persist a welcome_email_pending marker with the account. A worker converts it to one durable outbox job per account and can recover after a crash. Existing customers are not backfilled.
- Beta form submissions already feed /marketing/waitlist and the durable outbox. The message now welcomes the user to the beta interest list without claiming an active account or immediate access. The website requires an email address so a confirmation can be sent. Older API clients may still register phone-only interest without email.
- Superadmin can configure Resend through the existing encrypted, write-only integration settings. No key is exposed to mobile/web clients.
- QA remains unable to send external email. Queued/sent states are not inbox-delivery guarantees. Actual sending and sender-domain verification remain to be completed.

## Activation in the production Render API
Configure RESEND_API_KEY in Render's secret environment or the encrypted superadmin integration form. Set RESEND_FROM_EMAIL to the actual verified sender address and EMAIL_PROVIDER=resend. Do not paste secrets into chat or source code.

Resend requires account access and sender-domain verification. Use the exact DNS records supplied by the Resend dashboard; do not invent SPF/DKIM values or overwrite unrelated mail records. Review pending outbox jobs before enabling delivery, because existing queued onboarding confirmations can then be retried.

Production API code must be deployed deliberately with its matching environment. This source branch is based on the current customer-fix branch; it is not proof that the old production Render branch contains these endpoints. No deployment, domain/DNS change, provider-key write or real message send has occurred during implementation.

## Message copy
**Customer subject:** Velkommen til SNAR

Kundekontoen din er opprettet. Du kan nå logge inn i SNAR-appen med innloggingsmetoden du valgte. Tilgjengelige biler og tjenester avhenger av området du befinner deg i. Vi gleder oss til å ha deg med.

**Beta subject:** Velkommen til SNAR-betaen

Takk for at du vil teste SNAR! Interessen din er registrert. Vi sender informasjon om tilgang når neste testgruppe åpner. Dette er en bekreftelse på registreringen, ikke en aktiv brukerkonto.

## Verification
Provider request/response handling, idempotency, missing sender, QA suppression, queue recovery, duplicate beta submissions and password-registration welcome intent tested without network delivery. Existing onboarding, waitlist, auth, integration settings and provider isolation tests also pass. Admin and marketing production builds pass.

## Current blocker
Resend dashboard is reachable but requires sign-in. Google Cloud's unrelated access problem does not block the Resend implementation. No Resend domain or key has yet been verified in the user's account.
