import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { storage } from '@/src/utils/storage';
import { authApi, TOKEN_KEY } from '@/src/lib/api';

// Complete any pending auth session (mobile). No-op on web.
WebBrowser.maybeCompleteAuthSession();

const EMERGENT_AUTH = 'https://auth.emergentagent.com/';

export type User = {
  id: string;
  email: string;
  fullName?: string;
  phone?: string;
  role?: string;
  driver_id?: string;
  google_linked?: boolean;
  car?: string;
  plate?: string;
  vehicle_type?: string;
} | null;

type AuthCtx = {
  user: User | undefined; // undefined = loading, null = signed out
  login: (email: string, password: string) => Promise<any>;
  register: (data: any) => Promise<any>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  signInWithGoogle: () => Promise<User>;
  linkGoogle: () => Promise<boolean>;
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
  const googleError = useRef('');

  const refresh = useCallback(async () => {
    const token = await storage.getItem(TOKEN_KEY);
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const u = await authApi.me();
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
      googleError.current = '';
      const res = await authApi.googleDriverSession(sid);
      if (res?.twofa_required) {
        googleError.current = 'Kontoen krever tofaktor. Bruk e-post og passord for å fullføre innloggingen.';
        return null;
      }
      if (!res?.token || !res?.user) {
        googleError.current = 'Google-kontoen ga ingen gyldig KJAPP Driver-session.';
        return null;
      }
      await storage.setItem(TOKEN_KEY, res.token);
      setUser(res.user);
      return res.user;
    } catch (e: any) {
      googleError.current = e?.response?.data?.detail || e?.message || 'Google-innloggingen feilet.';
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
    const res = await authApi.login({ email, password });
    if (res.twofa_required) return res;
    await storage.setItem(TOKEN_KEY, res.token);
    setUser(res.user);
    return res.user;
  };

  const register = async (data: any) => {
    const res = await authApi.register(data);
    await storage.setItem(TOKEN_KEY, res.token);
    setUser(res.user);
    return res.user;
  };

  const signInWithGoogle = async (): Promise<User> => {
    const redirectUrl = Platform.OS === 'web'
      ? window.location.origin + '/'
      : Linking.createURL('');
    const authUrl = `${EMERGENT_AUTH}?redirect=${encodeURIComponent(redirectUrl)}`;

    if (Platform.OS === 'web') {
      window.location.href = authUrl;
      return null; // return handled on next mount
    }

    lastUrl.current = null;
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    let url: string | null = result.type === 'success' ? result.url : null;
    if (!url) url = lastUrl.current || (await Linking.getInitialURL());
    const sid = extractSessionId(url);
    if (!sid) return null;
    const linkedUser = await handleSessionId(sid);
    if (!linkedUser && googleError.current) throw new Error(googleError.current);
    return linkedUser;
  };

  const linkGoogle = async (): Promise<boolean> => {
    const redirectUrl = Platform.OS === 'web'
      ? window.location.origin + '/'
      : Linking.createURL('');
    const authUrl = `${EMERGENT_AUTH}?redirect=${encodeURIComponent(redirectUrl)}`;

    if (Platform.OS === 'web') return false;

    lastUrl.current = null;
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    let url: string | null = result.type === 'success' ? result.url : null;
    if (!url) url = lastUrl.current || (await Linking.getInitialURL());
    const sid = extractSessionId(url);
    if (!sid) return false;
    await authApi.googleLink(sid);
    await refresh();
    return true;
  };
  const logout = async () => {
    await storage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, login, register, logout, refresh, signInWithGoogle, linkGoogle }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
