import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, TOKEN_KEY, setUnauthorizedHandler } from './api';

// Only staff roles may enter the control center. The server also enforces this
// on every /admin/* endpoint (require_admin / require_superadmin).
const ALLOWED = ['superadmin', 'admin'];

type User = any;
type Ctx = {
  user: User | undefined; // undefined = loading, null = signed out
  login: (email: string, password: string) => Promise<any>;
  verify2fa: (twofa_token: string, code: string) => Promise<User>;
  completeLogin: (res: any) => User;
  logout: () => Promise<void>;
};

const AuthCtx = createContext<Ctx>(null as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | undefined>(undefined);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      sessionStorage.removeItem(TOKEN_KEY);
      setUser(null);
    });
    const t = sessionStorage.getItem(TOKEN_KEY);
    if (!t) {
      setUser(null);
      return;
    }
    api
      .me()
      .then((u) => {
        if (ALLOWED.includes(u?.role)) setUser(u);
        else {
          sessionStorage.removeItem(TOKEN_KEY);
          setUser(null);
        }
      })
      .catch(() => {
        sessionStorage.removeItem(TOKEN_KEY);
        setUser(null);
      });
  }, []);

  const finish = (res: any): User => {
    if (!ALLOWED.includes(res?.user?.role)) {
      throw new Error('Kun administratorer har tilgang til dette kontrollsenteret.');
    }
    sessionStorage.setItem(TOKEN_KEY, res.token);
    setUser(res.user);
    return res.user;
  };

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    if (res?.twofa_required || res?.twofa_setup_required) return res; // caller shows verify/enrollment step
    return finish(res);
  };

  const verify2fa = async (twofa_token: string, code: string) =>
    finish(await api.verify2fa(twofa_token, code));

  const logout = async () => {
    try { await api.logout(); }
    finally {
      sessionStorage.removeItem(TOKEN_KEY);
      setUser(null);
    }
  };

  return (
    <AuthCtx.Provider value={{ user, login, verify2fa, completeLogin: finish, logout }}>{children}</AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
