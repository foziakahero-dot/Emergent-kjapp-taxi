# SNAR landing – production readiness

Scope: `marketing-web/` only. No Customer, Driver, Admin, Fleet or payment-system redesign is part of this change.

## Audit

- Runtime: Vite + React + TypeScript, deployed from the `kjapp-home-beta` Netlify project.
- Public root: `src/PremiumHome.tsx`.
- Partner/application routes remain unchanged.
- Existing Android/iOS beta URLs are environment-driven.
- Existing SEO helper already supported per-route canonical/meta tags.
- No marketing analytics provider is installed, so this pass does not introduce one.
- No production privacy/terms pages exist in `marketing-web`; this change does not fabricate legal text.

## Production-readiness changes

- Primary landing CTAs use “Få tilgang til beta” and open the accessible waitlist modal.
- Waitlist success is only shown after `POST /api/waitlist` confirms persistence.
- The Netlify proxy validates inputs and forwards server-side to the existing SNAR API.
- The SNAR backend stores beta interest idempotently in MongoDB (`beta_waitlist`).
- Duplicate submissions return the same generic success response and do not create duplicate records.
- A honeypot and a Mongo-backed global rate limit protect the public intake without client-side secrets.
- Android/TestFlight links remain disabled/status-only unless their public env URLs are configured.
- Cookie choice is persisted locally. No optional analytics is currently loaded.
- Canonical, Open Graph, Twitter/X metadata and web manifest are present.
- Vehicle imagery and the approved premium landing visual identity are preserved.

## Netlify environment

The waitlist proxy defaults to the current SNAR API. Override only if the backend URL changes:

```
SNAR_API_BASE_URL=https://api.kjappapp.no/api
```

Public only when real distribution links exist:

```
VITE_ANDROID_BETA_URL=https://...
VITE_IOS_TESTFLIGHT_URL=https://...
```

## External release blockers

1. The branch backend containing `/api/marketing/waitlist` must be deployed before the preview can persist real signups.
2. Privacy/terms text must be approved by the responsible company before dedicated legal pages are published.
3. Android/TestFlight URLs must only be configured after those builds are actually available.

## Validation gate

The PR must stay unmerged until the latest Netlify preview is READY. A READY Netlify build runs the project's `npm run build`, which includes `tsc --noEmit && vite build`.

The repository currently has no marketing-web lint or test script. Do not report lint/tests as passed when no such command exists.
