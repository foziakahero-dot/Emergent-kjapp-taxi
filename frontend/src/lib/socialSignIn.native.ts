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
  GoogleSignin.configure({
    webClientId,
    iosClientId: Platform.OS === 'ios' ? iosClientId : undefined,
    offlineAccess: false,
  });

  if (Platform.OS === 'android') {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }
  let result;
  try { result = await GoogleSignin.signIn(); }
  catch (error) {
    if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) return null;
    throw error;
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
