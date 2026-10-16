import { Platform } from 'react-native';
import { GoogleSignin, isSuccessResponse, isCancelledResponse, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';

export async function googleIdentity(config: { google_web_client_id: string; google_ios_client_id?: string }) {
  const webClientId = String(config?.google_web_client_id || '').trim();
  const iosClientId = String(config?.google_ios_client_id || '').trim();
  if (!webClientId) throw new Error('Google-innlogging er ikke konfigurert på SNAR-serveren ennå.');
  if (Platform.OS === 'ios' && !iosClientId) {
    throw new Error('Google-innlogging for iPhone mangler iOS-klientkonfigurasjon på SNAR-serveren.');
  }

  // The backend is the source of truth for the OAuth client IDs. Do not reject a
  // valid server configuration just because an EXPO_PUBLIC_* value was omitted
  // from the JavaScript bundle; the iOS URL scheme itself is still baked into the
  // native binary by app.config.js during EAS build.
  let result;
  try {
  GoogleSignin.configure({
    webClientId,
    iosClientId: Platform.OS === 'ios' ? iosClientId : undefined,
    offlineAccess: false,
  });

  if (Platform.OS === 'android') {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }
  result = await GoogleSignin.signIn();
  } catch (error) {
    if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) return null;
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) throw new Error('Google Play-tjenester må oppdateres før du kan logge inn.');
      if (error.code === statusCodes.IN_PROGRESS) throw new Error('Google-innlogging pågår allerede.');
      if (String(error.code) === '10' || String(error.code) === 'DEVELOPER_ERROR') throw new Error('Google-innlogging mangler riktig appkonfigurasjon. Kontakt SNAR.');
      if (String(error.code) === '7' || String(error.code) === 'NETWORK_ERROR') throw new Error('Kan ikke kontakte Google. Sjekk nettet og prøv igjen.');
    }
    throw new Error('Google-innloggingen kunne ikke fullføres. Prøv igjen.');
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
