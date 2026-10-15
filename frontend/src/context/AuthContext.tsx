import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
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
  customer_photo_version?: string;
  google_linked?: boolean;
  apple_linked?: boolean;
} | null;

type AuthCtx = {
  sessionError: string;
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
  const sessionEpoch = useRef(0);
  const [sessionError, setSessionError] = useState('');
  const [user, setUser] = useState<User | undefined>(undefined);

  const refresh = useCallback(async () => {
    const epoch = ++sessionEpoch.current;
    setSessionError('');
    const token = await storage.getItem(TOKEN_KEY);
    if (epoch !== sessionEpoch.current) return;
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const u = await authApi.me();
      if (epoch !== sessionEpoch.current) return;
      if (u?.role !== 'user') {
        await storage.removeItem(TOKEN_KEY);
        if (epoch !== sessionEpoch.current) return;
        setUser(null);
        return;
      }
      setUser(u);
    } catch (error: any) {
      if (epoch !== sessionEpoch.current) return;
      if (error?.response?.status === 401) {
        await storage.removeItem(TOKEN_KEY);
        if (epoch !== sessionEpoch.current) return;
        setUser(null);
      } else {
        setSessionError('Kan ikke kontakte SNAR. Sjekk forbindelsen og prøv igjen.');
      }
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = async (email: string, password: string) => {
    const epoch = ++sessionEpoch.current;
    const res = await authApi.login({ email, password, client: 'customer' });
    if (epoch !== sessionEpoch.current) throw new Error('Innloggingen ble avbrutt.');
    if (res.twofa_required) return res;
    if (res?.user?.role !== 'user') throw new Error('Denne kontoen kan ikke brukes i SNAR kundeappen.');
    await storage.setItem(TOKEN_KEY, res.token);
    if (epoch !== sessionEpoch.current) throw new Error('Innloggingen ble avbrutt.');
    setSessionError(''); setUser(res.user);
    return res.user;
  };

  const register = async (data: any) => {
    const epoch = ++sessionEpoch.current;
    const res = await authApi.register(data);
    if (epoch !== sessionEpoch.current) throw new Error('Registreringen ble avbrutt.');
    if (!res?.token || res?.user?.role !== 'user') throw new Error('Kun kundekonto kan registreres i kundeappen.');
    await storage.setItem(TOKEN_KEY, res.token);
    if (epoch !== sessionEpoch.current) throw new Error('Registreringen ble avbrutt.');
    setSessionError(''); setUser(res.user);
    return res.user;
  };

  const acceptLegal = async (): Promise<User> => {
    const epoch = ++sessionEpoch.current;
    const updated = await authApi.acceptLegal('2026-09');
    if (epoch !== sessionEpoch.current) return null;
    setUser(updated);
    return updated;
  };

  const socialLogin = async (provider: 'google' | 'apple'): Promise<User> => {
    const epoch = ++sessionEpoch.current;
    const identity = provider === 'google'
      ? await googleIdentity(await authApi.nativeConfig()) : await appleIdentity();
    if (!identity || epoch !== sessionEpoch.current) return null;
    const res = typeof identity === 'string' ? await authApi.nativeSignIn(provider, identity) : identity.session;
    if (epoch !== sessionEpoch.current) return null;
    if (!res.token || res.user?.role !== 'user') throw new Error('Innloggingen kunne ikke bekreftes.');
    await storage.setItem(TOKEN_KEY, res.token);
    if (epoch !== sessionEpoch.current) return null;
    setSessionError(''); setUser(res.user);
    return res.user;
  };
  const signInWithGoogle = () => socialLogin('google');
  const signInWithApple = () => socialLogin('apple');

  const logout = async () => {
    const epoch = ++sessionEpoch.current;
    const token = await storage.getItem(TOKEN_KEY);
    if (epoch !== sessionEpoch.current) return;
    await storage.removeItem(TOKEN_KEY);
    if (epoch !== sessionEpoch.current) return;
    setSessionError(''); setUser(null);
    // Remote cleanup uses the old session and cannot delay local sign-out or
    // revoke a new login that starts while these requests are still in flight.
    if (token) void (async () => {
      try { await unregisterNativePush(token); } catch {}
      try { await authApi.logout(token); } catch {}
    })();
  };

  return (
    <Ctx.Provider value={{ sessionError, user, login, register, acceptLegal, logout, refresh, signInWithGoogle, signInWithApple }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
