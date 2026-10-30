# SNAR transactional email

Resend is the sending provider. The backend already queues one welcome message
for a newly created customer (password, Google or Apple), retries onboarding
notifications, and sends receipts only after confirmed payment. A welcome message
confirms account creation; it is not email ownership verification. Failed delivery
does not prevent account creation. Existing role, payment and identity checks stay
in force. Password-reset delivery in QA remains disabled by the existing QA guard.

## Senders and replies

Resend can send from different addresses under a verified sending domain without
creating separate mailboxes. Human replies should go to the existing monitored
Uniweb mailbox. Do not change the root domain's incoming MX records or replace
Uniweb mail hosting to enable transactional sending.

The following non-secret settings are prepared for the verified QA domain:

| Setting | QA value |
| --- | --- |
| QA_RESEND_FROM_EMAIL | SNAR QA <post@qa-mail.snarapp.no> |
| QA_RESEND_WELCOME_FROM_EMAIL | SNAR QA <velkommen@qa-mail.snarapp.no> |
| QA_RESEND_SECURITY_FROM_EMAIL | SNAR QA <sikkerhet@qa-mail.snarapp.no> |
| QA_RESEND_RECEIPTS_FROM_EMAIL | SNAR QA <kvittering@qa-mail.snarapp.no> |
| QA_RESEND_REPLY_TO | post@snarapp.no |
| QA_RESEND_ENABLED | false until credential, billing and controlled delivery checks are complete |

`QA_RESEND_API_KEY` must be stored only in Render secrets. Use an existing key from
the same Resend team with sending permission for `qa-mail.snarapp.no`. Never copy
the value into this repository, the QA status log, a screenshot or chat. Do not
create a broadly privileged replacement merely to fix a sender-domain mismatch.

Every QA email has `[QA]` in its subject. QA does not inherit any production
sender, reply address or credential. If a type-specific sender is absent, its
environment's default sender is used. Malformed address configuration fails the
send instead of generating a request with injected headers.

Production uses the root domain `snarapp.no`, expressly selected by the owner.
It was added to the existing Resend team on 30 October 2026 in Ireland
(`eu-west-1`). Its DNS verification is not yet complete. The existing QA domain
is separate and verified. No incoming mail handling was enabled in Resend.

| Setting | Production value after domain verification |
| --- | --- |
| EMAIL_PROVIDER | resend |
| RESEND_FROM_EMAIL | SNAR <post@snarapp.no> |
| RESEND_WELCOME_FROM_EMAIL | SNAR <velkommen@snarapp.no> |
| RESEND_SECURITY_FROM_EMAIL | SNAR <sikkerhet@snarapp.no> |
| RESEND_RECEIPTS_FROM_EMAIL | SNAR <kvittering@snarapp.no> |
| RESEND_REPLY_TO | post@snarapp.no |

These settings are not applied to production. The addresses are planned sending
identities, not newly created incoming inboxes. Store `RESEND_API_KEY` securely in
the production service only when its sending permission/domain are confirmed and
the production release is separately authorized.

### Required root-domain DNS records

The newly created Resend domain's live DNS instructions require:

| Type | Name relative to snarapp.no | Content |
| --- | --- | --- |
| TXT | resend._domainkey | Copy the public DKIM value from this domain's Resend DNS page |
| CNAME | rsend | rsend-euw1.forge.rmta.net |
| CNAME | send | send.forge.rmta.net |

The three names returned NXDOMAIN in the public DNS check on 30 October. The
root MX records still point to Uniweb; the root SPF still authorizes Uniweb.
Preserve those records and all web/API/QA records. Do not add an extra root SPF
record or replace root MX records. Uniweb login rejected the attempted secure
sign-in; no DNS edit was made. After an authenticated DNS update, use Resend's
verification control and check the actual result instead of assuming propagation.

The existing Resend account also shows an unpaid invoice (open, USD 20, dated
22 May 2026) and a disruption warning. No payment, retry or plan change has been
performed. This may restrict delivery; it does not itself prove current sending
is suspended. No controlled provider send or real inbox delivery is verified.

## Activation and acceptance

1. Verify sending-domain status in the actual Resend team and resolve any billing
   restriction through the owner's billing flow. Domain verification alone does
   not prove the API key or account can send.
2. Store/confirm the correct existing QA key securely. Keep sending off until ready.
3. Review pending onboarding jobs, invitation retries and receipt jobs before
   activation. Enabling the workers can deliver existing queued messages; do not
   assume it affects only future registrations or initiate an unreviewed mailout.
4. Activate QA sending and deploy the intended QA commit. Check health/ready and
   commit. `email_configured=true` proves configuration presence, not delivery.
5. Use an explicitly chosen owner-controlled QA recipient for one controlled new
   registration and welcome. Check provider acceptance, actual inbox delivery,
   From, Reply-To and repeated signup/idempotent delivery. Test a paid QA trip's
   receipt separately. Neither local transport fixtures nor a compiled APK proves
   actual email delivery.
6. Do not reset customer accounts, send historical bulk mail, create a new paid
   subscription, promote production or rebuild mobile apps as part of this setup.

No marketing audience, campaigns, new subscription, incoming mailbox or general
customer-support system is created by these settings.
