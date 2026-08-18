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
  /** True while the signed-in user holds any unexpired subscription. */
  hasActiveSub: boolean;
  /** True when one of those subscriptions covers the FULL catalog
   *  (plan.genreSlugs empty — «Plus» or a grandfathered old plan). */
  hasFullAccessSub: boolean;
  /** All unexpired subscriptions — category plans can run in parallel. */
  subscriptions: Subscription[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const FALLBACK: SubscriptionContextValue = {
  hasActiveSub: false,
  hasFullAccessSub: false,
  subscriptions: [],
  loading: false,
  refresh: async () => undefined,
};

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(
  undefined,
);

// Survives page navigations (each page mounts its own provider): the last
// known answer renders immediately while a silent refresh runs behind it.
let subCache: { token: string; value: Subscription[] } | null = null;

/**
 * App-wide "does this user have an active plan" state. Poster cards use it
 * to hide rental price tags that don't apply to full-access subscribers.
 */
export function SubscriptionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { token } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(() =>
    subCache && subCache.token === token ? subCache.value : [],
  );
  const [loading, setLoading] = useState(
    () => !(subCache && subCache.token === token),
  );

  const load = useCallback(async () => {
    if (!token) {
      subCache = null;
      setSubscriptions([]);
      setLoading(false);
      return;
    }
    try {
      const res = await billingApi.me(token);
      subCache = { token, value: res.actives };
      setSubscriptions(res.actives);
    } catch {
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo(
    () => ({
      hasActiveSub: subscriptions.length > 0,
      hasFullAccessSub: subscriptions.some(
        (s) => (s.plan.genreSlugs?.length ?? 0) === 0,
      ),
      subscriptions,
      loading,
      refresh: load,
    }),
    [subscriptions, loading, load],
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
