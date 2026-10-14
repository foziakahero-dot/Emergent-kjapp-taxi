import React, { createContext, useCallback, useContext, useEffect, useState, useRef } from 'react';
import { googleIdentity, appleIdentity } from '@/src/lib/socialSignIn';
import { storage } from '@/src/utils/storage';
import { authApi, TOKEN_KEY } from '@/src/lib/api';
import { stopDriverBackgroundLocation, unregisterNativePush } from '@/src/lib/nativeRuntime';

export type User = {
  id: string;
  email: string;
  fullName?: string;
  phone?: string;
  role?: string;
  driver_id?: string;
  fleet_id?: string;
  fleet_name?: string;
  fleet_org_number?: string;
  vehicle_id?: string;
  car?: string;
  plate?: string;
  vehicle_type?: string;
  profile_photo_path?: string;
  approved?: boolean;
  legal_accepted?: boolean;
  identity_verification_status?: string;
  identity_recheck_required?: boolean;
  identity_recheck_reason?: string;
  identity_recheck_trigger?: string;
  next_identity_check_at?: string;
  identity_verified_at?: string;
} | null;

type AuthCtx = {
  user: User | undefined; // undefined = loading, null = signed out
  login: (identifier: string, password: string) => Promise<any>;
  acceptLegal: () => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  signInWithGoogle: () => Promise<User>;
  signInWithApple: () => Promise<User>;
};

const Ctx = createContext<AuthCtx>(null as any);

const DRIVER_INSTALLATION_KEY = 'kjapp_driver_installation_id_v1';

async function getDriverInstallationId(): Promise<string> {
  const existing = await storage.getItem(DRIVER_INSTALLATION_KEY);
  if (existing) return existing;
  const id = [
    'drv',
    Date.now().toString(36),
    Math.random().toString(36).slice(2, 12),
    Math.random().toString(36).slice(2, 12),
  ].join('_');
  await storage.setItem(DRIVER_INSTALLATION_KEY, id);
  return id;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | undefined>(undefined);
  const sessionEpoch = useRef(0);

  const refresh = useCallback(async () => {
    const epoch = ++sessionEpoch.current;
    const token = await storage.getItem(TOKEN_KEY);
    if (epoch !== sessionEpoch.current) return;
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const u = await authApi.me();
      if (epoch !== sessionEpoch.current) return;
      if (u?.role !== 'driver' || u?.approved !== true) {
        await storage.removeItem(TOKEN_KEY);
        setUser(null);
        return;
      }
      setUser(u);
    } catch {
      if (epoch !== sessionEpoch.current) return;
      await storage.removeItem(TOKEN_KEY);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const persistSession = async (res: any, epoch: number): Promise<User> => {
    if (epoch !== sessionEpoch.current) return null;
    if (!res?.token || res.user?.role !== 'driver' || res.user?.approved !== true) {
      throw new Error('Sjåførkontoen må være invitert og godkjent.');
    }
    await storage.setItem(TOKEN_KEY, res.token);
    if (epoch !== sessionEpoch.current) return null;
    setUser(res.user);
    return res.user;
  };

  const login = async (identifier: string, password: string) => {
    const epoch = ++sessionEpoch.current;
    const device_id = await getDriverInstallationId();
    if (epoch !== sessionEpoch.current) return null;
    const res = await authApi.login({ email: identifier, password, client: 'driver', device_id });
    if (epoch !== sessionEpoch.current) return null;
    if (res?.twofa_required) return res;
    return persistSession(res, epoch);
  };

  const socialLogin = async (provider: 'google' | 'apple'): Promise<User> => {
    const epoch = ++sessionEpoch.current;
    const identity = provider === 'google'
      ? await googleIdentity(await authApi.nativeConfig()) : await appleIdentity();
    if (!identity || epoch !== sessionEpoch.current) return null;
    const device_id = await getDriverInstallationId();
    if (epoch !== sessionEpoch.current) return null;
    const res = await authApi.nativeSignIn(provider, identity, device_id);
    return persistSession(res, epoch);
  };
  const signInWithGoogle = () => socialLogin('google');
  const signInWithApple = () => socialLogin('apple');

  const acceptLegal = async (): Promise<User> => {
    const updated = await authApi.acceptLegal('2026-09');
    setUser(updated);
    return updated;
  };

  const logout = async () => {
    const epoch = ++sessionEpoch.current;
    const token = await storage.getItem(TOKEN_KEY);
    if (epoch !== sessionEpoch.current) return;
    await storage.removeItem(TOKEN_KEY);
    if (epoch !== sessionEpoch.current) return;
    setUser(null);
    try { await stopDriverBackgroundLocation(); } catch {}
    if (token) void (async () => {
      try { await unregisterNativePush(token); } catch {}
      try { await authApi.logout(token); } catch {}
    })();
  };

  return (
    <Ctx.Provider value={{ user, login, acceptLegal, logout, refresh, signInWithGoogle, signInWithApple }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
