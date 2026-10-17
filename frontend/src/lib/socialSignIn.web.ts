import { AuthRequest, ResponseType } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { authApi } from './api';

WebBrowser.maybeCompleteAuthSession();
let pending = false;

export async function googleIdentity(_: { google_web_client_id: string; google_ios_client_id?: string }, action: 'signin' | 'link' = 'signin'): Promise<string | { session: any } | null> {
  if (pending) throw new Error('Google-innlogging pågår allerede.');
  // Reserve the popup in the click handler, before config/network/PKCE awaits.
  const windowName = 'snar-google-auth';
  const popup = window.open('', windowName, 'width=500,height=700');
  if (!popup) throw new Error('Tillat popup-vinduer for å logge inn med Google.');
  pending = true;
  try {
    const config = await authApi.googleWebConfig();
    if (!config.enabled) throw new Error('Google web-innlogging er ikke konfigurert på SNAR-serveren.');
    const redirectUri = window.location.origin + '/';
    const discovery = { authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth' };
    const request = new AuthRequest({ clientId: config.client_id, redirectUri,
      scopes: ['openid', 'email', 'profile'], responseType: ResponseType.Code, usePKCE: true });
    const url = await request.makeAuthUrlAsync(discovery);
    if (popup.closed) return null;
    const result = await request.promptAsync(discovery, { url, windowName });
    if (result.type === 'cancel' || result.type === 'dismiss') return null;
    // AuthRequest also validates the returned OAuth state before reporting success.
    if (result.type !== 'success' || !result.params.code || !request.codeVerifier)
      throw new Error('Google-innloggingen kunne ikke bekreftes.');
    return { session: await authApi.googleWebCode(result.params.code, request.codeVerifier, redirectUri, action) };
  } finally {
    pending = false;
    if (!popup.closed) popup.close();
  }
}

export async function appleIdentity(): Promise<string | null> { return null; }
