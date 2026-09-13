import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { storage } from '@/src/utils/storage';
import { authApi, TOKEN_KEY } from '@/src/lib/api';

WebBrowser.maybeCompleteAuthSession();

const EMERGENT_AUTH = 'https://auth.emergentagent.com/';
const CURRENT_PROFILE_PHOTO_KEY = 'kjapp_profile_photo_current';

export type User = {
  id: string;
  email: string;
  fullName?: string;
  phone?: string;
  role?: string;
  driver_id?: string;
  profile_photo_path?: string;
  avatar_url?: string;
} | null;

type AuthCtx = {
  user: User | undefined;
  login: (email: string, password: string) => Promise<any>;
  register: (data: any) => Promise<any>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  signInWithGoogle: () => Promise<User>;
  setProfilePhoto: (storagePath: string | null) => Promise<void>;
};

const Ctx = createContext<AuthCtx>(null as any);

function extractSessionId(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function hydrateLocalProfilePhoto(u: any): Promise<User> {
  if (!u?.id) {
    await storage.removeItem(CURRENT_PROFILE_PHOTO_KEY).catch(() => {});
    return u || null;
  }
  try {
    const saved = await storage.getItem(`kjapp_profile_photo_${u.id}`);
    if (saved) {
      await storage.setItem(CURRENT_PROFILE_PHOTO_KEY, saved);
      return { ...u, profile_photo_path: saved };
    }
    await storage.removeItem(CURRENT_PROFILE_PHOTO_KEY);
    return u;
  } catch {
    return u;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | undefined>(undefined);
  const processed = useRef<Set<string>>(new Set());
  const lastUrl = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const token = await storage.getItem(TOKEN_KEY);
    if (!token) {
      await storage.removeItem(CURRENT_PROFILE_PHOTO_KEY).catch(() => {});
      setUser(null);
      return;
    }
    try {
      const u = await authApi.me();
      setUser(await hydrateLocalProfilePhoto(u));
    } catch {
      await storage.removeItem(TOKEN_KEY);
      await storage.removeItem(CURRENT_PROFILE_PHOTO_KEY).catch(() => {});
      setUser(null);
    }
  }, []);

  const handleSessionId = useCallback(async (sid: string): Promise<User> => {
    if (processed.current.has(sid)) return null;
    processed.current.add(sid);
    try {
      const res = await authApi.googleSession(sid);
      await storage.setItem(TOKEN_KEY, res.token);
      const next = await hydrateLocalProfilePhoto(res.user);
      setUser(next);
      return next;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let sub: { remove: () => void } | undefined;
    (async () => {
      if (Platform.OS === 'web') {
        const href = typeof window !== 'undefined' ? window.location.href : '';
        const sid = extractSessionId(href);
        if (sid) {
          await handleSessionId(sid);
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
    const next = await hydrateLocalProfilePhoto(res.user);
    setUser(next);
    return next;
  };

  const register = async (data: any) => {
    const res = await authApi.register(data);
    await storage.setItem(TOKEN_KEY, res.token);
    const next = await hydrateLocalProfilePhoto(res.user);
    setUser(next);
    return next;
  };

  const signInWithGoogle = async (): Promise<User> => {
    const redirectUrl = Platform.OS === 'web'
      ? window.location.origin + '/'
      : Linking.createURL('');
    const authUrl = `${EMERGENT_AUTH}?redirect=${encodeURIComponent(redirectUrl)}`;

    if (Platform.OS === 'web') {
      window.location.href = authUrl;
      return null;
    }

    lastUrl.current = null;
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    let url: string | null = result.type === 'success' ? result.url : null;
    if (!url) url = lastUrl.current || (await Linking.getInitialURL());
    const sid = extractSessionId(url);
    if (!sid) return null;
    return await handleSessionId(sid);
  };

  const setProfilePhoto = async (storagePath: string | null) => {
    const id = user?.id;
    if (!id) return;
    const key = `kjapp_profile_photo_${id}`;
    if (storagePath) {
      await storage.setItem(key, storagePath);
      await storage.setItem(CURRENT_PROFILE_PHOTO_KEY, storagePath);
    } else {
      await storage.removeItem(key);
      await storage.removeItem(CURRENT_PROFILE_PHOTO_KEY);
    }
    setUser((prev) => prev ? { ...prev, profile_photo_path: storagePath || undefined } : prev);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Mobile auth is bearer-token based. Local logout must still succeed if the server is unreachable.
    } finally {
      await storage.removeItem(TOKEN_KEY);
      await storage.removeItem(CURRENT_PROFILE_PHOTO_KEY).catch(() => {});
      setUser(null);
      processed.current.clear();
      lastUrl.current = null;
    }
  };

  return (
    <Ctx.Provider value={{ user, login, register, logout, refresh, signInWithGoogle, setProfilePhoto }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
