import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { storage } from '@/src/utils/storage';
import { authApi, TOKEN_KEY } from '@/src/lib/api';

// Native auth-session completion is optional. A provider/runtime failure must never
// terminate application startup.
try {
  WebBrowser.maybeCompleteAuthSession();
} catch {
  // Continue with normal token restore.
}

const EMERGENT_AUTH = 'https://auth.emergentagent.com/';

export type User = {
  id: string;
  email: string;
  fullName?: string;
  phone?: string;
  role?: string;
  driver_id?: string;
  approved?: boolean;
} | null;

type AuthCtx = {
  user: User | undefined; // undefined = loading, null = signed out
  login: (email: string, password: string) => Promise<any>;
  register: (data: any) => Promise<any>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  signInWithGoogle: () => Promise<User>;
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
    try {
      const token = await storage.getItem(TOKEN_KEY);
      if (!token) {
        setUser(null);
        return;
      }
      const u = await authApi.me();
      setUser(u);
    } catch {
      try { await storage.removeItem(TOKEN_KEY); } catch {}
      setUser(null);
    }
  }, []);

  // Exchange an Emergent session_id for our JWT (once per session_id).
  const handleSessionId = useCallback(async (sid: string): Promise<User> => {
    if (processed.current.has(sid)) return null;
    processed.current.add(sid);
    try {
      const res = await authApi.googleSession(sid);
      await storage.setItem(TOKEN_KEY, res.token);
      setUser(res.user);
      return res.user;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  // Boot: every native/linking/storage failure resolves to a stable signed-out state.
  useEffect(() => {
    let active = true;
    let sub: { remove: () => void } | undefined;

    const boot = async () => {
      try {
        if (Platform.OS === 'web') {
          const href = typeof window !== 'undefined' ? window.location.href : '';
          const sid = extractSessionId(href);
          if (sid) {
            const signedIn = await handleSessionId(sid);
            try {
              const clean = href.replace(/([?#&])session_id=[^&#]*/, '$1').replace(/[?#&]$/, '');
              window.history.replaceState(window.history.state, '', clean);
            } catch {}
            if (!signedIn && active) await refresh();
            return;
          }
          if (active) await refresh();
          return;
        }

        let initial: string | null = null;
        try {
          initial = await Linking.getInitialURL();
        } catch {
          initial = null;
        }
        const sid = extractSessionId(initial);
        if (sid) {
          const signedIn = await handleSessionId(sid);
          if (!signedIn && active) await refresh();
          return;
        }
        if (active) await refresh();
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setUser((current) => current === undefined ? null : current);
      }
    };

    void boot();

    if (Platform.OS !== 'web') {
      try {
        sub = Linking.addEventListener('url', (e) => {
          lastUrl.current = e.url;
          const sid = extractSessionId(e.url);
          if (sid) void handleSessionId(sid);
        });
      } catch {
        // Deep-link listener is optional; auth restore still works.
      }
    }

    return () => {
      active = false;
      try { sub?.remove(); } catch {}
    };
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
    return await handleSessionId(sid);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Local session cleanup must still succeed if the backend is unavailable.
    } finally {
      try { await storage.removeItem(TOKEN_KEY); } catch {}
      processed.current.clear();
      lastUrl.current = null;
      setUser(null);
    }
  };

  return (
    <Ctx.Provider value={{ user, login, register, logout, refresh, signInWithGoogle }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
