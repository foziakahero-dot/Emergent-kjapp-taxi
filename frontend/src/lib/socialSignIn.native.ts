import { Platform } from 'react-native';
import { GoogleSignin, isSuccessResponse, isCancelledResponse } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';

export async function googleIdentity(config: { google_enabled?: boolean; google_web_client_id: string; google_ios_client_id?: string }) {
  const webClientId = String(config?.google_web_client_id || '').trim();
  const iosClientId = String(config?.google_ios_client_id || '').trim();
  if (config?.google_enabled === false || !webClientId) throw new Error('Google-innlogging er deaktivert eller mangler oppsett på SNAR-serveren. Bruk e-post inntil oppsettet er rettet.');
  if (Platform.OS === 'ios' && !iosClientId) {
    throw new Error('Google-innlogging for iPhone mangler iOS-klientkonfigurasjon på SNAR-serveren.');
  }

  // The backend is the source of truth for the OAuth client IDs. Do not reject a
  // valid server configuration just because an EXPO_PUBLIC_* value was omitted
  // from the JavaScript bundle; the iOS URL scheme itself is still baked into the
  // native binary by app.config.js during EAS build.
  GoogleSignin.configure({
    webClientId,
    iosClientId: Platform.OS === 'ios' ? iosClientId : undefined,
    offlineAccess: false,
  });

  let result;
  try {
    if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    result = await GoogleSignin.signIn();
  } catch (error: any) {
    const code = String(error?.code || '');
    if (code === 'SIGN_IN_CANCELLED' || code === '12501') return null;
    if (code === '10' || code === 'DEVELOPER_ERROR')
      throw new Error('Google-innlogging er feilkonfigurert for denne appversjonen (G10). SNAR må kontrollere pakkenavn, signeringssertifikat og OAuth-klient.');
    if (code === 'PLAY_SERVICES_NOT_AVAILABLE') throw new Error('Oppdater Google Play-tjenester på telefonen og prøv igjen.');
    if (code === '7' || code === 'NETWORK_ERROR') throw new Error('Google kunne ikke nås. Kontroller forbindelsen og prøv igjen.');
    throw new Error('Google-innlogging kunne ikke fullføres. Prøv igjen eller bruk e-post.');
  }
  if (isCancelledResponse(result)) return null;
  if (!isSuccessResponse(result) || !result.data.idToken) {
    throw new Error('Google returnerte ikke et gyldig innloggingstoken.');
  }
  return result.data.idToken;
}

export async function appleIdentity() {
  if (Platform.OS !== 'ios' || !(await AppleAuthentication.isAvailableAsync())) {
    throw new Error('Apple-innlogging er bare tilgjengelig på støttede Apple-enheter.');
  }
  try {
    const result = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      ],
    });
    if (!result.identityToken) throw new Error('Apple returnerte ikke et gyldig innloggingstoken.');
    return result.identityToken;
  } catch (error: any) {
    if (error?.code === 'ERR_REQUEST_CANCELED') return null;
    throw error;
  }
}
