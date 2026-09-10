/** KJAPP-owned Google Sign-In (OAuth 2.0 Authorization Code + PKCE).
 *  The client secret lives ONLY in the backend — the browser never sees it.
 *  REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
 */
const VERIFIER_KEY = "kjapp_google_verifier";
const STATE_KEY = "kjapp_google_state";

const b64url = (bytes) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export const googleRedirectUri = () => window.location.origin + "/auth/google";

export async function startGoogleLogin(clientId) {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = b64url(new Uint8Array(digest));
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/** Returns the PKCE verifier once, and only when the returned state matches (CSRF guard). */
export function consumeGoogleFlow(returnedState) {
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  const state = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  if (!verifier || !state || !returnedState || state !== returnedState) return null;
  return verifier;
}
