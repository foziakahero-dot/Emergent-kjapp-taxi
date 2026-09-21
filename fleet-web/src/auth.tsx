import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, TOKEN_KEY, setUnauthorizedHandler } from './api';

export type FleetUser = {
  id?: string;
  email?: string;
  fullName?: string;
  role?: string;
  approved?: boolean;
  fleet_id?: string;
  totp_enabled?: boolean;
  twofa_setup_required?: boolean;
};

type AuthContextValue = {
  user: FleetUser | null | undefined;
  twofaToken: string | null;
  login: (email: string, password: string) => Promise<FleetUser | null>;
  verifyTwofa: (code: string) => Promise<FleetUser>;
  cancelTwofa: () => void;
  refresh: () => Promise<FleetUser | null>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue>(null as any);

function assertFleetOwner(user: FleetUser | undefined | null) {
  if (!user || user.role !== 'fleet_owner') {
    throw new Error('Denne kontoen har ikke tilgang til KJAPP Partner.');
  }
  if (user.approved === false) {
    throw new Error('Løyvehaverkontoen venter på godkjenning.');
  }
  return user;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FleetUser | null | undefined>(undefined);
  const [twofaToken, setTwofaToken] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) {
      setUser(null);
      return null;
    }
    try {
      const next = assertFleetOwner(await api.me());
      setUser(next);
      return next;
    } catch {
      sessionStorage.removeItem(TOKEN_KEY);
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      sessionStorage.removeItem(TOKEN_KEY);
      setTwofaToken(null);
      setUser(null);
    });
    void refresh();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    if (res?.twofa_required) {
      if (!res.twofa_token) throw new Error('KJAPP returnerte ikke en gyldig 2FA-økt.');
      setTwofaToken(res.twofa_token);
      setUser(null);
      return null;
    }
    const next = assertFleetOwner(res?.user);
    sessionStorage.setItem(TOKEN_KEY, res.token);
    setTwofaToken(null);
    setUser(next);
    return next;
  };

  const verifyTwofa = async (code: string) => {
    if (!twofaToken) throw new Error('2FA-økten er utløpt. Logg inn på nytt.');
    const res = await api.twofaVerifyLogin(twofaToken, code);
    const next = assertFleetOwner(res?.user);
    sessionStorage.setItem(TOKEN_KEY, res.token);
    setTwofaToken(null);
    setUser(next);
    return next;
  };

  const cancelTwofa = () => setTwofaToken(null);

  const logout = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    setTwofaToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, twofaToken, login, verifyTwofa, cancelTwofa, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
