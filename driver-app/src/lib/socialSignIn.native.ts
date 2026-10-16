import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';

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
