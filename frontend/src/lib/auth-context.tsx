"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { authApi } from "./api";
import type { PendingVerification, User } from "./types";

const TOKEN_KEY = "infinity_token";
const REFRESH_KEY = "infinity_refresh";
const LAST_ACTIVE_KEY = "infinity_last_active";
/** Auto sign-out after this long away from / idle on the site. */
const IDLE_LIMIT_MS = 60 * 60 * 1000; // 1 hour
/** Rotate the short-lived access token well before it expires (~30m). */
const REFRESH_INTERVAL_MS = 20 * 60 * 1000;

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
  adoptSession: (accessToken: string, refreshToken: string, user: User) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTokenRef = useRef<string | null>(null);
  const refreshing = useRef(false);

  const persist = useCallback(
    (accessToken: string, refreshToken: string, nextUser: User) => {
      localStorage.setItem(TOKEN_KEY, accessToken);
      localStorage.setItem(REFRESH_KEY, refreshToken);
      localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
      refreshTokenRef.current = refreshToken;
      setToken(accessToken);
      setUser(nextUser);
    },
    [],
  );

  // Clear a session locally (idle expiry / failed refresh).
  const expire = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(LAST_ACTIVE_KEY);
    refreshTokenRef.current = null;
    setToken(null);
    setUser(null);
  }, []);

  // Exchange the refresh token for a fresh access + refresh pair.
  const doRefresh = useCallback(async (): Promise<boolean> => {
    const rt = refreshTokenRef.current ?? localStorage.getItem(REFRESH_KEY);
    if (!rt) return false;
    if (refreshing.current) return true;
    refreshing.current = true;
    try {
      const res = await authApi.refresh(rt);
      persist(res.accessToken, res.refreshToken, res.user);
      return true;
    } catch {
      expire();
      return false;
    } finally {
      refreshing.current = false;
    }
  }, [persist, expire]);

  // Restore the session on first load.
  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    const storedRefresh =
      typeof window !== "undefined" ? localStorage.getItem(REFRESH_KEY) : null;
    refreshTokenRef.current = storedRefresh;

    if (!stored) {
      queueMicrotask(() => setLoading(false));
      return;
    }
    // Session went stale while the user was away — force a fresh login.
    const last = Number(localStorage.getItem(LAST_ACTIVE_KEY) ?? 0);
    if (last && Date.now() - last > IDLE_LIMIT_MS) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem(LAST_ACTIVE_KEY);
      queueMicrotask(() => setLoading(false));
      return;
    }

    authApi
      .me(stored)
      .then((u) => {
        setToken(stored);
        setUser(u);
        localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
      })
      .catch(async () => {
        // Access token likely expired — try to refresh before giving up.
        if (storedRefresh) {
          try {
            const res = await authApi.refresh(storedRefresh);
            localStorage.setItem(TOKEN_KEY, res.accessToken);
            localStorage.setItem(REFRESH_KEY, res.refreshToken);
            localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
            refreshTokenRef.current = res.refreshToken;
            setToken(res.accessToken);
            setUser(res.user);
            return;
          } catch {
            /* fall through to sign-out */
          }
        }
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
        refreshTokenRef.current = null;
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // Proactively rotate the access token, and top it up whenever the tab
  // regains focus (background timers get throttled).
  useEffect(() => {
    if (!token) return;
    const timer = setInterval(() => void doRefresh(), REFRESH_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void doRefresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [token, doRefresh]);

  // Track activity and sign out after IDLE_LIMIT_MS of inactivity. Playback
  // counts as activity, so a long film never logs the viewer out mid-watch.
  useEffect(() => {
    if (!token) return;

    const touch = () => localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
    touch();

    let last = Date.now();
    const onActivity = () => {
      const now = Date.now();
      if (now - last > 30_000) {
        last = now;
        touch();
      }
    };
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) =>
      window.addEventListener(e, onActivity, { passive: true }),
    );

    const check = () => {
      const la = Number(localStorage.getItem(LAST_ACTIVE_KEY) ?? 0);
      if (!la || Date.now() - la <= IDLE_LIMIT_MS) return;
      const video = document.querySelector("video");
      if (video && !video.paused && !video.ended) {
        touch(); // still watching — keep the session alive
        return;
      }
      expire();
    };
    const timer = setInterval(check, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", touch);

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", touch);
    };
  }, [token, expire]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const res = await authApi.login({ identifier, password });
      persist(res.accessToken, res.refreshToken, res.user);
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
      persist(res.accessToken, res.refreshToken, res.user);
    },
    [persist],
  );

  const adoptSession = useCallback(
    (accessToken: string, refreshToken: string, nextUser: User) =>
      persist(accessToken, refreshToken, nextUser),
    [persist],
  );

  const refresh = useCallback(async () => {
    if (!token) return;
    const u = await authApi.me(token).catch(() => null);
    if (u) setUser(u);
  }, [token]);

  const logout = useCallback(async () => {
    const rt = refreshTokenRef.current;
    if (token) {
      await authApi.logout(token, rt ?? undefined).catch(() => undefined);
    }
    expire();
  }, [token, expire]);

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
