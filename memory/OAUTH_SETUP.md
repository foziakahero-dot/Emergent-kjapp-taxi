# KJAPP — egen (KJAPP-eid) Google- og Apple-innlogging

Alt er bygget **nøkkel-valgfritt**: uten nøkler er knappene inaktive og viser
«ikke konfigurert». Så snart nøklene ligger i backend-miljøet, aktiveres de automatisk.
Ingen client secret ligger noen gang i frontend, og ingen innlogging går via
Emergent-hostet login lenger.

---

## 1. Google Sign-In (egen Google Cloud OAuth-klient)

### Slik virker flyten
1. Kunden trykker Google-knappen i KJAPP → appen bygger en Google-autorisasjons-URL
   med **PKCE** (`code_challenge`) og `redirect_uri = <origin>/auth/google`.
2. Google sender brukeren tilbake til `/auth/google?code=…&state=…` **inne i KJAPP**.
3. Frontend sender `code` + `code_verifier` til **KJAPPs egen backend**
   (`POST /api/auth/google/code`).
4. Backend bytter koden mot tokens hos Google med client secret (kun server-side),
   verifiserer `id_token` mot Googles JWKS (signatur, `aud`, `iss`, `exp`),
   krever `email_verified`, oppretter/kobler konto på `sub` og utsteder **KJAPPs egen JWT**.

### Steg-for-steg i Google Cloud Console
1. Gå til <https://console.cloud.google.com/> → opprett prosjekt, f.eks. `KJAPP`.
2. **APIs & Services → OAuth consent screen**
   - User type: **External**, publiser appen når testingen er ferdig.
   - App name: `KJAPP`, support-e-post, logo (valgfritt).
   - Authorized domains: `kjappapp.no` (legg til alle domener du bruker).
   - Scopes: `openid`, `email`, `profile` (ingen sensitive scopes → ingen Google-review).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**, navn: `KJAPP Web`.
   - **Authorized JavaScript origins** (legg inn alle du bruker):
     - `https://<preview-url>` (Emergent preview, valgfritt for testing)
     - `https://kjappapp.no`
     - `https://admin.kjappapp.no`
     - `https://fleet.kjappapp.no`
   - **Authorized redirect URIs** — alltid `<origin>/auth/google`:
     - `https://<preview-url>/auth/google`
     - `https://kjappapp.no/auth/google`
     - `https://admin.kjappapp.no/auth/google`
     - `https://fleet.kjappapp.no/auth/google`
   - Kopiér **Client ID** og **Client secret**.
4. Legg nøklene i backend-miljøet (deploy-secrets, ikke i kode):
   ```
   GOOGLE_CLIENT_ID=<client id>.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=<client secret>
   ```
5. Restart backend. `GET /api/auth/google/config` skal nå svare `{"enabled": true, …}`
   og Google-knappen i appen blir aktiv.

### Native (iOS/Android via Capacitor) — når appen skal i butikkene
- Opprett i tillegg **Android**-klient (package `no.kjapp.app` + SHA-1 fra signeringsnøkkelen)
  og **iOS**-klient (bundle ID `no.kjapp.app`) i samme prosjekt.
- Native bruker app-link/deep-link som redirect (`https://kjappapp.no/auth/google` via
  Universal Links / Android App Links, eller custom scheme). Web-flyten over er uendret.

---

## 2. Sign in with Apple (egen Apple Developer-konto)

### Steg-for-steg i Apple Developer
1. <https://developer.apple.com/account> → **Certificates, Identifiers & Profiles → Identifiers**
2. **App ID**: opprett/velg bundle ID `no.kjapp.app`, huk av **Sign in with Apple**
   (primary App ID). Dette brukes som `aud` for native iOS-innlogging.
3. **Services ID** (web + Android): `no.kjapp.app.web` (eller tilsvarende)
   - Huk av Sign in with Apple → **Configure**
   - Primary App ID: `no.kjapp.app`
   - Domains: `kjappapp.no` (+ evt. `admin.kjappapp.no`)
   - Return URLs: `https://kjappapp.no/auth/apple` (og tilsvarende for hvert domene)
   - Hvis portalen ber om domeneverifisering: last ned
     `apple-developer-domain-association.txt` og legg den på
     `https://kjappapp.no/.well-known/apple-developer-domain-association.txt`
4. **Keys → + → Sign in with Apple** → last ned `.p8`-filen (kun én gang).
   Noter **Key ID** og **Team ID** (Membership-siden).
5. Legg i backend-miljøet:
   ```
   APPLE_CLIENT_ID=no.kjapp.app.web     # Services ID (web/Android)
   APPLE_BUNDLE_ID=no.kjapp.app         # App ID (native iOS)
   APPLE_TEAM_ID=<team id>
   APPLE_KEY_ID=<key id>
   APPLE_PRIVATE_KEY=<innholdet i .p8, backend-only>
   ```
6. Restart backend → `GET /api/auth/apple/config` svarer `{"enabled": true}` og
   Apple-knappen aktiveres.

### Sikkerhet som allerede er på plass
- `identity_token` verifiseres mot Apples JWKS (RS256, `iss=https://appleid.apple.com`,
  `aud` = Services ID **eller** bundle ID, `exp`).
- Konto slås opp på Apples stabile `sub`. E-post/navn fra klienten brukes **aldri** til
  kontooppslag (ingen kontoovertakelse via påstått e-post).
- Første innlogging krever verifisert e-post fra Apple; private relay-adresser lagres som de er.
- Deaktiverte kontoer avvises (401), både ved innlogging og på eksisterende tokens.

---

## 3. Etter at nøklene er satt — sjekkliste
- [ ] `curl $BACKEND/api/auth/google/config` → `enabled: true`
- [ ] `curl $BACKEND/api/auth/apple/config` → `enabled: true`
- [ ] Trykk Google-knappen → Googles egen samtykkeskjerm → tilbake i KJAPP → innlogget
- [ ] Logg ut → tokenet fjernes lokalt; revokert/utløpt Google-økt gir ny samtykkeskjerm
- [ ] Slett konto (GDPR) → brukeren kan logge inn på nytt og får ny konto
