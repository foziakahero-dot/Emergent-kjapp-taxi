import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { storage } from '@/src/utils/storage';
import { authApi, TOKEN_KEY } from '@/src/lib/api';
import { unregisterNativePush } from '@/src/lib/nativeRuntime';

import { googleIdentity, appleIdentity } from '@/src/lib/socialSignIn';

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | undefined>(undefined);

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

  useEffect(() => { refresh(); }, [refresh]);

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

  const socialLogin = async (provider: 'google' | 'apple'): Promise<User> => {
    const identity = provider === 'google'
      ? await googleIdentity(await authApi.nativeConfig()) : await appleIdentity();
    if (!identity) return null;
    const res = typeof identity === 'string' ? await authApi.nativeSignIn(provider, identity) : identity.session;
    if (!res.token || res.user?.role !== 'user') throw new Error('Innloggingen kunne ikke bekreftes.');
    await storage.setItem(TOKEN_KEY, res.token);
    setUser(res.user);
    return res.user;
  };
  const signInWithGoogle = () => socialLogin('google');
  const signInWithApple = () => socialLogin('apple');

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

