import { AuthRequest, ResponseType } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { authApi } from './api';

WebBrowser.maybeCompleteAuthSession();

export async function googleIdentity(_: { google_web_client_id: string; google_ios_client_id?: string }): Promise<string | { session: any } | null> {
  const config = await authApi.googleWebConfig();
  if (!config.enabled) throw new Error('Google-innlogging er ikke konfigurert ennå.');
  const redirectUri = window.location.origin + '/';
  const discovery = { authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth' };
  const request = new AuthRequest({ clientId: config.client_id, redirectUri,
    scopes: ['openid', 'email', 'profile'], responseType: ResponseType.Code, usePKCE: true });
  const result = await request.promptAsync(discovery);
  if (result.type === 'cancel' || result.type === 'dismiss') return null;
  if (result.type !== 'success' || !result.params.code || !request.codeVerifier)
    throw new Error('Google-innloggingen kunne ikke bekreftes.');
  return { session: await authApi.googleWebCode(result.params.code, request.codeVerifier, redirectUri) };
}

export async function appleIdentity(): Promise<string | null> { return null; }
