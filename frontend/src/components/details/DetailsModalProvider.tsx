"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { DetailsModal } from "./DetailsModal";

interface OpenOptions {
  /** Start with the trailer already playing. */
  trailer?: boolean;
}

interface DetailsContextValue {
  /** Opens the cinematic details modal for a title (by slug or id). */
  openDetails: (slugOrId: string, options?: OpenOptions) => void;
}

const DetailsContext = createContext<DetailsContextValue | undefined>(undefined);

/**
 * App-wide details modal. Any card can open it via useDetails() —
 * clicking a title never hard-navigates away from the current page.
 */
export function DetailsModalProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<{ slug: string; trailer: boolean } | null>(
    null,
  );

  const openDetails = useCallback((slugOrId: string, options?: OpenOptions) => {
    setTarget({ slug: slugOrId, trailer: options?.trailer ?? false });
  }, []);

  const close = useCallback(() => setTarget(null), []);

  return (
    <DetailsContext.Provider value={{ openDetails }}>
      {children}
      {target ? (
        <DetailsModal
          slug={target.slug}
          initialTrailer={target.trailer}
          onClose={close}
        />
      ) : null}
    </DetailsContext.Provider>
  );
}

export function useDetails(): DetailsContextValue {
  const ctx = useContext(DetailsContext);
  const router = useRouter();
  // Outside the provider (rare) fall back to the full details page.
  if (!ctx) {
    return { openDetails: (slugOrId: string) => router.push(`/title/${slugOrId}`) };
  }
  return ctx;
}
