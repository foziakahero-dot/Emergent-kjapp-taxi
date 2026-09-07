import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { authApi } from "../lib/api";
import { ensureServiceWorker } from "../lib/push";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = not authed

  const refresh = useCallback(async () => {
    const token = localStorage.getItem("kjapp_token");
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const u = await authApi.me();
      setUser(u);
    } catch {
      localStorage.removeItem("kjapp_token");
      setUser(null);
    }
  }, []);

  useEffect(() => {
    // Skip /me check if returning from Google OAuth — AuthCallback handles it
    if (typeof window !== "undefined" && window.location.hash?.includes("session_id=")) {
      setUser(null);
      return;
    }
    refresh();
    ensureServiceWorker();
  }, [refresh]);

  const googleSession = async (session_id) => {
    const { authApi } = await import("../lib/api");
    const res = await authApi.googleSession(session_id);
    localStorage.setItem("kjapp_token", res.token);
    setUser(res.user);
    return res.user;
  };

  const login = async (email, password) => {
    const res = await authApi.login({ email, password });
    if (res.twofa_required) {
      return { twofaRequired: true, twofaToken: res.twofa_token };
    }
    localStorage.setItem("kjapp_token", res.token);
    setUser(res.user);
    return res.user;
  };

  const verifyTwofaLogin = async (twofaToken, code) => {
    const res = await authApi.twofaVerifyLogin(twofaToken, code);
    localStorage.setItem("kjapp_token", res.token);
    setUser(res.user);
    return res.user;
  };

  const register = async (data) => {
    const res = await authApi.register(data);
    localStorage.setItem("kjapp_token", res.token);
    setUser(res.user);
    return res.user;
  };

  const logout = async () => {
    localStorage.removeItem("kjapp_token");
    try { localStorage.removeItem("kjapp_mode_override"); } catch { /* ignore */ }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, refresh, googleSession, verifyTwofaLogin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
