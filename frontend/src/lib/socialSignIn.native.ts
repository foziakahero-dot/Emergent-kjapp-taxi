import { Platform } from 'react-native';
import { GoogleSignin, isSuccessResponse, isCancelledResponse } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';

export async function googleIdentity(config: { google_web_client_id: string; google_ios_client_id?: string }) {
  if (!config.google_web_client_id) throw new Error('Google-innlogging er ikke konfigurert ennå.');
  if (Platform.OS === 'ios' && !config.google_ios_client_id) {
    throw new Error('Google-innlogging for iPhone mangler iOS OAuth Client ID på serveren.');
  }
  GoogleSignin.configure({
    webClientId: config.google_web_client_id,
    iosClientId: Platform.OS === 'ios' ? config.google_ios_client_id : undefined,
  });
  if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const result = await GoogleSignin.signIn();
  if (isCancelledResponse(result)) return null;
  if (!isSuccessResponse(result) || !result.data.idToken) throw new Error('Google returnerte ikke et gyldig innloggingstoken.');
  return result.data.idToken;
}

export async function appleIdentity() {
  if (Platform.OS !== 'ios' || !(await AppleAuthentication.isAvailableAsync())) return null;
  try {
    const result = await AppleAuthentication.signInAsync({ requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL, AppleAuthentication.AppleAuthenticationScope.FULL_NAME] });
    if (!result.identityToken) throw new Error('Apple returnerte ikke et gyldig innloggingstoken.');
    return result.identityToken;
  } catch (error: any) {
    if (error?.code === 'ERR_REQUEST_CANCELED') return null;
    throw error;
  }
}
