"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { authApi } from "./api";
import type { PendingVerification, User } from "./types";

const TOKEN_KEY = "mnflix_token";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (payload: {
    name?: string;
    phone: string;
    email?: string;
    password: string;
  }) => Promise<PendingVerification>;
  /** Called from the OTP screen; signs the user in on success. */
  verifyOtp: (identifier: string, code: string) => Promise<void>;
  /** Adopt a session returned by reset-password (it logs the user in). */
  adoptSession: (token: string, user: User) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore the session on first load. All state updates happen in async
  // callbacks so the effect body itself never sets state synchronously.
  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    if (!stored) {
      queueMicrotask(() => setLoading(false));
      return;
    }
    authApi
      .me(stored)
      .then((u) => {
        setToken(stored);
        setUser(u);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const persist = useCallback((nextToken: string, nextUser: User) => {
    localStorage.setItem(TOKEN_KEY, nextToken);
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const res = await authApi.login({ identifier, password });
      persist(res.accessToken, res.user);
    },
    [persist],
  );

  // Registration no longer signs in — the account first needs its OTP.
  const register = useCallback(
    async (payload: {
      name?: string;
      phone: string;
      email?: string;
      password: string;
    }) => {
      return authApi.register(payload);
    },
    [],
  );

  const verifyOtp = useCallback(
    async (identifier: string, code: string) => {
      const res = await authApi.verifyOtp({ identifier, code });
      persist(res.accessToken, res.user);
    },
    [persist],
  );

  const adoptSession = useCallback(
    (nextToken: string, nextUser: User) => persist(nextToken, nextUser),
    [persist],
  );

  const refresh = useCallback(async () => {
    if (!token) return;
    const u = await authApi.me(token).catch(() => null);
    if (u) setUser(u);
  }, [token]);

  const logout = useCallback(async () => {
    if (token) {
      await authApi.logout(token).catch(() => undefined);
    }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, [token]);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      register,
      verifyOtp,
      adoptSession,
      refresh,
      logout,
    }),
    [user, token, loading, login, register, verifyOtp, adoptSession, refresh, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
