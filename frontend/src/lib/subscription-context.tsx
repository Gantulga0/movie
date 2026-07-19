"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { billingApi } from "./api";
import { useAuth } from "./auth-context";
import type { Subscription } from "./types";

interface SubscriptionContextValue {
  /** True while the signed-in user holds an unexpired subscription. */
  hasActiveSub: boolean;
  subscription: Subscription | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const FALLBACK: SubscriptionContextValue = {
  hasActiveSub: false,
  subscription: null,
  loading: false,
  refresh: async () => undefined,
};

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(
  undefined,
);

// Survives page navigations (each page mounts its own provider): the last
// known answer renders immediately while a silent refresh runs behind it.
let subCache: { token: string; value: Subscription | null } | null = null;

/**
 * App-wide "does this user have an active plan" state. Poster cards use it
 * to hide rental price tags that don't apply to subscribers.
 */
export function SubscriptionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { token } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(() =>
    subCache && subCache.token === token ? subCache.value : null,
  );
  const [loading, setLoading] = useState(
    () => !(subCache && subCache.token === token),
  );

  const load = useCallback(async () => {
    if (!token) {
      subCache = null;
      setSubscription(null);
      setLoading(false);
      return;
    }
    try {
      const res = await billingApi.me(token);
      subCache = { token, value: res.active };
      setSubscription(res.active);
    } catch {
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo(
    () => ({
      hasActiveSub: Boolean(subscription),
      subscription,
      loading,
      refresh: load,
    }),
    [subscription, loading, load],
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  // Outside the provider (auth pages, admin) rental tags simply stay visible.
  return useContext(SubscriptionContext) ?? FALLBACK;
}
