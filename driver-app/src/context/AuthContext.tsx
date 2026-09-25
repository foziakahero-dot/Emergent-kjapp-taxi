import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { storage } from '@/src/utils/storage';
import { authApi, TOKEN_KEY } from '@/src/lib/api';

export type User = {
  id: string;
  email: string;
  fullName?: string;
  phone?: string;
  role?: string;
  driver_id?: string;
  car?: string;
  plate?: string;
  vehicle_type?: string;
  approved?: boolean;
  fleet_id?: string;
} | null;

type AuthCtx = {
  user: User | undefined;
  login: (identifier: string, password: string) => Promise<any>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
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
    void refresh();
  }, [refresh]);

  const login = async (identifier: string, password: string) => {
    const res = await authApi.driverLogin(identifier, password);
    if (res?.twofa_required) return res;
    if (!res?.token || res?.user?.role !== 'driver' || res?.user?.approved !== true) {
      throw new Error('Denne kontoen har ikke tilgang til KJAPP Driver.');
    }
    await storage.setItem(TOKEN_KEY, res.token);
    setUser(res.user);
    return res.user;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {}
    await storage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, login, logout, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
