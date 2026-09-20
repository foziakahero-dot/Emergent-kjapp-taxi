# KJAPP landing – production readiness

Scope: `marketing-web/` only. No Customer, Driver, Admin, Fleet or payment-system redesign is part of this change.

## Audit

- Runtime: Vite + React + TypeScript, deployed from the `kjapp-home-beta` Vercel project.
- Public root: `src/PremiumHome.tsx`.
- Partner/application routes remain unchanged.
- Existing Android/iOS beta URLs are environment-driven.
- Existing SEO helper already supported per-route canonical/meta tags.
- No marketing analytics provider is installed, so this pass does not introduce one.
- No production privacy/terms pages exist in `marketing-web`; this change does not fabricate legal text.

## Production-readiness changes

- Primary landing CTAs use “Få tilgang til beta” and open the accessible waitlist modal.
- Waitlist success is only shown after `POST /api/waitlist` confirms delivery.
- The Vercel function validates inputs and forwards server-side to the approved receiver.
- Webhook URL/secret never enter the browser bundle.
- Missing webhook configuration returns 503; there is no fake success.
- Android/TestFlight links remain disabled/status-only unless their public env URLs are configured.
- Cookie choice is persisted locally. No optional analytics is currently loaded.
- Canonical, Open Graph, Twitter/X metadata and web manifest are present.
- Vehicle imagery and the approved premium landing visual identity are preserved.

## Required Vercel environment

Server-side only:

```
WAITLIST_WEBHOOK_URL=https://...
WAITLIST_WEBHOOK_SECRET=...
```

Public only when real distribution links exist:

```
VITE_ANDROID_BETA_URL=https://...
VITE_IOS_TESTFLIGHT_URL=https://...
```

Never prefix the webhook secret with `VITE_`.

## External release blockers

1. An approved HTTPS waitlist receiver and secret must be configured before waitlist signup can succeed.
2. Privacy/terms text must be approved by the responsible company before dedicated legal pages are published.
3. Android/TestFlight URLs must only be configured after those builds are actually available.

## Validation gate

The PR must stay unmerged until the latest Vercel preview is READY. A READY Vercel build runs the project's `npm run build`, which includes `tsc --noEmit && vite build`.

The repository currently has no marketing-web lint or test script. Do not report lint/tests as passed when no such command exists.
