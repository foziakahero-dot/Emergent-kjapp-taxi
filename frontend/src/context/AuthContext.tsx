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
} | null;

type AuthCtx = {
  user: User | undefined; // undefined = loading, null = signed out
  login: (email: string, password: string) => Promise<any>;
  register: (data: any) => Promise<any>;
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
      setUser(u);
    } catch {
      await storage.removeItem(TOKEN_KEY);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

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

  const logout = async () => {
    await storage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, login, register, logout, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
