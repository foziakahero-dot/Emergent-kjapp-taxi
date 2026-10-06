import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
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

  const refresh = useCallback(async () => {
    const token = await storage.getItem(TOKEN_KEY);
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const u = await authApi.me();
      if (u?.role !== 'driver' || u?.approved !== true) {
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

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (identifier: string, password: string) => {
    // Driver authentication is deliberately password-only. The persistent,
    // app-generated installation id is only a privacy-preserving signal used by
    // the backend to require Selfie ID again on a new installation/device.
    const device_id = await getDriverInstallationId();
    const res = await authApi.login({ email: identifier, password, client: 'driver', device_id });
    if (res.twofa_required) return res;
    if (!res?.token || res?.user?.role !== 'driver' || res?.user?.approved !== true) {
      throw new Error('Sjåførkontoen må være invitert og godkjent.');
    }
    await storage.setItem(TOKEN_KEY, res.token);
    setUser(res.user);
    return res.user;
  };

  const acceptLegal = async (): Promise<User> => {
    const updated = await authApi.acceptLegal('2026-09');
    setUser(updated);
    return updated;
  };

  const logout = async () => {
    try { await stopDriverBackgroundLocation(); } catch {}
    try { await unregisterNativePush(); } catch {}
    try { await authApi.logout(); } catch {}
    await storage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, login, acceptLegal, logout, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
