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

The following non-secret settings are proposed for the QA domain in the supplied
API key's team. That domain is not verified yet; do not enable sending:

| Setting | QA value |
| --- | --- |
| QA_RESEND_FROM_EMAIL | SNAR QA <post@qa-notify.snarapp.no> |
| QA_RESEND_WELCOME_FROM_EMAIL | SNAR QA <velkommen@qa-notify.snarapp.no> |
| QA_RESEND_SECURITY_FROM_EMAIL | SNAR QA <sikkerhet@qa-notify.snarapp.no> |
| QA_RESEND_RECEIPTS_FROM_EMAIL | SNAR QA <kvittering@qa-notify.snarapp.no> |
| QA_RESEND_REPLY_TO | post@snarapp.no |
| QA_RESEND_ENABLED | false until credential, billing and controlled delivery checks are complete |

`QA_RESEND_API_KEY` must be stored only in Render secrets. Use an existing key from
the same Resend team with sending permission for `qa-notify.snarapp.no`. Never copy
the value into this repository, the QA status log, a screenshot or chat. Do not
create a broadly privileged replacement merely to fix a sender-domain mismatch.

Every QA email has `[QA]` in its subject. QA does not inherit any production
sender, reply address or credential. If a type-specific sender is absent, its
environment's default sender is used. Malformed address configuration fails the
send instead of generating a request with injected headers.

Production uses the root domain `snarapp.no`, expressly selected by the owner.
A read-only API check on 31 October 2026 confirmed the previously supplied key
works, but belongs to a different team from the browser session used on 30 October.
That key's team had `qa-notify.snarapp.no` with status `failed`, and no root domain.
`snarapp.no` has now been created in the key's actual team (HTTP 201), in Ireland
(`eu-west-1`), with status `not_started`. No incoming mail handling was enabled.
Do not use the other team's domain/DNS instructions with this key.

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

The domain created in the supplied API key's team returned these four records
on 31 October 2026. They supersede the other team's three-record instructions:

| Type | Name relative to snarapp.no | Content | Priority |
| --- | --- | --- | --- |
| TXT | resend._domainkey | Use the public DKIM value below | — |
| MX | send | feedback-smtp.eu-west-1.amazonses.com | 10 |
| TXT | send | v=spf1 include:amazonses.com ~all | — |
| CNAME | rsend | send.forge.rmta.net | — |

Public DKIM value for this domain in the supplied key's team:

```text
p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDYIaiie68DMYmv/VrRnui/86XPZfW/QH9hJckudsveXXie58U8efqMVijeWRmKAcpCUPRKVVTVr9+H71XxrnhNgw7RzFKMkpz8iZsxVSVhT4SSD4JkJAFUUwNOSOOADYGeN43xazT9XlL0Dh5P8hrOLthvs25QCyxro25KMcvLrwIDAQAB
```

Preserve the root MX and SPF records for Uniweb and all web/API/QA records.
These MX/TXT entries belong to the `send` subdomain, not the root domain. Do not
install a CNAME at `send` alongside these MX/TXT records. Do not add the old
`rsend-euw1.forge.rmta.net` target from the other team's setup.

No DNS edit has been made. The 30 October Uniweb login was rejected; the new
secure sign-in on 31 October was declined before submission. After an authenticated
DNS update, verify this exact domain in this exact team and check its actual
result rather than assuming propagation.

Render QA was inspected on 31 October with explicit owner approval. All 37
service variable names were visible; no `QA_RESEND_*`, `RESEND_*` or
`EMAIL_PROVIDER` variables were present, and no environment groups were linked.
No secret values were revealed. Runtime ready still reported
`email_configured=false`. No Render variables were changed and no new deploy
was started during this inspection.

The USD 20 unpaid invoice previously observed belonged to the other browser
team. It is not verified billing evidence for the supplied key's team. No
payment or subscription change was performed. Real provider send acceptance,
account sending limits and inbox delivery remain unverified.

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
