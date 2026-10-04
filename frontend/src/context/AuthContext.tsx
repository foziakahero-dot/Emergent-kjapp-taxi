import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { storage } from '@/src/utils/storage';
import { authApi, TOKEN_KEY } from '@/src/lib/api';
import { unregisterNativePush } from '@/src/lib/nativeRuntime';
import { GoogleSignin, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';

// Complete any pending auth session (mobile). No-op on web.
WebBrowser.maybeCompleteAuthSession();

// Google Sign-In (native on mobile, web fallback handled separately if needed)
// Configure Google SignIn
if (Platform.OS !== 'web') {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, // For web/Android/iOS
    offlineAccess: true,
  });
}

export type User = {
  id: string;
  email: string;
  fullName?: string;
  phone?: string;
  role?: string;
  driver_id?: string;
  legal_accepted?: boolean;
} | null;

type AuthCtx = {
  user: User | undefined; // undefined = loading, null = signed out
  login: (email: string, password: string) => Promise<any>;
  register: (data: any) => Promise<any>;
  acceptLegal: () => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  signInWithGoogle: () => Promise<User>;
  signInWithApple: () => Promise<User>;
};

const Ctx = createContext<AuthCtx>(null as any);

function extractSessionId(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | undefined>(undefined);
  const processed = useRef<Set<string>>(new Set());
  const lastUrl = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const token = await storage.getItem(TOKEN_KEY);
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const u = await authApi.me();
      if (u?.role !== 'user') {
        await storage.removeItem(TOKEN_KEY);
        setUser(null);
        return;
      }
      setUser(u);
    } catch {
      await storage.removeItem(TOKEN_KEY);
      setUser(null);
    }
  }, []);

  // Exchange an Emergent session_id for our JWT (once per session_id).
  const handleSessionId = useCallback(async (sid: string): Promise<User> => {
    if (processed.current.has(sid)) return null;
    processed.current.add(sid);
    try {
      const res = await authApi.googleSession(sid);
      if (res?.user?.role !== 'user') return null;
      await storage.setItem(TOKEN_KEY, res.token);
      setUser(res.user);
      return res.user;
    } catch {
      return null;
    }
  }, []);

  // Boot: process a returning session_id first, else restore existing session.
  useEffect(() => {
    let sub: { remove: () => void } | undefined;
    (async () => {
      if (Platform.OS === 'web') {
        const href = typeof window !== 'undefined' ? window.location.href : '';
        const sid = extractSessionId(href);
        if (sid) {
          await handleSessionId(sid);
          // strip session_id, preserve everything else
          try {
            const clean = href.replace(/([?#&])session_id=[^&#]*/, '$1').replace(/[?#&]$/, '');
            window.history.replaceState(window.history.state, '', clean);
          } catch {}
          return;
        }
        await refresh();
      } else {
        const initial = await Linking.getInitialURL();
        const sid = extractSessionId(initial);
        if (sid) { await handleSessionId(sid); return; }
        await refresh();
      }
    })();

    if (Platform.OS !== 'web') {
      sub = Linking.addEventListener('url', (e) => {
        lastUrl.current = e.url;
        const sid = extractSessionId(e.url);
        if (sid) handleSessionId(sid);
      });
    }
    return () => { sub && sub.remove(); };
  }, [refresh, handleSessionId]);

  const login = async (email: string, password: string) => {
    const res = await authApi.login({ email, password, client: 'customer' });
    if (res.twofa_required) return res;
    if (res?.user?.role !== 'user') throw new Error('Denne kontoen kan ikke brukes i KJAPP kundeappen.');
    await storage.setItem(TOKEN_KEY, res.token);
    setUser(res.user);
    return res.user;
  };

  const register = async (data: any) => {
    const res = await authApi.register(data);
    if (res?.user?.role !== 'user') throw new Error('Kun kundekonto kan registreres i kundeappen.');
    await storage.setItem(TOKEN_KEY, res.token);
    setUser(res.user);
    return res.user;
  };

  const acceptLegal = async (): Promise<User> => {
    const updated = await authApi.acceptLegal('2026-09');
    setUser(updated);
    return updated;
  };

  const signInWithGoogle = async (): Promise<User> => {
    // Web: Use existing web flow (preserve current behavior)
    if (Platform.OS === 'web') {
      // For web, we keep the existing Emergent-based flow to avoid changing web behavior
      // The user requested not to redesign the app or change web behavior
      const redirectUrl = window.location.origin + '/';
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
      window.location.href = authUrl;
      return null; // return handled on next mount
    }

    // Mobile: Native Google Sign-In using @react-native-google-signin/google-signin
    try {
      // Check if Google Sign-In is properly configured
      const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
      if (!webClientId || webClientId.trim() === '') {
        throw new Error('Google Sign-In er ikke konfigurert. Mangler EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID miljøvariabel.');
      }

      // Configure GoogleSignin (if not already done)
      // Note: Configuration is done at the top of the file, but we check here for safety

      // Check if Google Play services are available (Android only)
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }

      // Sign in with Google
      const userInfo = await GoogleSignin.signIn();
      if (!isSuccessResponse(userInfo)) return null;
      const idToken = userInfo.data.idToken;
      if (!idToken) throw new Error('Google returnerte ikke et gyldig ID-token.');

      const res = await authApi.googleSignIn({ idToken });

      if (res?.user?.role !== 'user') {
        throw new Error('Denne kontoen kan ikke brukes i KJAPP kundeappen.');
      }

      await storage.setItem(TOKEN_KEY, res.token);
      setUser(res.user);
      return res.user;
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled the login flow
        return null;
      }
      if (error.code === statusCodes.IN_PROGRESS) {
        // Operation (e.g. sign in) is in progress already
        return null;
      }
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        // Play services not available or outdated
        throw new Error('Google Play-tjenester er ikke tilgjengelig eller foreldre.');
      }
      // Handle missing configuration
      if (error.message && error.message.includes('ikke konfigurert')) {
        throw error; // Re-throw our configuration error
      }
      // Some other error happened
      throw new Error(`Google Sign-In feilet: ${error.message}`);
    }
  };

  const signInWithApple = async (): Promise<User> => {
    if (Platform.OS !== 'ios') return null;
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        throw new Error('Apple returnerte ikke et gyldig identity token.');
      }
      const fullName = [
        credential.fullName?.givenName,
        credential.fullName?.middleName,
        credential.fullName?.familyName,
      ].filter(Boolean).join(' ').trim() || undefined;
      const res = await authApi.appleSignIn({
        identity_token: credential.identityToken,
        fullName,
        email: credential.email,
      });
      if (res.twofa_required) {
        throw new Error('Kontoen krever tofaktor — logg inn via web-portalen.');
      }
      if (res?.user?.role !== 'user') throw new Error('Denne kontoen kan ikke brukes i KJAPP kundeappen.');
      await storage.setItem(TOKEN_KEY, res.token);
      setUser(res.user);
      return res.user;
    } catch (e: any) {
      if (e?.code === 'ERR_REQUEST_CANCELED') return null;
      throw e;
    }
  };

  const logout = async () => {
    try { await unregisterNativePush(); } catch {}
    try { await authApi.logout(); } catch {}
    await storage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, login, register, acceptLegal, logout, refresh, signInWithGoogle, signInWithApple }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
