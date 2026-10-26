import { AuthRequest, ResponseType } from 'expo-auth-session';
import { randomUUID } from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();
let pending = false;

export async function googleIdentity(config: { google_web_client_id: string; google_ios_client_id?: string }, _action: 'signin' | 'link' = 'signin'): Promise<string | null> {
  if (pending) throw new Error('Google-innlogging pågår allerede.');
  const clientId = String(config?.google_web_client_id || '').trim();
  if (!clientId) throw new Error('Google-innlogging er ikke konfigurert på SNAR-serveren ennå.');
  // Reserve the popup in the click handler, before config/network/PKCE awaits.
  const windowName = 'snar-google-auth';
  const popup = window.open('', windowName, 'width=500,height=700');
  if (!popup) throw new Error('Tillat popup-vinduer for å logge inn med Google.');
  pending = true;
  try {
    const redirectUri = window.location.origin + '/';
    const discovery = { authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth' };
    // Use Google's OIDC ID-token response. The token is verified by the
    // existing customer-only /auth/google/native endpoint, so no OAuth client
    // secret is shipped to the web app or required on Render.
    const request = new AuthRequest({ clientId, redirectUri,
      scopes: ['openid', 'email', 'profile'], responseType: ResponseType.IdToken,
      usePKCE: false, extraParams: { nonce: randomUUID() } });
    const url = await request.makeAuthUrlAsync(discovery);
    if (popup.closed) return null;
    const result = await request.promptAsync(discovery, { url, windowName });
    if (result.type === 'cancel' || result.type === 'dismiss') return null;
    // AuthRequest also validates the returned OAuth state before reporting success.
    if (result.type !== 'success' || !result.params.id_token)
      throw new Error('Google-innloggingen kunne ikke bekreftes.');
    return result.params.id_token;
  } finally {
    pending = false;
    if (!popup.closed) popup.close();
  }
}

export async function appleIdentity(): Promise<string | null> { return null; }
