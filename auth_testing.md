# Emergent Google Auth — Testing Playbook (KJAPP)

## App-specific implementation notes
- App uses **JWT Bearer tokens in localStorage** (`kjapp_token`), NOT session_token cookies.
- Backend endpoint: `POST /api/auth/google/session` with `{session_id}` — exchanges Emergent
  session_id server-side via `https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data`
  (header `X-Session-ID`), then returns the app's own JWT `{token, user}`.
- Existing users are linked by e-mail (role preserved — admin stays admin); new users get role `user`
  with a random unused password.
- Login button: `Login.jsx` → `loginWithGoogle()` — redirect `window.location.origin + "/auth/callback"`,
  no hardcoding/fallbacks.
- Callback: router-level synchronous detection in `App.js` — `location.hash.includes("session_id=")`
  renders `<AuthCallback />` in ALL app modes (main/fleet/admin) before any route guards.
- `AuthContext` skips the initial `/auth/me` check when the URL hash contains `session_id=`.
- Role-based redirect after Google login: superadmin→/loyver, admin→/admin, driver→/driver,
  fleet_owner→/fleet, user→/app.

## Manual test (requires a real Google account — cannot be automated headlessly)
1. Open `{preview_url}/login` → click the Google button (`data-testid="social-google"`).
2. Complete Google sign-in on auth.emergentagent.com.
3. You land back at `/auth/callback#session_id=...` → app exchanges it and redirects by role.
4. Verify `localStorage.kjapp_token` is set and `/api/auth/me` returns the user.

## Automated checks (no real Google needed)
```bash
# 1. Invalid session_id must give 401 (server-side exchange works)
curl -s -X POST {API}/api/auth/google/session -H "Content-Type: application/json" \
  -d '{"session_id":"fake-session-id"}'   # → {"detail":"Ugyldig Google-økt"} (401)

# 2. /auth/callback without session_id redirects to /login (frontend)
# 3. Any route with #session_id=... renders AuthCallback (router-level detection)
```

## Test identities
- No Google test accounts are pre-linked. Any Google account creates/links a user by e-mail.
- To promote a Google-created user to another role, update `role` in MongoDB `users`.
