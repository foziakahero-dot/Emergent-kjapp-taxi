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
    refresh();
    ensureServiceWorker();
  }, [refresh]);

  const login = async (email, password) => {
    const res = await authApi.login({ email, password });
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
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
