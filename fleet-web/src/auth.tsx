import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, TOKEN_KEY, setUnauthorizedHandler } from './api';

export type FleetUser = {
  id?: string;
  email?: string;
  fullName?: string;
  role?: string;
  approved?: boolean;
  fleet_id?: string;
};

type AuthContextValue = {
  user: FleetUser | null | undefined;
  sessionNotice: string;
  login: (email: string, password: string) => Promise<FleetUser>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue>(null as any);

function assertFleetOwner(user: FleetUser | undefined | null) {
  if (!user || user.role !== 'fleet_owner') {
    throw new Error('Denne kontoen har ikke tilgang til SNAR Fleet.');
  }
  if (user.approved === false) {
    throw new Error('Løyvehaverkontoen venter på godkjenning.');
  }
  return user;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FleetUser | null | undefined>(undefined);

  const [sessionNotice, setSessionNotice] = useState('');
  useEffect(() => {
    let mounted = true;
    const endSession = (status: 401 | 403) => {
      sessionStorage.removeItem(TOKEN_KEY);
      setSessionNotice(status === 403
        ? 'Du har ikke lenger tilgang til flåten. Kontakt administrator hvis dette er feil.'
        : 'Økten er utløpt. Logg inn på nytt.');
      setUser(null);
    };
    setUnauthorizedHandler(endSession);
    const token = sessionStorage.getItem(TOKEN_KEY);
    const isCurrent = () => mounted && token === sessionStorage.getItem(TOKEN_KEY);
    if (!token) setUser(null);
    else api.me().then((u) => {
      if (!isCurrent()) return;
      try { setUser(assertFleetOwner(u)); } catch { endSession(403); }
    }).catch(() => {
      if (!isCurrent()) return;
      sessionStorage.removeItem(TOKEN_KEY);
      setUser(null);
    });
    return () => { mounted = false; setUnauthorizedHandler(() => {}); };
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    if (res?.twofa_required) {
      throw new Error('Denne kontoen krever en innloggingsflyt som ikke hører til løyvehaverportalen.');
    }
    const next = assertFleetOwner(res?.user);
    sessionStorage.setItem(TOKEN_KEY, res.token);
    setSessionNotice('');
    setUser(next);
    return next;
  };

  const logout = () => {
    setSessionNotice('');
    sessionStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, login, logout, sessionNotice }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
